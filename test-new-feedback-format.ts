
import { db } from './server/db.js';
import { supportRequests } from './shared/schema.js';

async function testNewFeedbackFormat() {
  console.log('🧪 Testing new feedback message format...\n');

  const testMessage = {
    "id": "113725869733725553",
    "full_name": "Bùi Ngọc Tự",
    "email": "tubn@emso.vn",
    "subject": "contribution",
    "type": "feedback",
    "feature_type": "Bảng tin điều khiển chuyên nghiệp",
    "detailed_description": "kokokokooookoko",
    "attachment_url": [
      "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/634/369/326/923/155/original/f04b8e1e3ec5d9ab.jpg"
    ]
  };

  try {
    // Import and test the processFeedbackMessage function
    const { processFeedbackMessage } = await import('./server/kafka-consumer.js');
    
    await db.transaction(async (tx) => {
      const result = await processFeedbackMessage(testMessage, tx);
      console.log('✅ Test feedback message processed successfully:');
      console.log(`   ID: ${result.id}`);
      console.log(`   Full Name: ${JSON.stringify(result.full_name)}`);
      console.log(`   Email: ${result.email}`);
      console.log(`   Subject: ${result.subject}`);
      console.log(`   Feature Type: ${result.feature_type}`);
      console.log(`   Attachment URL: ${result.attachment_url}`);
    });

    console.log('\n🎉 New feedback format test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testNewFeedbackFormat()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
