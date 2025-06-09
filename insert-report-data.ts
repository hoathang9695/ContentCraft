
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '42.96.40.138',
  database: process.env.DB_NAME || 'content',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'chiakhoathanhcong',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function insertReportData() {
  const client = await pool.connect();

  try {
    console.log('Database connected successfully');
    console.log('Connection config:', {
      host: pool.options.host,
      database: pool.options.database,
      user: pool.options.user,
      port: pool.options.port
    });

    // Test connection
    const testResult = await client.query('SELECT NOW() as now');
    console.log('Database connection test successful:', testResult.rows[0]);

    // Clear existing data
    await client.query('DELETE FROM report_management');
    console.log('Cleared existing report data');

    // Enable unaccent extension for Vietnamese text search
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS unaccent');
      console.log('✅ Unaccent extension enabled');
    } catch (error) {
      console.log('Note: Unaccent extension might already exist');
    }

    // Insert comprehensive sample data with simplified reported_id (only ID)
    const insertQuery = `
      INSERT INTO report_management (
        reported_id, report_type, reporter_name, reporter_email, 
        reason, detailed_reason, status, created_at, updated_at
      ) VALUES 
      ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()),
      ($8, $9, $10, $11, $12, $13, $14, NOW(), NOW()),
      ($15, $16, $17, $18, $19, $20, $21, NOW(), NOW()),
      ($22, $23, $24, $25, $26, $27, $28, NOW(), NOW()),
      ($29, $30, $31, $32, $33, $34, $35, NOW(), NOW()),
      ($36, $37, $38, $39, $40, $41, $42, NOW(), NOW()),
      ($43, $44, $45, $46, $47, $48, $49, NOW(), NOW()),
      ($50, $51, $52, $53, $54, $55, $56, NOW(), NOW()),
      ($57, $58, $59, $60, $61, $62, $63, NOW(), NOW()),
      ($64, $65, $66, $67, $68, $69, $70, NOW(), NOW())
    `;

    const values = [
      // 1. Người dùng
      JSON.stringify({"id":"114652263781752445"}),
      'user',
      JSON.stringify({"id":"114643441906721003","name":"Nguyễn Văn Hưng"}),
      'hung.nguyen@office.vn',
      'Spam tin nhắn',
      'Người dùng này liên tục gửi tin nhắn spam với nội dung quảng cáo không phù hợp và làm phần nhiều người dùng khác.',
      'pending',

      // 2. Trang
      JSON.stringify({"id":"PAGE_123789456"}),
      'page',
      JSON.stringify({"id":"114643441906721004","name":"Trần Thị Mai"}),
      'mai.tran@company.vn',
      'Vi phạm bản quyền',
      'Trang này đăng tải nhiều hình ảnh và video có bản quyền mà không có sự cho phép của chủ sở hữu. Đây là vi phạm nghiêm trọng về bản quyền.',
      'processing',

      // 3. Nhóm
      JSON.stringify({"id":"GROUP_987654321"}),
      'group',
      JSON.stringify({"id":"114643441906721005","name":"Lê Minh Tuấn"}),
      'tuan.le@enterprise.vn',
      'Nội dung độc hại',
      'Nhóm này thường xuyên chia sẻ những nội dung độc hại, kích động bạo lực và thù địch giữa các cộng đồng.',
      'completed',

      // 4. Nội dung
      JSON.stringify({"id":"CONTENT_555666777"}),
      'content',
      JSON.stringify({"id":"114643441906721006","name":"Phạm Đức Anh"}),
      'anh.pham@business.vn',
      'Lừa đảo tài chính',
      'Nội dung này quảng cáo các sản phẩm đầu tư tài chính lừa đảo, hứa hẹn lợi nhuận cao để lừa gạt người dùng.',
      'pending',

      // 5. Bình luận
      JSON.stringify({"id":"COMMENT_444555666"}),
      'comment',
      JSON.stringify({"id":"114643441906721007","name":"Hoàng Thị Lan"}),
      'lan.hoang@office.vn',
      'Quấy rối tình dục',
      'Bình luận này chứa nội dung quấy rối tình dục, không phù hợp và làm nhiều người dùng cảm thấy khó chịu.',
      'completed',

      // 6. Tuyển dụng
      JSON.stringify({"id":"JOB_123456789"}),
      'recruitment',
      JSON.stringify({"id":"114643441906721008","name":"Võ Minh Quang"}),
      'quang.vo@hr.vn',
      'Thông tin tuyển dụng lừa đảo',
      'Tin tuyển dụng này có dấu hiệu lừa đảo, yêu cầu ứng viên nộp phí trước khi làm việc và không có thông tin công ty rõ ràng.',
      'processing',

      // 7. Dự án
      JSON.stringify({"id":"PROJECT_789012345"}),
      'project',
      JSON.stringify({"id":"114643441906721009","name":"Đặng Thị Hoa"}),
      'hoa.dang@startup.vn',
      'Dự án lừa đảo đầu tư',
      'Dự án này có dấu hiệu lừa đảo, kêu gọi đầu tư với lợi nhuận không thực tế và không có kế hoạch kinh doanh rõ ràng.',
      'pending',

      // 8. Khóa học
      JSON.stringify({"id":"COURSE_345678901"}),
      'course',
      JSON.stringify({"id":"114643441906721010","name":"Bùi Văn Nam"}),
      'nam.bui@education.vn',
      'Khóa học kém chất lượng',
      'Khóa học này có nội dung sao chép từ nhiều nguồn khác, không có giá trị học tập và lừa dối người học về chất lượng.',
      'completed',

      // 9. Sự kiện
      JSON.stringify({"id":"EVENT_567890123"}),
      'event',
      JSON.stringify({"id":"114643441906721011","name":"Trương Thị Linh"}),
      'linh.truong@events.vn',
      'Sự kiện lừa đảo',
      'Sự kiện này thu phí tham gia cao nhưng không có nội dung chất lượng, có dấu hiệu lừa đảo người tham gia.',
      'processing',

      // 10. Bài hát
      JSON.stringify({"id":"SONG_890123456"}),
      'song',
      JSON.stringify({"id":"114643441906721012","name":"Lý Văn Đức"}),
      'duc.ly@music.vn',
      'Vi phạm bản quyền âm nhạc',
      'Bài hát này sử dụng giai điệu và lời của các tác phẩm có bản quyền mà không có sự cho phép của tác giả.',
      'pending'
    ];

    await client.query(insertQuery, values);

    console.log('✅ Successfully inserted 10 sample reports with simplified reported_id:');
    console.log('1. Người dùng - ID: 114652263781752445');
    console.log('2. Trang - ID: PAGE_123789456');
    console.log('3. Nhóm - ID: GROUP_987654321');
    console.log('4. Nội dung - ID: CONTENT_555666777');
    console.log('5. Bình luận - ID: COMMENT_444555666');
    console.log('6. Tuyển dụng - ID: JOB_123456789');
    console.log('7. Dự án - ID: PROJECT_789012345');
    console.log('8. Khóa học - ID: COURSE_345678901');
    console.log('9. Sự kiện - ID: EVENT_567890123');
    console.log('10. Bài hát - ID: SONG_890123456');

    // Verify the data
    const verifyResult = await client.query(`
      SELECT id, reported_id, report_type, reason, status 
      FROM report_management 
      ORDER BY created_at DESC 
      LIMIT 3
    `);

    console.log('\n📋 Sample verification data:');
    verifyResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id} | Reported: ${JSON.stringify(row.reported_id)} | Type: ${row.report_type}`);
    });

  } catch (error) {
    console.error('Error inserting report data:', error);
  } finally {
    client.release();
    await pool.end();
    console.log('Report data insertion completed');
  }
}

insertReportData();
