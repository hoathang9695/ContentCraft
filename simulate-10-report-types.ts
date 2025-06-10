
import { db } from './server/db';
import { users, reportManagement } from './shared/schema';
import { eq, ne, and } from 'drizzle-orm';

interface ReportMessage {
  reportId: string;
  reportType: 'user' | 'page' | 'group' | 'content' | 'comment';
  reporterName: string;
  reporterEmail: string;
  reason: string;
  detailedReason: string;
  reportedTargetId: string;
  reportedTargetName?: string;
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
        reportId: 'RPT_' + Date.now() + '_001',
        reportType: 'user',
        reporterName: 'Nguyễn Văn An',
        reporterEmail: 'an.nguyen@example.com',
        reason: 'Spam tin nhắn',
        detailedReason: 'Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác trong hệ thống.',
        reportedTargetId: '114652263781752445',
        reportedTargetName: 'Spammer User'
      },

      // 2. Page Report - Copyright
      {
        reportId: 'RPT_' + Date.now() + '_002',
        reportType: 'page',
        reporterName: 'Trần Thị Bình',
        reporterEmail: 'binh.tran@example.com',
        reason: 'Vi phạm bản quyền',
        detailedReason: 'Trang này đăng tải nhiều hình ảnh, video có bản quyền mà không có sự cho phép của chủ sở hữu.',
        reportedTargetId: 'PAGE_123456789',
        reportedTargetName: 'Copyright Violator Page'
      },

      // 3. Group Report - Harmful Content
      {
        reportId: 'RPT_' + Date.now() + '_003',
        reportType: 'group',
        reporterName: 'Lê Minh Cường',
        reporterEmail: 'cuong.le@example.com',
        reason: 'Nội dung độc hại',
        detailedReason: 'Nhóm này chia sẻ các nội dung có tính chất bạo lực, kích động thù địch và lan truyền thông tin sai lệch.',
        reportedTargetId: 'GROUP_987654321',
        reportedTargetName: 'Harmful Content Group'
      },

      // 4. Content Report - Financial Scam
      {
        reportId: 'RPT_' + Date.now() + '_004',
        reportType: 'content',
        reporterName: 'Phạm Thị Dung',
        reporterEmail: 'dung.pham@example.com',
        reason: 'Lừa đảo tài chính',
        detailedReason: 'Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo người dùng.',
        reportedTargetId: 'POST_456123789',
        reportedTargetName: 'Scam Investment Post'
      },

      // 5. Comment Report - Sexual Harassment
      {
        reportId: 'RPT_' + Date.now() + '_005',
        reportType: 'comment',
        reporterName: 'Hoàng Văn Em',
        reporterEmail: 'em.hoang@example.com',
        reason: 'Quấy rối tình dục',
        detailedReason: 'Bình luận này chứa nội dung quấy rối tình dục và ngôn từ không phù hợp với chuẩn mực xã hội.',
        reportedTargetId: 'COMMENT_789012345',
        reportedTargetName: 'Harassment Comment'
      },

      // 6. User Report - Identity Theft
      {
        reportId: 'RPT_' + Date.now() + '_006',
        reportType: 'user',
        reporterName: 'Võ Thị Giang',
        reporterEmail: 'giang.vo@business.vn',
        reason: 'Đạo danh tính',
        detailedReason: 'Người dùng này sử dụng hình ảnh và thông tin cá nhân của tôi để tạo tài khoản giả mạo.',
        reportedTargetId: '114643521907832156',
        reportedTargetName: 'Identity Thief'
      },

      // 7. Page Report - Fake Business
      {
        reportId: 'RPT_' + Date.now() + '_007',
        reportType: 'page',
        reporterName: 'Đinh Văn Hải',
        reporterEmail: 'hai.dinh@consumer.vn',
        reason: 'Doanh nghiệp giả mạo',
        detailedReason: 'Trang này mạo danh doanh nghiệp có uy tín để lừa đảo khách hàng, bán hàng giả kém chất lượng.',
        reportedTargetId: 'PAGE_567890123',
        reportedTargetName: 'Fake Business Page'
      },

      // 8. Group Report - Hate Speech
      {
        reportId: 'RPT_' + Date.now() + '_008',
        reportType: 'group',
        reporterName: 'Bùi Thị Lan',
        reporterEmail: 'lan.bui@social.vn',
        reason: 'Phát ngôn thù địch',
        detailedReason: 'Nhóm này thường xuyên đăng tải các nội dung kỳ thị, phân biệt đối xử dựa trên tôn giáo và sắc tộc.',
        reportedTargetId: 'GROUP_234567890',
        reportedTargetName: 'Hate Speech Group'
      },

      // 9. Content Report - Fake News
      {
        reportId: 'RPT_' + Date.now() + '_009',
        reportType: 'content',
        reporterName: 'Lý Văn Minh',
        reporterEmail: 'minh.ly@news.vn',
        reason: 'Tin tức giả mạo',
        detailedReason: 'Bài viết này lan truyền thông tin sai lệch về tình hình dịch bệnh, gây hoang mang trong dư luận.',
        reportedTargetId: 'ARTICLE_345678901',
        reportedTargetName: 'Fake News Article'
      },

      // 10. Comment Report - Cyberbullying
      {
        reportId: 'RPT_' + Date.now() + '_010',
        reportType: 'comment',
        reporterName: 'Ngô Thị Oanh',
        reporterEmail: 'oanh.ngo@protection.vn',
        reason: 'Bắt nạt trực tuyến',
        detailedReason: 'Chuỗi bình luận này nhắm vào một cá nhân cụ thể với mục đích làm tổn hại danh tiếng và tinh thần của họ.',
        reportedTargetId: 'COMMENT_901234567',
        reportedTargetName: 'Cyberbullying Comments'
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
