
import { db } from './server/db';
import { users, reportManagement } from './shared/schema';
import { eq, ne, and } from 'drizzle-orm';

interface ReportMessage {
  reportId: string;
  reportType: 'user' | 'content' | 'page' | 'group' | 'comment' | 'course' | 'project' | 'video' | 'song' | 'event';
  reporterName: {
    id: string;
    name: string;
  };
  reporterEmail: string;
  reason: string;
  detailedReason: string;
}

async function processReportMessage(message: ReportMessage) {
  console.log(`🔄 Processing report message: ${JSON.stringify(message, null, 2)}`);

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

    // Get last assigned report for round-robin
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
    console.log(`👤 Assigned to user: ${assignedUser.name} (ID: ${assignedUser.id})`);

    // Insert into report_management table
    const insertData = {
      reportedId: {
        id: message.reportId
      },
      reportType: message.reportType,
      reporterName: message.reporterName,
      reporterEmail: message.reporterEmail,
      reason: message.reason,
      detailedReason: message.detailedReason,
      status: 'pending' as const,
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      assignedAt: new Date()
    };

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

async function testSingleReportMessage() {
  console.log('🚀 Testing single report message...\n');

  try {
    // Your test message
    const testMessage: ReportMessage = {
      reportId: "114619409398949374",
      reportType: "user",
      reporterName: {
        id: "1749539951001",
        name: "Nguyễn Văn Khuê"
      },
      reporterEmail: "khue.nguyen@example.com",
      reason: "Spam tin nhắn",
      detailedReason: "Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác."
    };

    console.log('📝 Processing test message...\n');
    
    await processReportMessage(testMessage);
    
    console.log('\n🎉 Test completed successfully!');

    // Show current total reports in DB
    const totalReports = await db.select().from(reportManagement);
    console.log(`📊 Total reports in DB: ${totalReports.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testSingleReportMessage()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
