
import { db } from './server/db.js';
import { reportManagement } from './shared/schema.js';

async function insertSampleReportData() {
  try {
    console.log('Inserting sample report data...');
    
    // Clear existing data
    await db.delete(reportManagement);
    console.log('Cleared existing report data');
    
    // Sample data with JSON format
    const sampleReports = [
      {
        reportedId: {"id":"114652263781752445","target_id":"108277159419234302"},
        reportType: 'user',
        reporterName: {"id":"114643441906721003","name":"Nguyễn Văn Hưng"},
        reporterEmail: 'hung.nguyen@gmail.com',
        reason: 'Spam tin nhắn',
        detailedReason: 'Người dùng zcng7ztfsy liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác trong hệ thống. Nội dung tin nhắn không phù hợp và gây phiền toái.',
        status: 'processing',
        assignedToId: 1,
        assignedToName: 'Administrator',
        assignedAt: new Date('2025-06-08T10:30:00.000Z'),
        createdAt: new Date('2025-06-08T09:15:00.000Z'),
        updatedAt: new Date('2025-06-08T10:30:00.000Z')
      },
      {
        reportedId: {"id":"PAGE_123789456","target_id":"PAGE_123789456_target"},
        reportType: 'page',
        reporterName: {"id":"114643441906721004","name":"Trần Thị Mai"},
        reporterEmail: 'mai.tran@company.vn',
        reason: 'Vi phạm bản quyền',
        detailedReason: 'Trang này đăng tải nhiều hình ảnh và video có bản quyền mà không có sự cho phép của chủ sở hữu. Đây là vi phạm nghiêm trọng về bản quyền.',
        status: 'pending',
        createdAt: new Date('2025-06-09T08:45:00.000Z'),
        updatedAt: new Date('2025-06-09T08:45:00.000Z')
      },
      {
        reportedId: {"id":"GROUP_987654321","target_id":"GROUP_987654321_target"},
        reportType: 'group',
        reporterName: {"id":"114643441906721005","name":"Lê Minh Tuấn"},
        reporterEmail: 'tuan.le@edu.vn',
        reason: 'Nội dung độc hại',
        detailedReason: 'Nhóm này thường xuyên chia sẻ các nội dung có tính chất bạo lực, kích động thù địch giữa các nhóm người. Rất có hại cho cộng đồng, đặc biệt là trẻ em.',
        status: 'completed',
        assignedToId: 2,
        assignedToName: 'Nguyễn Thị Khuyên',
        assignedAt: new Date('2025-06-07T14:20:00.000Z'),
        responseContent: 'Chúng tôi đã xem xét báo cáo của bạn về nhóm này. Sau khi kiểm tra, chúng tôi đã xóa các nội dung vi phạm và cảnh báo quản trị viên nhóm. Cảm ơn bạn đã báo cáo.',
        responderId: 2,
        responseTime: new Date('2025-06-08T16:45:00.000Z'),
        createdAt: new Date('2025-06-07T13:30:00.000Z'),
        updatedAt: new Date('2025-06-08T16:45:00.000Z')
      },
      {
        reportedId: {"id":"POST_456123789","target_id":"POST_456123789_target"},
        reportType: 'content',
        reporterName: {"id":"114643441906721006","name":"Phạm Đức Anh"},
        reporterEmail: 'anh.pham@business.com',
        reason: 'Lừa đảo tài chính',
        detailedReason: 'Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo. Nhiều người đã bị mất tiền sau khi tham gia theo hướng dẫn trong bài viết này.',
        status: 'processing',
        assignedToId: 1,
        assignedToName: 'Administrator',
        assignedAt: new Date('2025-06-09T09:00:00.000Z'),
        createdAt: new Date('2025-06-09T07:20:00.000Z'),
        updatedAt: new Date('2025-06-09T09:00:00.000Z')
      },
      {
        reportedId: {"id":"114648410456841168","target_id":"114648410456841168_target"},
        reportType: 'user',
        reporterName: {"id":"114643441906721007","name":"Hoàng Thị Lan"},
        reporterEmail: 'lan.hoang@office.vn',
        reason: 'Quấy rối tình dục',
        detailedReason: 'Người dùng Le Ngoc liên tục gửi tin nhắn có nội dung quấy rối tình dục, gửi hình ảnh không phù hợp đến tôi và nhiều người dùng nữ khác. Hành vi này cần được xử lý nghiêm khắc.',
        status: 'pending',
        createdAt: new Date('2025-06-09T11:15:00.000Z'),
        updatedAt: new Date('2025-06-09T11:15:00.000Z')
      }
    ];

    // Insert sample data
    const insertedReports = await db.insert(reportManagement).values(sampleReports).returning();
    
    console.log(`✅ Successfully inserted ${insertedReports.length} sample reports:`);
    insertedReports.forEach((report, index) => {
      console.log(`${index + 1}. ${JSON.stringify(report.reporterName)} - ${report.reason} (${report.reportType})`);
    });
    
  } catch (error) {
    console.error('Error inserting sample report data:', error);
  }
}

// Run the function
insertSampleReportData()
  .then(() => {
    console.log('Sample report data insertion completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
