import { simulateKafkaMessage } from './server/kafka-simulator';

async function simulateKafkaData() {
  console.log('Starting simulation of 27 Kafka messages...');
  
  // Phân phối 27 nội dung cho 3 người dùng theo vòng tròn
  const totalMessages = 27;
  
  for (let i = 0; i < totalMessages; i++) {
    const contentId = `content-${Date.now()}-${i}`;
    try {
      await simulateKafkaMessage(contentId);
      console.log(`Processed message ${i + 1}/${totalMessages}`);
      // Đợi một khoảng thời gian rất ngắn giữa các tin nhắn để tránh đụng độ
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing message ${i + 1}: ${error}`);
    }
  }
  
  console.log('Completed simulation of 27 Kafka messages');
}

simulateKafkaData().catch(console.error);