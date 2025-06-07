
import { db } from './server/db.js';
import { supportRequests } from './shared/schema.js';

async function createVerificationTestData() {
  try {
    console.log('Creating verification test data...');
    
    const testData = [
      {
        full_name: { id: "114634365996976140", name: "Nguyễn Văn An" },
        email: "nguyenvanan@gmail.com",
        subject: "Yêu cầu xác minh danh tính",
        content: "Tôi muốn xác minh danh tính của mình để tăng độ tin cậy trên nền tảng.",
        type: "verify" as const,
        status: "pending" as const,
        verification_name: "Nguyễn Văn An",
        phone_number: "0912345678",
        attachment_url: JSON.stringify([
          "https://example.com/cmnd-front.jpg",
          "https://example.com/cmnd-back.jpg"
        ]),
        created_at: new Date('2025-06-07T02:00:00.000Z'),
        updated_at: new Date('2025-06-07T02:00:00.000Z')
      },
      {
        full_name: { id: "114634366001234567", name: "Trần Thị Bình" },
        email: "tranthibinh@gmail.com",
        subject: "Xác minh tài khoản doanh nghiệp",
        content: "Cần xác minh tài khoản để sử dụng các tính năng dành cho doanh nghiệp.",
        type: "verify" as const,
        status: "processing" as const,
        verification_name: "Trần Thị Bình",
        phone_number: "0987654321",
        attachment_url: JSON.stringify([
          "https://example.com/business-license.pdf",
          "https://example.com/id-card.jpg"
        ]),
        assigned_to_id: 2,
        assigned_at: new Date('2025-06-07T01:30:00.000Z'),
        created_at: new Date('2025-06-07T01:00:00.000Z'),
        updated_at: new Date('2025-06-07T01:30:00.000Z')
      },
      {
        full_name: { id: "114634366007890123", name: "Lê Minh Cường" },
        email: "leminhcuong@gmail.com",
        subject: "Yêu cầu xác minh nhà sáng tạo nội dung",
        content: "Tôi là nhà sáng tạo nội dung và muốn được xác minh để có thể kiếm tiền từ nội dung.",
        type: "verify" as const,
        status: "completed" as const,
        verification_name: "Lê Minh Cường",
        phone_number: "0901234567",
        attachment_url: JSON.stringify([
          "https://example.com/creator-portfolio.pdf",
          "https://example.com/id-verification.jpg"
        ]),
        assigned_to_id: 1,
        assigned_at: new Date('2025-06-06T20:00:00.000Z'),
        response_content: "Yêu cầu xác minh đã được xử lý thành công. Tài khoản của bạn đã được xác minh.",
        responder_id: 1,
        response_time: new Date('2025-06-06T22:30:00.000Z'),
        created_at: new Date('2025-06-06T20:00:00.000Z'),
        updated_at: new Date('2025-06-06T22:30:00.000Z')
      },
      {
        full_name: { id: "114634366012345678", name: "Phạm Thị Diệu" },
        email: "phamthidieu@gmail.com",
        subject: "Xác minh tài khoản cá nhân",
        content: "Cần xác minh để sử dụng đầy đủ các tính năng của nền tảng.",
        type: "verify" as const,
        status: "pending" as const,
        verification_name: "Phạm Thị Diệu",
        phone_number: "0976543210",
        attachment_url: JSON.stringify([
          "https://example.com/selfie-with-id.jpg"
        ]),
        created_at: new Date('2025-06-07T03:00:00.000Z'),
        updated_at: new Date('2025-06-07T03:00:00.000Z')
      },
      {
        full_name: { id: "114634366018901234", name: "Hoàng Văn Emso" },
        email: "hoangvanemso@gmail.com",
        subject: "Yêu cầu xác minh influencer",
        content: "Tôi có nhiều follower và muốn được xác minh để tăng uy tín.",
        type: "verify" as const,
        status: "processing" as const,
        verification_name: "Hoàng Văn Emso",
        phone_number: "0965432109",
        attachment_url: JSON.stringify([
          "https://example.com/social-media-stats.pdf",
          "https://example.com/identity-proof.jpg",
          "https://example.com/brand-collaboration.pdf"
        ]),
        assigned_to_id: 3,
        assigned_at: new Date('2025-06-07T02:30:00.000Z'),
        created_at: new Date('2025-06-07T02:00:00.000Z'),
        updated_at: new Date('2025-06-07T02:30:00.000Z')
      },
      {
        full_name: "Nguyễn Thị Giang", // Test with string format
        email: "nguyenthigiang@gmail.com",
        subject: "Xác minh tài khoản giáo viên",
        content: "Tôi là giáo viên và muốn được xác minh để chia sẻ nội dung giáo dục.",
        type: "verify" as const,
        status: "completed" as const,
        verification_name: "Nguyễn Thị Giang",
        phone_number: "0954321098",
        attachment_url: null, // Test with no attachment
        assigned_to_id: 2,
        assigned_at: new Date('2025-06-06T18:00:00.000Z'),
        response_content: "Đã xác minh thành công tài khoản giáo viên. Chúc bạn chia sẻ nhiều nội dung bổ ích.",
        responder_id: 2,
        response_time: new Date('2025-06-06T19:45:00.000Z'),
        created_at: new Date('2025-06-06T18:00:00.000Z'),
        updated_at: new Date('2025-06-06T19:45:00.000Z')
      }
    ];

    // Insert test data
    const inserted = await db.insert(supportRequests).values(testData).returning();
    
    console.log(`✅ Successfully created ${inserted.length} verification test records:`);
    inserted.forEach(record => {
      console.log(`- ID: ${record.id}, Name: ${record.verification_name}, Status: ${record.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating verification test data:', error);
  } finally {
    process.exit(0);
  }
}

createVerificationTestData();
