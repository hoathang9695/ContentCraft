
import { db } from './server/db';
import { users } from './shared/schema';
import { eq, ne, and } from 'drizzle-orm';

interface ReportMessage {
  reportType: 'user' | 'page' | 'group' | 'content' | 'comment' | 'post';
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

    console.log(`👤 Assigned to user: ${assignedUser.name} (ID: ${assignedUser.id})`);

    // Insert into report_management table
    const insertData = {
      reportedId: message.reported_id,
      reportType: message.reportType,
      reporterName: message.reporterName,
      reason: message.reason,
      detailedReason: message.detailedReason,
      status: 'pending' as const,
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      assignedAt: new Date()
    };

    // Import the schema
    const { reportManagement } = await import('./shared/schema');
    
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
  console.log('🚀 Starting Report Management Kafka simulation...\n');
  
  try {
    // Test messages for different report types with new format
    const testMessages: ReportMessage[] = [
      {
        reportType: 'user',
        reported_id: {
          id: '114619409398949374',
          name: 'Nguyễn Văn Spam',
          email: 'spam.user@example.com'
        },
        reporterName: {
          id: '1749539951001',
          name: 'Nguyễn Văn An',
          reporterEmail: 'an.nguyen@example.com'
        },
        reason: 'Spam tin nhắn',
        detailedReason: 'Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác.'
      },
      {
        reportType: 'page',
        reported_id: {
          id: 'PAGE_123456789',
          name: 'Trang vi phạm bản quyền'
        },
        reporterName: {
          id: '1749539951002',
          name: 'Trần Thị Bình',
          reporterEmail: 'binh.tran@example.com'
        },
        reason: 'Vi phạm bản quyền',
        detailedReason: 'Trang này đăng tải nhiều hình ảnh có bản quyền mà không có sự cho phép.'
      },
      {
        reportType: 'group',
        reported_id: {
          id: 'GROUP_987654321',
          name: 'Nhóm nội dung độc hại'
        },
        reporterName: {
          id: '1749539951003',
          name: 'Lê Minh Cường',
          reporterEmail: 'cuong.le@example.com'
        },
        reason: 'Nội dung độc hại',
        detailedReason: 'Nhóm này chia sẻ các nội dung có tính chất bạo lực và kích động thù địch.'
      },
      {
        reportType: 'content',
        reported_id: {
          id: 'POST_456123789',
          name: 'Bài viết lừa đảo'
        },
        reporterName: {
          id: '1749539951004',
          name: 'Phạm Thị Dung',
          reporterEmail: 'dung.pham@example.com'
        },
        reason: 'Lừa đảo tài chính',
        detailedReason: 'Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo.'
      },
      {
        reportType: 'comment',
        reported_id: {
          id: 'COMMENT_789012345',
          name: 'Bình luận quấy rối'
        },
        reporterName: {
          id: '1749539951005',
          name: 'Hoàng Văn Em',
          reporterEmail: 'em.hoang@example.com'
        },
        reason: 'Quấy rối tình dục',
        detailedReason: 'Bình luận này chứa nội dung quấy rối tình dục và không phù hợp.'
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
