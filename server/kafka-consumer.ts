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
export async function setupKafkaConsumer(
  brokers: string[] = ['localhost:9092'],
  groupId: string = 'content-processing-group',
  topic: string = 'content-topic'
) {
  try {
    const kafka = new Kafka({
      clientId: 'content-processing-service',
      brokers,
    });

    consumer = kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    log('Connected to Kafka and subscribed to topic: ' + topic, 'kafka');

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
    log(`Processing content: ${JSON.stringify(contentMessage)}`, 'kafka');
    
    // Kiểm tra xem nội dung đã tồn tại chưa
    const existingContent = await db.query.contents.findFirst({
      where: eq(contents.externalId, contentMessage.externalId),
    });
    
    if (existingContent) {
      log(`Content with externalId ${contentMessage.externalId} already exists.`, 'kafka');
      return;
    }
    
    // Lấy danh sách người dùng phải là editor và có trạng thái active
    const editorUsers = await db.query.users.findMany({
      where: (users, { eq, and }) => 
        and(eq(users.role, 'editor'), eq(users.status, 'active')),
    });
    
    if (editorUsers.length === 0) {
      log('No active editor users found to assign content.', 'kafka');
      // Lưu nội dung mà không phân công
      await db.insert(contents).values({
        externalId: contentMessage.externalId,
        source: contentMessage.source || null,
        categories: contentMessage.categories || null,
        labels: contentMessage.labels || null,
        status: 'pending',
        sourceVerification: contentMessage.sourceVerification || 'unverified',
      });
      return;
    }
    
    // Tìm người xử lý tiếp theo dựa trên hệ thống turn-based
    
    // 1. Lấy nội dung mới nhất đã được phân công
    const lastAssignedContent = await db.query.contents.findFirst({
      where: (contents, { isNotNull }) => isNotNull(contents.assigned_to_id),
      orderBy: (contents, { desc }) => [desc(contents.assignedAt)],
    });
    
    let nextAssigneeIndex = 0;
    
    // 2. Nếu đã có nội dung được phân công trước đó
    if (lastAssignedContent && lastAssignedContent.assigned_to_id) {
      // Tìm vị trí của người được phân công trước đó
      const lastAssigneeIndex = editorUsers.findIndex(
        user => user.id === lastAssignedContent.assigned_to_id
      );
      
      if (lastAssigneeIndex !== -1) {
        // Người tiếp theo trong danh sách (quay vòng nếu đến cuối danh sách)
        nextAssigneeIndex = (lastAssigneeIndex + 1) % editorUsers.length;
      }
    }
    
    // Phân công cho người tiếp theo
    const assigned_to_id = editorUsers[nextAssigneeIndex].id;
    const now = new Date();
    
    // Lưu nội dung với thông tin phân công
    await db.insert(contents).values({
      externalId: contentMessage.externalId,
      source: contentMessage.source || null,
      categories: contentMessage.categories || null,
      labels: contentMessage.labels || null,
      status: 'pending',
      sourceVerification: contentMessage.sourceVerification || 'unverified',
      assigned_to_id,
      assignedAt: now,
    });
    
    log(`Content ${contentMessage.externalId} assigned to user ID ${assigned_to_id} (${editorUsers[nextAssigneeIndex].username})`, 'kafka');
  } catch (error) {
    log(`Error processing content message: ${error}`, 'kafka-error');
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