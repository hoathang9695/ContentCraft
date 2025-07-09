import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq, ne, and } from "drizzle-orm";

interface ReportMessage {
  reportType: "user" | "page" | "group" | "content" | "comment" | "post";
  reported_id: {
    id: string;
    name?: string;
    email?: string;
  };
  reporterName: {
    id: string;
    name: string;
    reporterEmail: string;
  };
  reason: string;
  detailedReason: string;
}

async function processReportMessage(message: ReportMessage) {
  console.log(`🔄 Processing report message: ${JSON.stringify(message)}`);

  try {
    // Get active users for round-robin assignment
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("No active non-admin users found for assignment");
    }

    console.log(`👥 Found ${activeUsers.length} active users for assignment`);

    // Simulate round-robin assignment (simple random for demo)
    const randomIndex = Math.floor(Math.random() * activeUsers.length);
    const assignedUser = activeUsers[randomIndex];

    console.log(
      `👤 Assigned to user: ${assignedUser.name} (ID: ${assignedUser.id})`,
    );

    // Insert into report_management table
    const insertData = {
      reportedId: message.reported_id,
      reportType: message.reportType,
      reporterName: message.reporterName,
      reason: message.reason,
      detailedReason: message.detailedReason,
      status: "pending" as const,
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      assignedAt: new Date(),
    };

    // Import the schema
    const { reportManagement } = await import("./shared/schema");

    const insertedReport = await db
      .insert(reportManagement)
      .values(insertData)
      .returning();

    console.log(`✅ Report inserted into database:`, insertedReport[0]);
    return insertedReport[0];
  } catch (error) {
    console.error(`❌ Error processing report message: ${error}`);
    throw error;
  }
}

