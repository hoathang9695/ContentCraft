
import { parseMessage } from './server/kafka-consumer';

// Test với message format thực tế từ producer
const testMessages = [
  {
    type: "user_complain",
    receiver_account_id: {
      id: "114619409398949374",
      name: "Nguyễn Văn A",
      email: "test@example.com"
    },
    activity_id: "112240909630381155",
    activity_class_name: "Account",
    reason: "Test reason",
    descriptions: "Test description"
  }
];

console.log('🧪 Testing complain message parsing...');

testMessages.forEach((message, index) => {
  console.log(`\n📝 Test message ${index + 1}:`);
  console.log(JSON.stringify(message, null, 2));
  
  const buffer = Buffer.from(JSON.stringify(message));
  const parsed = parseMessage(buffer);
  
  console.log(`✅ Parsed result:`, parsed ? 'SUCCESS' : 'FAILED');
  if (parsed) {
    console.log('Parsed message:', JSON.stringify(parsed, null, 2));
  }
});
