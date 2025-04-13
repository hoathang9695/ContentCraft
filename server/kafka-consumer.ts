
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { db } from './db';
import { contents, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { log } from './vite';

let consumer: Consumer;

export interface ContentMessage {
  externalId: string;
  source?: string;
  categories?: string;
  labels?: string;
  sourceVerification?: 'verified' | 'unverified';
}

/**
 * Hàm khởi tạo và thiết lập kết nối với Kafka
 */
export async function setupKafkaConsumer() {
  try {
    // Kiểm tra xem Kafka có được kích hoạt không
    if (process.env.KAFKA_ENABLED !== 'true') {
      log('Kafka is not enabled', 'kafka');
      return;
    }
    const sasl = process.env.KAFKA_SASL == 'true'? {
      mechanism: process.env.KAFKA_SASL_MECHANISMS as 'PLAIN',
      username: process.env.KAFKA_SASL_USERNAME || '',
      password: process.env.KAFKA_SASL_PASSWORD || ''
    }: undefined
    const kafka = new Kafka({
      clientId: 'content-processing-service',
      brokers: process.env.KAFKA_BROKERS?.split(',') || [],
      ssl: false,
      sasl: sasl,
      connectionTimeout: 3000,
      authenticationTimeout: 1000,
    });

    consumer = kafka.consumer({ 
      groupId: process.env.KAFKA_GROUP_ID || 'emso-processor'
    });
    
    await consumer.connect();
    
    const topics = process.env.KAFKA_TOPICS?.split(',') || ['content_management'];
    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: true });
    }

    log('Connected to Kafka and subscribed to topics: ' + topics.join(', '), 'kafka');

    // Bắt đầu tiêu thụ tin nhắn
    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const { message } = payload;
        const contentMessage = parseMessage(message.value);

        if (contentMessage) {
          await processContentMessage(contentMessage);
        }
      },
    });

    return consumer;
  } catch (error) {
    log(`Error setting up Kafka consumer: ${error}`, 'kafka-error');
    throw error;
  }
}

/**
 * Phân tích tin nhắn từ Kafka
 */
function parseMessage(messageValue: Buffer | null): ContentMessage | null {
  if (!messageValue) return null;

  try {
    const value = messageValue.toString();
    return JSON.parse(value) as ContentMessage;
  } catch (error) {
    log(`Error parsing message: ${error}`, 'kafka-error');
    return null;
  }
}

/**
 * Xử lý tin nhắn nội dung từ Kafka và phân công xử lý theo turn
 */
export async function processContentMessage(contentMessage: ContentMessage) {
  try {
    const messageWithStringId = {
      ...contentMessage,
      externalId: String(contentMessage.externalId)
    };
    log(`Processing content: ${JSON.stringify(messageWithStringId)}`, 'kafka');

    // Kiểm tra xem nội dung đã tồn tại chưa
    const existingContent = await db.query.contents.findFirst({
      where: eq(contents.externalId, contentMessage.externalId),
    });

    if (existingContent) {
      log(`Content with externalId ${contentMessage.externalId} already exists.`, 'kafka');
      return;
    }

    // Lấy danh sách người dùng active không phải admin
    const activeUsers = await db.query.users.findMany({
      where: (users, { and, ne, eq }) => 
        and(
          ne(users.role, 'admin'),
          eq(users.status, 'active')
        ),
    });

    if (activeUsers.length === 0) {
      log('No active non-admin users found to assign content.', 'kafka');
      return;
    }

    // Tìm người xử lý tiếp theo dựa trên hệ thống turn-based
    const lastAssignedRequest = await db.query.supportRequests.findFirst({
      orderBy: (supportRequests, { desc }) => [desc(supportRequests.assigned_at)],
    });

    let nextAssigneeIndex = 0;

    if (lastAssignedRequest && lastAssignedRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        user => user.id === lastAssignedRequest.assigned_to_id
      );

      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Tạo yêu cầu hỗ trợ mới
    await db.insert(supportRequests).values({
      fullName: "System Generated",
      email: "system@example.com",
      subject: `Auto Request ${contentMessage.externalId}`,
      content: `Auto-generated request from Kafka message: ${JSON.stringify(messageWithStringId)}`,
      status: 'pending',
      assigned_to_id,
      assigned_at: now,
    });

    log(`Support request created and assigned to user ID ${assigned_to_id} (${activeUsers[nextAssigneeIndex].username})`, 'kafka');
  } catch (error) {
    log(`Error processing content message: ${error}`, 'kafka-error');
    throw error; // Ném lỗi để caller có thể xử lý
  }
}

/**
 * Đóng kết nối Kafka
 */
export async function disconnectKafkaConsumer() {
  if (consumer) {
    await consumer.disconnect();
    log('Disconnected from Kafka', 'kafka');
  }
}
