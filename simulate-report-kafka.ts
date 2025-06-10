
import { db } from './server/db';
import { users } from './shared/schema';
import { eq, ne, and } from 'drizzle-orm';

interface ReportMessage {
  reportId: string;
  reportType: 'user' | 'page' | 'group' | 'content' | 'comment' | 'post';
  reporterName: string;
  reporterEmail: string;
  reason: string;
  detailedReason: string;
  reportedTargetId?: string;
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

    // Simulate round-robin assignment (simple random for demo)
    const randomIndex = Math.floor(Math.random() * activeUsers.length);
    const assignedUser = activeUsers[randomIndex];

    console.log(`👤 Assigned to user: ${assignedUser.name} (ID: ${assignedUser.id})`);

    // Here we would normally insert into report_management table
    // For now, just simulate the processing
    const reportData = {
      reportId: message.reportId,
      reportType: message.reportType,
      reporterName: message.reporterName,
      reporterEmail: message.reporterEmail,
      reason: message.reason,
      detailedReason: message.detailedReason,
      status: 'pending',
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`✅ Report processed successfully:`, reportData);
    return reportData;

  } catch (error) {
    console.error(`❌ Error processing report message: ${error}`);
    throw error;
  }
}

async function simulateReportKafkaMessages() {
  console.log('🚀 Starting Report Management Kafka simulation...\n');
  
  try {
    // Test messages for different report types
    const testMessages: ReportMessage[] = [
      {
        reportId: 'RPT_' + Date.now() + '_001',
        reportType: 'user',
        reporterName: 'Nguyễn Văn An',
        reporterEmail: 'an.nguyen@example.com',
        reason: 'Spam tin nhắn',
        detailedReason: 'Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác.',
        reportedTargetId: '114652263781752445',
        reportedTargetName: 'Người dùng spam'
      },
      {
        reportId: 'RPT_' + Date.now() + '_002',
        reportType: 'page',
        reporterName: 'Trần Thị Bình',
        reporterEmail: 'binh.tran@example.com',
        reason: 'Vi phạm bản quyền',
        detailedReason: 'Trang này đăng tải nhiều hình ảnh có bản quyền mà không có sự cho phép.',
        reportedTargetId: 'PAGE_123456789',
        reportedTargetName: 'Trang vi phạm bản quyền'
      },
      {
        reportId: 'RPT_' + Date.now() + '_003',
        reportType: 'group',
        reporterName: 'Lê Minh Cường',
        reporterEmail: 'cuong.le@example.com',
        reason: 'Nội dung độc hại',
        detailedReason: 'Nhóm này chia sẻ các nội dung có tính chất bạo lực và kích động thù địch.',
        reportedTargetId: 'GROUP_987654321',
        reportedTargetName: 'Nhóm nội dung độc hại'
      },
      {
        reportId: 'RPT_' + Date.now() + '_004',
        reportType: 'content',
        reporterName: 'Phạm Thị Dung',
        reporterEmail: 'dung.pham@example.com',
        reason: 'Lừa đảo tài chính',
        detailedReason: 'Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.',
        reportedTargetId: 'POST_456123789',
        reportedTargetName: 'Bài viết lừa đảo'
      },
      {
        reportId: 'RPT_' + Date.now() + '_005',
        reportType: 'comment',
        reporterName: 'Hoàng Văn Em',
        reporterEmail: 'em.hoang@example.com',
        reason: 'Quấy rối tình dục',
        detailedReason: 'Bình luận này chứa nội dung quấy rối tình dục và không phù hợp.',
        reportedTargetId: 'COMMENT_789012345',
        reportedTargetName: 'Bình luận quấy rối'
      }
    ];

    console.log(`📝 Processing ${testMessages.length} report messages...\n`);

    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`--- Processing message ${i + 1}/${testMessages.length} ---`);
      
      try {
        await processReportMessage(message);
        console.log(`✅ Message ${i + 1} processed successfully\n`);
        
        // Wait 1 second between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`⚠️ Failed to process message ${i + 1}:`, error);
      }
    }

    console.log('🎉 Completed Report Management Kafka simulation');
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

// Run simulation
simulateReportKafkaMessages()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
