
import { db } from './server/db.js';
import { reportManagement, users } from './shared/schema.js';
import { eq, ne, and } from 'drizzle-orm';

interface NewReportMessage {
  reportType: 'user' | 'content' | 'page' | 'group' | 'comment' | 'course' | 'project' | 'video' | 'song' | 'event';
  reported_id: {
    id: string;
    name: string;
    email: string;
  };
  reporterName: {
    id: string;
    name: string;
    reporterEmail: string;
  };
  reason: string;
  detailedReason?: string;
}

async function processNewReportMessage(message: NewReportMessage) {
  try {
    console.log(`🔄 Processing new format report message: ${JSON.stringify(message, null, 2)}`);

    // Validate required fields
    if (!message.reported_id?.id || !message.reportType || !message.reporterName?.id || !message.reporterName?.reporterEmail || !message.reason) {
      throw new Error(`❌ Invalid report message format - missing required fields`);
    }

    // Get active users for round-robin assignment (exclude admin)
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("❌ No active non-admin users found for assignment");
    }

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

    const assignedToId = activeUsers[nextAssigneeIndex].id;
    const assignedUser = activeUsers[nextAssigneeIndex];
    const now = new Date();

    console.log(`👤 Assigned to user: ${assignedUser.name} (ID: ${assignedToId})`);

    // Prepare insert data with new format
    const insertData = {
      reportedId: message.reported_id,
      reportType: message.reportType,
      reporterName: {
        id: message.reporterName.id,
        name: message.reporterName.name
      },
      reporterEmail: message.reporterName.reporterEmail,
      reason: message.reason,
      detailedReason: message.detailedReason || null,
      status: 'pending' as const,
      assignedToId: assignedToId,
      assignedToName: assignedUser.name,
      assignedAt: now,
      createdAt: now,
      updatedAt: now
    };

    console.log(`📝 Inserting report data: ${JSON.stringify(insertData, null, 2)}`);

    // Insert new report
    const result = await db.insert(reportManagement).values(insertData).returning();

    if (!result || result.length === 0) {
      throw new Error("❌ Failed to insert report - no result returned");
    }

    console.log(`✅ Successfully inserted report: ID ${result[0].id}, ReportedID: ${message.reported_id.id}, AssignedTo: ${assignedUser.name}`);
    return result[0];

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error processing report: ${errorMsg}`);
    throw error;
  }
}

async function testNewReportFormat() {
  console.log('🚀 Testing new report format...\n');

  try {
    // Test messages with new format
    const testMessages: NewReportMessage[] = [
      {
        reportType: "user",
        reported_id: { 
          id: "114619409398949374",
          name: "Nguyễn Văn A",
          email: "nguyenvana@gmail.com"
        },
        reporterName: {
          id: "1749539951001",
          name: "Nguyễn Văn An",
          reporterEmail: "an.nguyen@example.com"
        },
        reason: "Spam tin nhắn",
        detailedReason: "Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác."
      },
      {
        reportType: "page",
        reported_id: { 
          id: "PAGE_123456789",
          name: "Trang Kinh Doanh ABC",
          email: "contact@business-abc.com"
        },
        reporterName: {
          id: "1749539951002",
          name: "Trần Thị Bình",
          reporterEmail: "binh.tran@example.com"
        },
        reason: "Vi phạm bản quyền",
        detailedReason: "Trang này đăng tải nhiều hình ảnh có bản quyền mà không có sự cho phép."
      },
      {
        reportType: "content",
        reported_id: { 
          id: "CONTENT_987654321",
          name: "Bài viết về đầu tư",
          email: "author@investment.com"
        },
        reporterName: {
          id: "1749539951003",
          name: "Lê Minh Cường",
          reporterEmail: "cuong.le@example.com"
        },
        reason: "Thông tin sai lệch",
        detailedReason: "Bài viết này chứa thông tin đầu tư sai lệch và có thể gây thiệt hại cho người đọc."
      }
    ];

    console.log(`📝 Processing ${testMessages.length} test messages with new format...\n`);

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`--- Processing message ${i + 1}/${testMessages.length} ---`);
      
      try {
        await processNewReportMessage(message);
        console.log(`✅ Message ${i + 1} processed successfully\n`);
        
        // Wait 1 second between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`⚠️ Failed to process message ${i + 1}:`, error);
      }
    }

    console.log('🎉 Completed testing new report format');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testNewReportFormat().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
