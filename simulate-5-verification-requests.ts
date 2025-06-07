
import { db } from './server/db';
import { users, supportRequests } from './shared/schema';
import { and, ne, eq, desc } from 'drizzle-orm';

// Interface for verification message (matching kafka-consumer.ts)
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
}

async function processVerificationMessage(message: VerificationMessage) {
  return await db.transaction(async (tx) => {
    try {
      // Validate required fields
      if (!message.id || !message.full_name || !message.email || !message.type) {
        console.log(`❌ Invalid verification message: ${JSON.stringify(message)}`);
        return;
      }

      // Check for duplicate verification request based on email and type
      const existingRequest = await tx
        .select()
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.email, message.email),
            eq(supportRequests.type, "verify")
          )
        )
        .limit(1);

      if (existingRequest.length > 0) {
        console.log(`⚠️ Verification request for ${message.email} already exists, skipping...`);
        return existingRequest[0];
      }

      console.log(`🔍 Processing verification message: ${message.full_name} (${message.email})`);

      // Get active users (exclude admin for verification assignment)
      const activeUsers = await tx
        .select()
        .from(users)
        .where(and(eq(users.status, "active"), ne(users.role, "admin")));

      if (!activeUsers || activeUsers.length === 0) {
        console.log("❌ No active non-admin users found to assign verification.");
        return;
      }

      console.log(`👥 Found ${activeUsers.length} active users for verification assignment`);

      // Find last assigned VERIFICATION REQUEST for round-robin (specific to type='verify')
      const lastAssignedVerificationRequest = await tx.query.supportRequests.findFirst({
        where: eq(supportRequests.type, 'verify'),
        orderBy: (supportRequests, { desc }) => [
          desc(supportRequests.assigned_at),
        ],
      });

      // Calculate next assignee (round-robin) based on verification requests only
      let nextAssigneeIndex = 0;
      if (lastAssignedVerificationRequest && lastAssignedVerificationRequest.assigned_to_id) {
        const lastAssigneeIndex = activeUsers.findIndex(
          (user) => user.id === lastAssignedVerificationRequest.assigned_to_id,
        );
        if (lastAssigneeIndex !== -1) {
          nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
        }
      }

      const assigned_to_id = activeUsers[nextAssigneeIndex].id;
      const now = new Date();

      // Prepare full_name as JSON object format
      const fullNameObj = {
        id: message.id,
        name: message.full_name
      };

      // Prepare insert data with type='verify' and verification-specific fields
      const insertData = {
        full_name: fullNameObj,
        email: message.email,
        subject: message.subject || "Yêu cầu xác minh danh tính",
        content: message.detailed_description || "Yêu cầu xác minh danh tính từ người dùng",
        status: "pending" as const,
        type: "verify" as const, // Explicitly set type
        verification_name: message.verification_name || message.full_name,
        phone_number: message.phone_number || null,
        attachment_url: message.attachment_url ? JSON.stringify(message.attachment_url) : null,
        assigned_to_id,
        assigned_at: now,
        created_at: now,
        updated_at: now,
      };

      // Insert into DB
      const newRequest = await tx
        .insert(supportRequests)
        .values(insertData)
        .returning();

      console.log(`✅ Verification request created with ID ${newRequest[0].id}`);
      console.log(`👤 Assigned to user ID ${assigned_to_id} (${activeUsers.find(u => u.id === assigned_to_id)?.name})`);
      console.log(`📧 Email: ${message.email}, Name: ${message.full_name}`);

      return newRequest[0];
    } catch (error) {
      console.error(`❌ Error processing verification message: ${error}`);
      throw error;
    }
  });
}

