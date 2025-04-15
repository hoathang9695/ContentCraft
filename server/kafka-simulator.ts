/**
 * Công cụ này mô phỏng việc gửi thông điệp từ Kafka cho mục đích kiểm thử
 * Trong môi trường thực tế, những thông điệp này sẽ đến từ một Kafka broker bên ngoài
 */

import { db } from './db';
import { users, supportRequests } from '../shared/schema';
import { type ContentMessage } from './kafka-consumer';
import { log } from './vite';


/**
 * Tạo và xử lý một thông điệp nội dung mẫu giống như Kafka gửi đến
 */
export async function simulateKafkaMessage(contentId: string): Promise<ContentMessage> {
  const message: ContentMessage = {
    externalId: contentId,
    source: 'Kafka Simulator',
    sourceVerification: 'unverified'
  };

  // Log message
  console.log(`Simulating Kafka message: ${JSON.stringify(message)}`);

  try {
    // Assign to active users in round-robin fashion
    const activeUsers = await db.select().from(users).where(eq(users.status, 'active'));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error('No active users found');
    }

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

    await db.insert(supportRequests).values({
      full_name: "System Generated",
      email: "system@example.com", 
      subject: `Auto Request content:${contentId}`,
      content: `Auto-generated request from Kafka message: ${JSON.stringify(message)}`,
      status: 'pending',
      assigned_to_id,
      assigned_at: now,
      created_at: now,
      updated_at: now
    });

    console.log(`Successfully processed simulated message for content ID: ${contentId}`);
  } catch (error) {
    console.error(`Error processing simulated message: ${error}`);
    throw error;
  }

  return message;
}

/**
 * Tạo và xử lý nhiều thông điệp nội dung mẫu
 */
export async function simulateMultipleMessages(count: number = 5): Promise<ContentMessage[]> {
  const messages: ContentMessage[] = [];
  
  log(`Simulating ${count} Kafka messages...`, 'kafka-simulator');
  
  for (let i = 0; i < count; i++) {
    const contentId = `test-content-${Date.now()}-${i}`;
    const message = await simulateKafkaMessage(contentId);
    messages.push(message);
    
    // Đợi một khoảng thời gian ngắn giữa các tin nhắn để tránh đụng độ
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  log(`Completed simulation of ${count} messages`, 'kafka-simulator');
  return messages;
}

/**
 * Tạo và xử lý lô lớn thông điệp nội dung (không giới hạn số lượng)
 */
export async function simulateMassMessages(count: number = 99): Promise<ContentMessage[]> {
  const messages: ContentMessage[] = [];
  
  log(`Simulating ${count} Kafka messages (mass simulation)...`, 'kafka-simulator');
  
  for (let i = 0; i < count; i++) {
    const contentId = `mass-content-${Date.now()}-${i}`;
    const message = await simulateKafkaMessage(contentId);
    messages.push(message);
    
    // Giảm thời gian chờ và log ít hơn để tránh quá tải console
    if (i % 10 === 0) {
      log(`Processed ${i}/${count} messages`, 'kafka-simulator');
    }
    
    // Đợi một khoảng thời gian ngắn giữa các tin nhắn để giảm tải cho hệ thống
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  log(`Completed simulation of ${count} messages (mass simulation)`, 'kafka-simulator');
  return messages;
}