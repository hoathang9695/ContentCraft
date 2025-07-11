
import { db } from "./server/db.js";
import { reportManagement, users } from "./shared/schema.js";
import { eq, ne, and } from "drizzle-orm";

interface ReportMessage {
  reportType: 'recruit';
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

async function testRecruitReport() {
  console.log('🚀 Testing RECRUIT report type...\n');

  try {
    // Sample recruit report message
    const recruitReportMsg: ReportMessage = {
      reportType: "recruit",
      reported_id: {
        id: "2011", // ID của bài đăng tuyển dụng bị báo cáo
        name: "EMSO Tuyển dụng", // Tên tài khoản hoặc đơn vị đăng tin
        email: "hr@emso.vn", // Email của bên bị báo cáo
      },
      reporterName: {
        id: "113728047353123126", // ID của người báo cáo
        name: "Hoàng Khoa", // Tên người báo cáo
        reporterEmail: "testeremso@gmail.com", // Email người báo cáo
      },
      reason: "Tự tử hoặc gây thương tích", // Lý do chính
      detailedReason: "123", // Mô tả chi tiết lý do báo cáo
    };

    console.log('📝 Processing recruit report:', JSON.stringify(recruitReportMsg, null, 2));

    // Get active users for round-robin assignment (exclude admin)
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("❌ No active non-admin users found for assignment");
    }

    console.log(`👥 Found ${activeUsers.length} active non-admin users`);

    // Get last assigned REPORT for round-robin (specific to reportManagement table)
    const lastAssignedReport = await db.query.reportManagement.findFirst({
      orderBy: (reportManagement, { desc }) => [desc(reportManagement.createdAt)]
    });

    // Calculate next assignee index based on reports table
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

    // Prepare insert data
    const insertData = {
      reportedId: recruitReportMsg.reported_id,
      reportType: recruitReportMsg.reportType,
      reporterName: recruitReportMsg.reporterName,
      reason: recruitReportMsg.reason,
      detailedReason: recruitReportMsg.detailedReason || null,
      status: 'pending' as const,
      assignedToId: assignedToId,
      assignedToName: assignedUser.name,
      assignedAt: now,
      createdAt: now,
      updatedAt: now
    };

    console.log(`📝 Inserting recruit report data: ${JSON.stringify(insertData, null, 2)}`);

    // Insert new recruit report
    const result = await db.insert(reportManagement).values(insertData).returning();

    if (!result || result.length === 0) {
      throw new Error("❌ Failed to insert recruit report - no result returned");
    }

    console.log(`✅ Successfully inserted recruit report: ID ${result[0].id}, ReportedID: ${recruitReportMsg.reported_id.id}, AssignedTo: ${assignedUser.name}`);

    // Verify the report was created
    const createdReport = await db
      .select()
      .from(reportManagement)
      .where(eq(reportManagement.id, result[0].id))
      .limit(1);

    if (createdReport.length > 0) {
      console.log('\n📋 Created report details:');
      console.log(`   ID: ${createdReport[0].id}`);
      console.log(`   Type: ${createdReport[0].reportType}`);
      console.log(`   Reported ID: ${JSON.stringify(createdReport[0].reportedId)}`);
      console.log(`   Reporter: ${JSON.stringify(createdReport[0].reporterName)}`);
      console.log(`   Reason: ${createdReport[0].reason}`);
      console.log(`   Status: ${createdReport[0].status}`);
      console.log(`   Assigned to: ${createdReport[0].assignedToName}`);
    }

    console.log('\n🎉 Recruit report test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing recruit report:', error);
    throw error;
  }
}

// Run the test
testRecruitReport()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
