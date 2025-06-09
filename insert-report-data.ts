
import { db } from './server/db.js';
import { reportManagement } from './shared/schema.js';

async function insertSampleReportData() {
  try {
    console.log('Inserting sample report data with all report types...');
    
    // Clear existing data
    await db.delete(reportManagement);
    console.log('Cleared existing report data');
    
    // Sample data with all report types
    const sampleReports = [
      // Báo cáo người dùng
      {
        reportedId: {"id":"114652263781752445","target_id":"108277159419234302"},
        reportType: 'user',
        reporterName: {"id":"114643441906721003","name":"Nguyễn Văn Hưng"},
        reporterEmail: 'hung.nguyen@gmail.com',
        reason: 'Spam tin nhắn',
        detailedReason: 'Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác trong hệ thống. Nội dung tin nhắn không phù hợp và gây phiền toái.',
        status: 'processing',
        assignedToId: 1,
        assignedToName: 'Administrator',
        assignedAt: new Date('2025-06-08T10:30:00.000Z'),
        createdAt: new Date('2025-06-08T09:15:00.000Z'),
        updatedAt: new Date('2025-06-08T10:30:00.000Z')
      },
      
      // Báo cáo trang
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
      
      // Báo cáo nhóm
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
      
      // Báo cáo nội dung
      {
        reportedId: {"id":"CONTENT_456789123","target_id":"POST_456789123"},
        reportType: 'content',
        reporterName: {"id":"114643441906721006","name":"Phạm Văn Đức"},
        reporterEmail: 'duc.pham@tech.vn',
        reason: 'Nội dung không phù hợp',
        detailedReason: 'Bài viết chứa hình ảnh khỏa thân và ngôn từ tục tĩu. Không phù hợp với cộng đồng và có thể ảnh hưởng xấu đến trẻ em.',
        status: 'processing',
        assignedToId: 1,
        assignedToName: 'Administrator',
        assignedAt: new Date('2025-06-09T09:00:00.000Z'),
        createdAt: new Date('2025-06-09T07:20:00.000Z'),
        updatedAt: new Date('2025-06-09T09:00:00.000Z')
      },
      
      // Báo cáo bình luận
      {
        reportedId: {"id":"COMMENT_789123456","target_id":"COMMENT_789123456_target"},
        reportType: 'comment',
        reporterName: {"id":"114643441906721007","name":"Ngô Thị Hương"},
        reporterEmail: 'huong.ngo@social.vn',
        reason: 'Bình luận độc hại',
        detailedReason: 'Bình luận chứa lời lẽ xúc phạm, đe dọa bạo lực và kích động hận thù chủng tộc. Cần được xử lý ngay lập tức.',
        status: 'pending',
        createdAt: new Date('2025-06-09T10:15:00.000Z'),
        updatedAt: new Date('2025-06-09T10:15:00.000Z')
      },
      
      // Báo cáo tuyển dụng
      {
        reportedId: {"id":"JOB_321654987","target_id":"JOB_321654987_target"},
        reportType: 'recruitment',
        reporterName: {"id":"114643441906721008","name":"Vũ Minh Châu"},
        reporterEmail: 'chau.vu@hr.vn',
        reason: 'Thông tin tuyển dụng giả mạo',
        detailedReason: 'Tin tuyển dụng này có thông tin sai lệch về mức lương và quyền lợi. Công ty được đề cập đã xác nhận không có tin tuyển dụng này.',
        status: 'processing',
        assignedToId: 2,
        assignedToName: 'Nguyễn Thị Khuyên',
        assignedAt: new Date('2025-06-09T11:30:00.000Z'),
        createdAt: new Date('2025-06-09T08:00:00.000Z'),
        updatedAt: new Date('2025-06-09T11:30:00.000Z')
      },
      
      // Báo cáo dự án
      {
        reportedId: {"id":"PROJECT_654987321","target_id":"PROJECT_654987321_target"},
        reportType: 'project',
        reporterName: {"id":"114643441906721009","name":"Hoàng Văn Nam"},
        reporterEmail: 'nam.hoang@startup.vn',
        reason: 'Dự án lừa đảo',
        detailedReason: 'Dự án này huy động vốn từ cộng đồng nhưng không có kế hoạch thực hiện rõ ràng. Nghi ngờ là dự án lừa đảo để chiếm đoạt tiền của nhà đầu tư.',
        status: 'completed',
        assignedToId: 1,
        assignedToName: 'Administrator',
        assignedAt: new Date('2025-06-08T14:00:00.000Z'),
        responseContent: 'Sau khi xem xét kỹ lưỡng, chúng tôi đã tạm ngưng dự án này và yêu cầu bên tạo dự án cung cấp thêm thông tin chi tiết. Chúng tôi sẽ tiếp tục theo dõi tình hình.',
        responderId: 1,
        responseTime: new Date('2025-06-09T10:00:00.000Z'),
        createdAt: new Date('2025-06-08T12:30:00.000Z'),
        updatedAt: new Date('2025-06-09T10:00:00.000Z')
      },
      
      // Báo cáo khóa học
      {
        reportedId: {"id":"COURSE_987321654","target_id":"COURSE_987321654_target"},
        reportType: 'course',
        reporterName: {"id":"114643441906721010","name":"Đặng Thị Lan"},
        reporterEmail: 'lan.dang@education.vn',
        reason: 'Nội dung khóa học vi phạm',
        detailedReason: 'Khóa học này sao chép hoàn toàn nội dung từ một khóa học trả phí khác mà không có sự cho phép. Đây là vi phạm nghiêm trọng về bản quyền giáo dục.',
        status: 'processing',
        assignedToId: 2,
        assignedToName: 'Nguyễn Thị Khuyên',
        assignedAt: new Date('2025-06-09T13:00:00.000Z'),
        createdAt: new Date('2025-06-09T09:45:00.000Z'),
        updatedAt: new Date('2025-06-09T13:00:00.000Z')
      },
      
      // Báo cáo sự kiện
      {
        reportedId: {"id":"EVENT_147258369","target_id":"EVENT_147258369_target"},
        reportType: 'event',
        reporterName: {"id":"114643441906721011","name":"Trịnh Văn Bình"},
        reporterEmail: 'binh.trinh@events.vn',
        reason: 'Sự kiện lừa đảo',
        detailedReason: 'Sự kiện này thu tiền vé nhưng thực tế không tổ chức hoặc tổ chức không đúng như quảng cáo. Nhiều người đã bị lừa và mất tiền.',
        status: 'pending',
        createdAt: new Date('2025-06-09T11:00:00.000Z'),
        updatedAt: new Date('2025-06-09T11:00:00.000Z')
      },
      
      // Báo cáo bài hát
      {
        reportedId: {"id":"SONG_369258147","target_id":"SONG_369258147_target"},
        reportType: 'song',
        reporterName: {"id":"114643441906721012","name":"Lý Thị Hoa"},
        reporterEmail: 'hoa.ly@music.vn',
        reason: 'Vi phạm bản quyền âm nhạc',
        detailedReason: 'Bài hát này sử dụng giai điệu và lời của một ca khúc nổi tiếng mà không có sự cho phép từ tác giả gốc. Cần được gỡ bỏ ngay lập tức.',
        status: 'completed',
        assignedToId: 1,
        assignedToName: 'Administrator',
        assignedAt: new Date('2025-06-08T16:00:00.000Z'),
        responseContent: 'Chúng tôi đã xác minh vi phạm bản quyền và đã gỡ bỏ bài hát khỏi nền tảng. Tài khoản người đăng tải đã được cảnh báo về vi phạm bản quyền.',
        responderId: 1,
        responseTime: new Date('2025-06-09T08:30:00.000Z'),
        createdAt: new Date('2025-06-08T15:20:00.000Z'),
        updatedAt: new Date('2025-06-09T08:30:00.000Z')
      },
      
      // Thêm một số báo cáo khác
      {
        reportedId: {"id":"114648410456841168","target_id":"114648410456841168_target"},
        reportType: 'user',
        reporterName: {"id":"114643441906721013","name":"Hoàng Thị Lan"},
        reporterEmail: 'lan.hoang@office.vn',
        reason: 'Quấy rối tình dục',
        detailedReason: 'Người dùng này liên tục gửi tin nhắn có nội dung quấy rối tình dục, gửi hình ảnh không phù hợp đến tôi và nhiều người dùng nữ khác. Hành vi này cần được xử lý nghiêm khắc.',
        status: 'completed',
        assignedToId: 2,
        assignedToName: 'Nguyễn Thị Khuyên',
        assignedAt: new Date('2025-06-09T12:00:00.000Z'),
        responseContent: 'Chúng tôi đã xử lý nghiêm khắc tài khoản này. Tài khoản đã bị khóa vĩnh viễn do vi phạm nghiêm trọng chính sách cộng đồng.',
        responderId: 2,
        responseTime: new Date('2025-06-09T14:00:00.000Z'),
        createdAt: new Date('2025-06-09T11:15:00.000Z'),
        updatedAt: new Date('2025-06-09T14:00:00.000Z')
      }
    ];

    // Insert sample data
    const insertedReports = await db.insert(reportManagement).values(sampleReports).returning();
    
    console.log(`✅ Successfully inserted ${insertedReports.length} sample reports with all report types:`);
    insertedReports.forEach((report, index) => {
      const reporterName = typeof report.reporterName === 'object' ? 
        (report.reporterName as any).name : report.reporterName;
      console.log(`${index + 1}. ${reporterName} - ${report.reason} (${report.reportType}) - ${report.status}`);
    });

    console.log('\n📊 Report types distribution:');
    const typeCount: Record<string, number> = {};
    insertedReports.forEach(report => {
      typeCount[report.reportType] = (typeCount[report.reportType] || 0) + 1;
    });
    
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} reports`);
    });

  } catch (error) {
    console.error('❌ Error inserting report data:', error);
    throw error;
  }
}

// Run the function
insertSampleReportData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