async function simulate5VerificationRequests() {
  try {
    console.log('🚀 Starting simulation of 5 verification requests...');

    const verificationMessages: VerificationMessage[] = [
      {
        id: "114640001234567890",
        full_name: "Nguyễn Văn Minh",
        email: "nguyenvanminh@gmail.com",
        subject: "Yêu cầu xác minh danh tính cá nhân",
        type: "verify",
        verification_name: "Nguyễn Văn Minh",
        phone_number: "0912345678",
        detailed_description: "Tôi muốn xác minh danh tính để có thể sử dụng đầy đủ các tính năng của nền tảng và tăng độ tin cậy.",
        attachment_url: [
          "https://example.com/cmnd-front-minh.jpg",
          "https://example.com/cmnd-back-minh.jpg",
          "https://example.com/selfie-minh.jpg"
        ]
      },
      {
        id: "114640002345678901",
        full_name: "Trần Thị Hương",
        email: "tranthihuong@gmail.com",
        subject: "Xác minh tài khoản kinh doanh",
        type: "verify",
        verification_name: "Trần Thị Hương",
        phone_number: "0987654321",
        detailed_description: "Cần xác minh tài khoản để có thể đăng bán sản phẩm và sử dụng tính năng kinh doanh.",
        attachment_url: [
          "https://example.com/business-license-huong.pdf",
          "https://example.com/id-card-huong.jpg"
        ]
      },
      {
        id: "114640003456789012",
        full_name: "Lê Hoàng Nam",
        email: "lehoangnam@gmail.com",
        subject: "Yêu cầu xác minh content creator",
        type: "verify",
        verification_name: "Lê Hoàng Nam",
        phone_number: "0901234567",
        detailed_description: "Tôi là content creator với 50K+ followers, muốn được xác minh để tăng uy tín và có thể kiếm tiền từ nội dung.",
        attachment_url: [
          "https://example.com/social-stats-nam.pdf",
          "https://example.com/creator-portfolio-nam.jpg",
          "https://example.com/id-verification-nam.jpg"
        ]
      },
      {
        id: "114640004567890123",
        full_name: "Phạm Văn Đức",
        email: "phamvanduc@gmail.com",
        subject: "Xác minh tài khoản giáo viên",
        type: "verify",
        verification_name: "Phạm Văn Đức",
        phone_number: "0976543210",
        detailed_description: "Tôi là giáo viên muốn được xác minh để chia sẻ nội dung giáo dục và tham gia các chương trình đào tạo.",
        attachment_url: [
          "https://example.com/teacher-certificate-duc.pdf",
          "https://example.com/id-card-duc.jpg"
        ]
      },
      {
        id: "114640005678901234",
        full_name: "Vũ Thị Lan",
        email: "vuthilan@gmail.com",
        subject: "Yêu cầu xác minh influencer",
        type: "verify",
        verification_name: "Vũ Thị Lan",
        phone_number: "0965432109",
        detailed_description: "Tôi là beauty influencer với nhiều followers, muốn được xác minh để hợp tác với các thương hiệu.",
        attachment_url: "https://example.com/influencer-profile-lan.jpg"
      }
    ];

    console.log(`📝 Prepared ${verificationMessages.length} verification messages`);

    // Process each verification message
    for (let i = 0; i < verificationMessages.length; i++) {
      const message = verificationMessages[i];
      
      try {
        console.log(`\n🔄 Processing verification request ${i + 1}/${verificationMessages.length}`);
        console.log(`👤 Name: ${message.full_name}`);
        console.log(`📧 Email: ${message.email}`);
        
        await processVerificationMessage(message);
        
        // Wait 1 second between requests to avoid conflicts
        if (i < verificationMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Failed to process verification request ${i + 1}:`, error);
      }
    }

    console.log('\n🎉 Completed simulation of 5 verification requests');
    
    // Show summary
    const totalVerificationRequests = await db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.type, "verify"));
      
    console.log(`\n📊 Summary:`);
    console.log(`✅ Total verification requests in database: ${totalVerificationRequests.length}`);
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

// Run simulation
simulate5VerificationRequests()
  .then(() => {
    console.log('🎯 Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Script failed:', err);
    process.exit(1);
  });
