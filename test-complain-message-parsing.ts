
import { parseMessage } from './server/kafka-consumer.js';

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
  },
  {
    type: "page_complain",
    receiver_account_id: {
      id: "114619409398949375",
      name: "Trần Thị B",
      email: "test2@example.com"
    },
    activity_id: "112240909630381156",
    activity_class_name: "Page",
    reason: "Nội dung không phù hợp",
    descriptions: "Tôi không làm gì vi phạm, sao lại khóa Trang của tôi."
  },
  {
    type: "post_complain",
    receiver_account_id: {
      id: "114619409398949376",
      name: "Lê Văn C",
      email: "test3@example.com"
    },
    activity_id: "112240909630381157",
    activity_class_name: "Post",
    descriptions: "Tôi không làm gì vi phạm, sao lại khóa Post của tôi."
  },
  {
    type: "invalid_type",
    receiver_account_id: {
      id: "114619409398949377",
      name: "Invalid User",
      email: "invalid@example.com"
    },
    activity_id: "112240909630381158",
    activity_class_name: "Test",
    descriptions: "This should fail parsing"
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
  } else {
    console.log('❌ Message could not be parsed');
  }
});

// Test edge cases
console.log('\n🔍 Testing edge cases...');

// Test null buffer
console.log('\n📝 Test null buffer:');
const nullResult = parseMessage(null);
console.log('Result:', nullResult);

// Test invalid JSON
console.log('\n📝 Test invalid JSON:');
const invalidJson = Buffer.from('invalid json');
const invalidResult = parseMessage(invalidJson);
console.log('Result:', invalidResult);

// Test empty object
console.log('\n📝 Test empty object:');
const emptyObject = Buffer.from('{}');
const emptyResult = parseMessage(emptyObject);
console.log('Result:', emptyResult);

console.log('\n✅ Test completed!');
