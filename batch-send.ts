import { simulateKafkaMessage } from './server/kafka-simulator';
import { ContentMessage } from './server/kafka-consumer';

async function sendBatch(start: number, count: number, isVerified: boolean = false) {
  console.log(`Starting simulation of batch ${start}-${start+count-1} (${isVerified ? 'verified' : 'unverified'})...`);
  
  for (let i = start; i < start + count; i++) {
    const contentId = `content-${Date.now()}-${i}`;
    try {
      // Custom implementation để hỗ trợ thiết lập sourceVerification trực tiếp
      const verificationStatus = isVerified ? 'verified' : 'unverified' as 'verified' | 'unverified';
      const message: ContentMessage = {
        externalId: contentId,
        source: 'Batch Sender',
        categories: 'Batch Category',
        labels: 'batch,test,simulator',
        sourceVerification: verificationStatus
      };
      
      // Gửi tin nhắn tùy chỉnh
      const { processContentMessage } = await import('./server/kafka-consumer');
      await processContentMessage(message);
      
      console.log(`Processed message ${i} (${isVerified ? 'verified' : 'unverified'})`);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error processing message ${i}: ${error}`);
    }
  }
  
  console.log(`Completed batch ${start}-${start+count-1} (${isVerified ? 'verified' : 'unverified'})`);
}

// Chạy lệnh với các tham số:
// 1. Số lượng trong batch
// 2. Vị trí bắt đầu
// 3. Trạng thái xác minh (true/false)
const count = parseInt(process.argv[2] || '9', 10);
const start = parseInt(process.argv[3] || '0', 10);
const isVerified = process.argv[4] === 'verified' || process.argv[4] === 'true';

console.log(`Running batch with: count=${count}, start=${start}, isVerified=${isVerified}`);
sendBatch(start, count, isVerified).catch(console.error);