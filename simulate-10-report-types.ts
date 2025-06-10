import { db } from './server/db';
import { users, reportManagement } from './shared/schema';
import { eq, ne, and } from 'drizzle-orm';

interface ReportMessage {
  reportId: string;
  reportType: 'user' | 'page' | 'group' | 'content' | 'comment' | 'course' | 'project' | 'recruitment' | 'song' | 'event';
  reporterName: string;
  reporterEmail: string;
  reason: string;
  detailedReason: string;
  reportedTargetId: string;
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
        id: message.reportedTargetId
      },
      reportType: message.reportType,
      reporterName: {
        id: `reporter_${Date.now()}`,
        name: message.reporterName
      },
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

async function simulate10ReportTypes() {
  console.log('🚀 Starting comprehensive Report Management simulation with 10 types...\n');

  try {
    // Clean existing reports for fresh test
    console.log('🧹 Cleaning existing reports...');
    await db.delete(reportManagement);
    console.log('✅ Existing reports cleaned\n');

    // Create 10 different types of reports with varied content
    const testMessages: ReportMessage[] = [
      // 1. User Report - Spam
      {
        reportId: '1001',
        reportType: 'user',
        reporterName: 'Nguyễn Văn An',
        reporterEmail: 'an.nguyen@example.com',
        reason: 'Spam tin nhắn',
        detailedReason: 'Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác.',
        reportedTargetId: '114652263781752445'
      },

      // 2. Page Report - Copyright
      {
        reportId: '1002',
        reportType: 'page',
        reporterName: 'Trần Thị Bình',
        reporterEmail: 'binh.tran@example.com',
        reason: 'Vi phạm bản quyền',
        detailedReason: 'Trang này đăng tải nhiều hình ảnh có bản quyền mà không có sự cho phép.',
        reportedTargetId: 'PAGE_123456789'
      },

      // 3. Group Report - Harmful Content
      {
        reportId: '1003',
        reportType: 'group',
        reporterName: 'Lê Minh Cường',
        reporterEmail: 'cuong.le@example.com',
        reason: 'Nội dung độc hại',
        detailedReason: 'Nhóm này chia sẻ các nội dung có tính chất bạo lực và kích động thù địch.',
        reportedTargetId: 'GROUP_987654321'
      },

      // 4. Content Report - Financial Scam
      {
        reportId: '1004',
        reportType: 'content',
        reporterName: 'Phạm Thị Dung',
        reporterEmail: 'dung.pham@example.com',
        reason: 'Lừa đảo tài chính',
        detailedReason: 'Bài đăng này quảng cáo các chương trình đầu tư lừa đảo với lợi nhuận hấp dẫn không thực tế.',
        reportedTargetId: 'POST_456789123'
      },

      // 5. Comment Report - Sexual Harassment
      {
        reportId: '1005',
        reportType: 'comment',
        reporterName: 'Hoàng Văn Em',
        reporterEmail: 'em.hoang@example.com',
        reason: 'Quấy rối tình dục',
        detailedReason: 'Bình luận này chứa nội dung quấy rối tình dục và không phù hợp.',
        reportedTargetId: 'COMMENT_789012345'
      },

      // 6. Course Report - Inappropriate Content
      {
        reportId: '1006',
        reportType: 'course',
        reporterName: 'Võ Thị Giang',
        reporterEmail: 'giang.vo@education.vn',
        reason: 'Nội dung không phù hợp',
        detailedReason: 'Khóa học này chứa nội dung bạo lực và không phù hợp với độ tuổi được quảng cáo.',
        reportedTargetId: 'COURSE_111222333'
      },

      // 7. Project Report - Fraud
      {
        reportId: '1007',
        reportType: 'project',
        reporterName: 'Đinh Văn Hải',
        reporterEmail: 'hai.dinh@consumer.vn',
        reason: 'Dự án lừa đảo',
        detailedReason: 'Dự án này tuyên bố sai sự thật về tiến độ và kết quả để lừa đảo nhà đầu tư.',
        reportedTargetId: 'PROJECT_444555666'
      },

      // 8. Recruitment Report - Discriminatory
      {
        reportId: '1008',
        reportType: 'recruitment',
        reporterName: 'Bùi Thị Lan',
        reporterEmail: 'lan.bui@social.vn',
        reason: 'Phân biệt đối xử',
        detailedReason: 'Tin tuyển dụng này có yêu cầu phân biệt đối xử về giới tính và độ tuổi trái pháp luật.',
        reportedTargetId: 'JOB_777888999'
      },

      // 9. Song Report - Copyright Violation
      {
        reportId: '1009',
        reportType: 'song',
        reporterName: 'Lý Văn Minh',
        reporterEmail: 'minh.ly@music.vn',
        reason: 'Vi phạm bản quyền âm nhạc',
        detailedReason: 'Bài hát này sử dụng beat và melody của tác phẩm có bản quyền mà không có giấy phép.',
        reportedTargetId: 'SONG_123321123'
      },

      // 10. Event Report - Misleading Information
      {
        reportId: '1010',
        reportType: 'event',
        reporterName: 'Ngô Thị Oanh',
        reporterEmail: 'oanh.ngo@protection.vn',
        reason: 'Thông tin sai lệch',
        detailedReason: 'Sự kiện này cung cấp thông tin sai lệch về địa điểm, thời gian và nội dung chương trình.',
        reportedTargetId: 'EVENT_654987321'
      }
    ];

    console.log(`📝 Processing ${testMessages.length} comprehensive report messages...\n`);

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`--- Processing report ${i + 1}/${testMessages.length}: ${message.reportType.toUpperCase()} ---`);

      try {
        await processReportMessage(message);
        console.log(`✅ Report ${i + 1} processed successfully\n`);

        // Wait 500ms between messages for better round-robin distribution
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`⚠️ Failed to process report ${i + 1}:`, error);
      }
    }

    // Show final statistics
    console.log('📊 Final Report Statistics:');
    const totalReports = await db.select().from(reportManagement);
    console.log(`Total reports created: ${totalReports.length}`);

    // Group by report type
    const reportsByType: Record<string, number> = {};
    totalReports.forEach(report => {
      reportsByType[report.reportType] = (reportsByType[report.reportType] || 0) + 1;
    });

    console.log('\n📈 Reports by type:');
    Object.entries(reportsByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} reports`);
    });

    // Group by assigned user
    const reportsByUser: Record<string, number> = {};
    totalReports.forEach(report => {
      if (report.assignedToName) {
        reportsByUser[report.assignedToName] = (reportsByUser[report.assignedToName] || 0) + 1;
      }
    });

    console.log('\n👥 Reports by assigned user:');
    Object.entries(reportsByUser).forEach(([user, count]) => {
      console.log(`   ${user}: ${count} reports`);
    });

    console.log('\n🎉 Comprehensive Report Management simulation completed successfully!');

  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

// Run simulation
simulate10ReportTypes()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });