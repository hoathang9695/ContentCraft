/**
 * Công cụ này mô phỏng việc gửi thông điệp từ Kafka cho mục đích kiểm thử
 * Trong môi trường thực tế, những thông điệp này sẽ đến từ một Kafka broker bên ngoài
 */

import { processContentMessage, ContentMessage } from './kafka-consumer';
import { log } from './vite';

/**
 * Tạo và xử lý một thông điệp nội dung mẫu giống như Kafka gửi đến
 */
export async function simulateKafkaMessage(contentId: string): Promise<ContentMessage> {
  // Tạo nội dung mẫu với ID đã cung cấp
  const message: ContentMessage = {
    externalId: contentId,
    source: 'Kafka Simulator',
    categories: 'Test Category',
    labels: 'test,simulator,kafka',
    sourceVerification: 'unverified'
  };
  
  // Ghi log
  log(`Simulating Kafka message: ${JSON.stringify(message)}`, 'kafka-simulator');
  
  try {
    // Xử lý tin nhắn như thể nó đến từ Kafka
    await processContentMessage(message);
    log(`Successfully processed simulated message for content ID: ${contentId}`, 'kafka-simulator');
  } catch (error) {
    log(`Error processing simulated message: ${error}`, 'kafka-simulator');
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