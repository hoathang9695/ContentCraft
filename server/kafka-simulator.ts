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
    labels: 'test,simulator,kafka'
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
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  log(`Completed simulation of ${count} messages`, 'kafka-simulator');
  return messages;
}