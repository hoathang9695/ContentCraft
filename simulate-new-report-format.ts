
import { db } from "./server/db";
import { users, reportManagement } from "./shared/schema";
import { eq, ne, and } from "drizzle-orm";

interface ReportMessage {
  reportType: 'user' | 'content' | 'page' | 'group' | 'comment' | 'course' | 'project' | 'song' | 'event';
  reported_id: {
    id?: string;
    name?: string;
    email?: string;
    // Special fields for comment reports
    id_post?: string;
    id_comment?: string;
    content?: string;
  };
  reporterName: {
    id: string;
    name: string;
    reporterEmail: string;
  };
  reason: string;
  detailedReason?: string;
}

async function processReportMessage(message: ReportMessage) {
  try {
    console.log(`🔄 Processing report message: ${JSON.stringify(message)}`);

    // Get active users for round-robin assignment (exclude admin)
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("No active non-admin users found for assignment");
    }

    console.log(`👥 Found ${activeUsers.length} active non-admin users`);

    // Get last assigned REPORT for round-robin
    const lastAssignedReport = await db.query.reportManagement.findFirst({
      orderBy: (reportManagement, { desc }) => [desc(reportManagement.createdAt)]
    });

    // Calculate next assignee index
    let nextAssigneeIndex = 0;
    if (lastAssignedReport && lastAssignedReport.assignedToId) {
      const lastAssigneeIndex = activeUsers.findIndex(
        user => user.id === lastAssignedReport.assignedToId
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assignedUser = activeUsers[nextAssigneeIndex];
    const now = new Date();

    // Prepare insert data
    const insertData = {
      reportedId: message.reported_id,
      reportType: message.reportType,
      reporterName: message.reporterName,
      reason: message.reason,
      detailedReason: message.detailedReason || null,
      status: "pending" as const,
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`📝 Inserting report data for ${assignedUser.name}`);

    // Insert new report
    const result = await db
      .insert(reportManagement)
      .values(insertData)
      .returning();

    const reportedObjectId = message.reportType === 'comment' 
      ? `${message.reported_id.id_post}_${message.reported_id.id_comment}`
      : message.reported_id.id;

    console.log(
      `✅ Successfully inserted report: ID ${result[0].id}, ReportType: ${message.reportType}, ReportedObjectID: ${reportedObjectId}, AssignedTo: ${assignedUser.name}`,
    );
    return result[0];
  } catch (error) {
    console.error(`❌ Error processing report message: ${error}`);
    throw error;
  }
}

async function simulateNewReportFormat() {
  console.log("🚀 Starting Report Management simulation with new format...");

  const reportMessages: ReportMessage[] = [
    // 1. REPORT USER
    {
      reportType: "user",
      reported_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn Spam",
        email: "spam.user@example.com",
      },
      reporterName: {
        id: "1749539951001",
        name: "Nguyễn Văn An",
        reporterEmail: "an.nguyen@example.com",
      },
      reason: "Spam tin nhắn",
      detailedReason: "Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác.",
    },
    
    // 2. REPORT PAGE
    {
      reportType: "page",
      reported_id: {
        id: "108277159419233203",
        name: "Nhịp sống số",
        email: "abcd@gmail.com",
      },
      reporterName: {
        id: "1749539951002",
        name: "Trần Thị Bình",
        reporterEmail: "binh.tran@example.com",
      },
      reason: "Vi phạm bản quyền",
      detailedReason: "Trang này đăng tải nhiều hình ảnh có bản quyền mà không có sự cho phép.",
    },

    // 3. REPORT GROUP
    {
      reportType: "group",
      reported_id: {
        id: "108277159419233203",
        name: "Nhóm Chơi Bài",
        email: "abcd@gmail.com",
      },
      reporterName: {
        id: "1749539951003",
        name: "Lê Minh Cường",
        reporterEmail: "cuong.le@example.com",
      },
      reason: "Nội dung độc hại",
      detailedReason: "Nhóm này chia sẻ các nội dung có tính chất bạo lực và kích động thù địch.",
    },

    // 4. REPORT CONTENT
    {
      reportType: "content",
      reported_id: {
        id: "114821570886318707",
        name: "Nguyễn Văn A",
        email: "content.user@example.com",
      },
      reporterName: {
        id: "1749539951004",
        name: "Phạm Thị Dung",
        reporterEmail: "dung.pham@example.com",
      },
      reason: "Lừa đảo tài chính",
      detailedReason: "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
    },

    // 5. REPORT COURSE
    {
      reportType: "course",
      reported_id: {
        id: "114821570886318707",
        name: "Nguyễn Văn A",
        email: "course.user@example.com",
      },
      reporterName: {
        id: "1749539951004",
        name: "Phạm Thị Dung",
        reporterEmail: "dung.pham@example.com",
      },
      reason: "Lừa đảo tài chính",
      detailedReason: "Khóa học này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
    },

    // 6. REPORT PROJECT
    {
      reportType: "project",
      reported_id: {
        id: "114821570886318707",
        name: "Nguyễn Văn A",
        email: "project.user@example.com",
      },
      reporterName: {
        id: "1749539951004",
        name: "Phạm Thị Dung",
        reporterEmail: "dung.pham@example.com",
      },
      reason: "Lừa đảo tài chính",
      detailedReason: "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
    },

    // 7. REPORT SONG
    {
      reportType: "song",
      reported_id: {
        id: "114821570886318707",
        name: "Nguyễn Văn A",
        email: "content.user@example.com",
      },
      reporterName: {
        id: "1749539951004",
        name: "Phạm Thị Dung",
        reporterEmail: "dung.pham@example.com",
      },
      reason: "Lừa đảo tài chính",
      detailedReason: "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
    },

    // 8. REPORT EVENT
    {
      reportType: "event",
      reported_id: {
        id: "114821570886318707",
        name: "Nguyễn Văn A",
        email: "event.user@example.com",
      },
      reporterName: {
        id: "1749539951004",
        name: "Phạm Thị Dung",
        reporterEmail: "dung.pham@example.com",
      },
      reason: "Lừa đảo tài chính",
      detailedReason: "Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.",
    },

    // 9. REPORT COMMENT
    {
      reportType: "comment",
      reported_id: {
        id_post: "114619409398949374",
        id_comment: "123456090907890",
        name: "Nguyễn Văn A",
        email: "comment.user@example.com",
        content: "Đây là nội dung bình luận đáng lên án.",
      },
      reporterName: {
        id: "1749539951005",
        name: "Hoàng Văn Em",
        reporterEmail: "em.hoang@example.com",
      },
      reason: "Quấy rối tình dục",
      detailedReason: "Bình luận này chứa nội dung quấy rối tình dục và không phù hợp.",
    },
  ];

  try {
    for (const message of reportMessages) {
      await processReportMessage(message);
      // Small delay between insertions
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("✅ All report messages processed successfully!");
  } catch (error) {
    console.error("❌ Error in simulation:", error);
  } finally {
    process.exit(0);
  }
}

// Run the simulation
simulateNewReportFormat();
