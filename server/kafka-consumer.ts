
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { db } from './db';
import { users, supportRequests } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { log } from './vite';

let consumer: Consumer;

export interface ContentMessage {
  externalId: string;
  source?: string;
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
 * Xử lý tin nhắn Kafka về nội dung
 */
export async function processContentMessage(messageWithStringId: any) {
  try {
    const contentMessage = messageWithStringId;

    // Lấy danh sách người dùng active để phân công
    const activeUsers = await db.select().from(users).where(eq(users.status, 'active'));

    if (!activeUsers || activeUsers.length === 0) {
      log('No active users found to assign request.', 'kafka');
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
    try {
      const insertData = {
        fullName: "System Generated",
        email: "system@example.com", 
        subject: `Auto Request content:${contentMessage.externalId}`,
        content: `Auto-generated request from Kafka message: ${JSON.stringify(messageWithStringId)}`,
        status: 'pending',
        assigned_to_id,
        assigned_at: now,
        created_at: now,
        updated_at: now
      };

      log(`Attempting to insert support request with data: ${JSON.stringify(insertData)}`, 'kafka');

      const newRequest = await db.insert(supportRequests).values(insertData).returning();

      log(`Successfully created support request: ${JSON.stringify(newRequest)}`, 'kafka');

      if (!newRequest || newRequest.length === 0) {
        log('Warning: No data returned after insert', 'kafka');
      }

      log(`Support request created and assigned to user ID ${assigned_to_id} (${activeUsers[nextAssigneeIndex].username})`, 'kafka');
    } catch (err) {
      log(`Error creating support request: ${err}`, 'kafka');
      throw err;
    }
  } catch (error) {
    log(`Error processing content message: ${error}`, 'kafka-error');
    throw error;
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
