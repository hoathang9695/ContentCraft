
import { db } from './server/db';
import { supportRequests } from './shared/schema';
import { eq } from 'drizzle-orm';

interface VerificationMessage {
  id: string;
  full_name: string;
  email: string;
  subject?: string;
  type: 'verify';
  verification_name?: string;
  phone_number?: string;
  detailed_description?: string;
  attachment_url?: string | string[];
  identity_verification_id?: number;
}

async function processVerificationMessage(message: VerificationMessage) {
  return await db.transaction(async (tx) => {
    try {
      console.log(`🔄 Processing verification message with identity_verification_id: ${message.identity_verification_id}`);
      
      // Check for duplicate based on identity_verification_id if provided
      if (message.identity_verification_id) {
        const existingByIdentityId = await tx
          .select()
          .from(supportRequests)
          .where(eq(supportRequests.identity_verification_id, message.identity_verification_id))
          .limit(1);

        if (existingByIdentityId.length > 0) {
          console.log(`⚠️ Verification request with identity_verification_id ${message.identity_verification_id} already exists, skipping...`);
          return existingByIdentityId[0];
        }
      }

      const fullNameObj = {
        id: message.id,
        name: message.full_name
      };

      const now = new Date();
      
      const insertData = {
        full_name: fullNameObj,
        email: message.email,
        subject: message.subject || "Yêu cầu xác minh danh tính",
        content: message.detailed_description || "Yêu cầu xác minh danh tính từ người dùng",
        status: "pending",
        type: "verify",
        verification_name: message.verification_name || message.full_name,
        phone_number: message.phone_number || null,
        attachment_url: message.attachment_url ? JSON.stringify(message.attachment_url) : null,
        identity_verification_id: message.identity_verification_id || null,
        assigned_to_id: 2, // Test assignment
        assigned_at: now,
        created_at: now,
        updated_at: now,
      };

      const result = await tx.insert(supportRequests).values(insertData).returning();
      console.log(`✅ Verification request created with ID ${result[0].id}, identity_verification_id: ${message.identity_verification_id}`);
      return result[0];
    } catch (error) {
      console.error(`❌ Error processing verification message:`, error);
      throw error;
    }
  });
}

async function testVerificationWithIdentityId() {
  console.log('🚀 Testing verification message with identity_verification_id...\n');
  
  const testMessage: VerificationMessage = {
    id: "114549561950399508",
    full_name: "Bùi Anh Tuấn",
    email: "bui.anh.r345@emso.vn",
    subject: "Yêu cầu xác minh danh tính cá nhân",
    type: "verify",
    verification_name: "Thử tý thôi",
    phone_number: "0987654321",
    detailed_description: "",
    identity_verification_id: 19069,
    attachment_url: [
      "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/754/554/188/644/517/original/9755ffa4b823c64b.jpg",
      "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/754/554/322/700/612/original/7e03bf7009c24e10.jpg",
      "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/754/554/667/533/142/original/98a17cd299a35b03.mp4"
    ]
  };

  try {
    await processVerificationMessage(testMessage);
    console.log('\n🎉 Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testVerificationWithIdentityId()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