async function simulateReportKafkaMessages() {
  console.log("🚀 Starting Report Management Kafka simulation...\n");

  try {
    // Test messages for different report types with new format
    const testMessages: ReportMessage[] = [
      // REPORT USER
      {
        reportType: "user", // Report type
        reported_id: {
          id: "114619409398949374", // ID của người dùng bị báo cáo
          name: "Nguyễn Văn Spam", // Tên người dùng bị báo cáo
          email: "spam.user@example.com", // Email người dùng bị báo cáo
        },
        reporterName: {
          id: "1749539951001", // ID của người báo cáo
          name: "Nguyễn Văn An", // Tên người báo cáo
          reporterEmail: "an.nguyen@example.com", // Email người báo cáo
        },
        reason: "Spam tin nhắn", // Lý do báo cáo
        detailedReason:
          "Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác.", // Chi tiết lý do báo cáo
      },
      //  REPORT PAGE
      {
        reportType: "page", // Report type
        reported_id: {
          id: "108277159419233203", // ID của trang bị báo cáo
          name: "Nhịp sống số ", // Tên trang bị báo cáo
          email: "abcd@gmail.com", // Email của Admin trang bị báo cáo
        },
        reporterName: {
          id: "1749539951002", // ID của người báo cáo
          name: "Trần Thị Bình", // Tên người báo cáo
          reporterEmail: "binh.tran@example.com", // Email người báo cáo
        },
        reason: "Vi phạm bản quyền",
        detailedReason:
          "Trang này đăng tải nhiều hình ảnh có bản quyền mà không có sự cho phép.",
      },
      // REPORT GROUP
      {
        reportType: "group",
        reported_id: {
          id: "108277159419233203", // ID của nhóm bị báo cáo
          name: "Nhóm Chơi Bài", // Tên nhóm bị báo cáo
          email: "abcd@gmail.com", // Email của Admin Nhóm  bị báo cáo
        },
        reporterName: {
          id: "1749539951003", // ID của người báo cáo
          name: "Lê Minh Cường", // Tên người báo cáo
          reporterEmail: "cuong.le@example.com", // Email người báo cáo
        },
        reason: "Nội dung độc hại",
        detailedReason:
          "Nhóm này chia sẻ các nội dung có tính chất bạo lực và kích động thù địch.",
      },
      // REPORT CONTENT
      {
        reportType: "content",
        reported_id: {
          id: "114821570886318707", // ID của nội dung bị báo cáo
          name: "Nguyễn Văn A", // Tên người dùng đăng nội dung'
          email: "content.user@example.com", // Email người dùng đăng nội dung
        },
        reporterName: {
          id: "1749539951004", // ID của người báo cáo
          name: "Phạm Thị Dung", // Tên người báo cáo
          reporterEmail: "dung.pham@example.com", // Email người báo cáo
        },
        reason: "Lừa đảo tài chính",
        detailedReason:
          "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
      },
      // REPORT COURSE
      {
        reportType: "course",
        reported_id: {
          id: "114821570886318707", // ID của course bị báo cáo
          name: "Nguyễn Văn A", // Tên người dùng đăng course
          email: "course.user@example.com", // Email người dùng đăng nội dung
        },
        reporterName: {
          id: "1749539951004", // ID của người báo cáo
          name: "Phạm Thị Dung", // Tên người báo cáo
          reporterEmail: "dung.pham@example.com", // Email người báo cáo
        },
        reason: "Lừa đảo tài chính",
        detailedReason:
          "Khóa học này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
      },
      // REPORT PROJECT
      {
        reportType: "project",
        reported_id: {
          id: "114821570886318707", // ID của Project bị báo cáo
          name: "Nguyễn Văn A", // Tên người dùng đăng Project'
          email: "project.user@example.com", // Email người dùng đăng Projetc
        },
        reporterName: {
          id: "1749539951004", // ID của người báo cáo
          name: "Phạm Thị Dung", // Tên người báo cáo
          reporterEmail: "dung.pham@example.com", // Email người báo cáo
        },
        reason: "Lừa đảo tài chính",
        detailedReason:
          "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
      },
      // REPORT SONG
      {
        reportType: "song",
        reported_id: {
          id: "114821570886318707", // ID của song bị báo cáo
          name: "Nguyễn Văn A", // Tên người dùng đăng song'
          email: "content.user@example.com", // Email người dùng đăng song
        },
        reporterName: {
          id: "1749539951004", // ID của người báo cáo
          name: "Phạm Thị Dung", // Tên người báo cáo
          reporterEmail: "dung.pham@example.com", // Email người báo cáo
        },
        reason: "Lừa đảo tài chính",
        detailedReason:
          "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
      },
      // REPORT EVENT
      {
        reportType: "event",
        reported_id: {
          id: "114821570886318707", // ID của event bị báo cáo
          name: "Nguyễn Văn A", // Tên người dùng đăng event'
          email: "event.user@example.com", // Email người dùng đăng event
        },
        reporterName: {
          id: "1749539951004", // ID của người báo cáo
          name: "Phạm Thị Dung", // Tên người báo cáo
          reporterEmail: "dung.pham@example.com", // Email người báo cáo
        },
        reason: "Lừa đảo tài chính",
        detailedReason:
          "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
      },

      // REPORT COMMENT
      {
        reportType: "comment",
        reported_id: {
          id_post: "114619409398949374", // ID của bài viết bị báo cáo
          id_comment: "123456090907890", // ID của bình luận bị báo cáo
          name: "Nguyễn Văn A", // Tên người dùng bình luận vi phạm
          email: "comment.user@example.com", // Email người dùng bình luận vi phạm
          content: "Đây là nội dung bình luận đáng lên án.", // Nội dung bình luận vi phạm
        },
        reporterName: {
          id: "1749539951005", // ID của người báo cáo
          name: "Hoàng Văn Em", // Tên người báo cáo
          reporterEmail: "em.hoang@example.com", // Email người báo cáo
        },
        reason: "Quấy rối tình dục",
        detailedReason:
          "Bình luận này chứa nội dung quấy rối tình dục và không phù hợp.",
      },
    ];

    console.log(`📝 Processing ${testMessages.length} report messages...\n`);

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`--- Processing message ${i + 1}/${testMessages.length} ---`);

      try {
        await processReportMessage(message);
        console.log(`✅ Message ${i + 1} processed successfully\n`);

        // Wait 1 second between messages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`⚠️ Failed to process message ${i + 1}:`, error);
      }
    }

    console.log("🎉 Completed Report Management Kafka simulation");
  } catch (error) {
    console.error("❌ Simulation failed:", error);
    process.exit(1);
  }
}

// Run simulation
simulateReportKafkaMessages()
  .then(() => {
    console.log("\n✨ Script completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });
