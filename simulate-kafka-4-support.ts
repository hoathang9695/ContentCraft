
import { db } from './server/db';
import { users, supportRequests } from './shared/schema';
import { and, ne, eq } from 'drizzle-orm';

async function clearDatabase() {
  try {
    console.log('Xóa các yêu cầu hỗ trợ hiện có...');
    await db.delete(supportRequests);
    console.log('Đã xóa thành công');
  } catch (err) {
    console.error('Lỗi khi xóa database:', err);
    throw err;
  }
}

async function createSupportRequest(assigneeId: number) {
  try {
    const now = new Date();
    const requestData = {
      fullName: "System Generated",
      email: "system@example.com", 
      subject: `Yêu cầu hỗ trợ ${now.getTime()}`,
      content: `Yêu cầu hỗ trợ tự động được tạo lúc ${now.toISOString()}`,
      status: 'pending',
      assigned_to_id: assigneeId,
      assigned_at: now
    };

    console.log('Attempting to create support request with data:', requestData);
    
    const result = await db.insert(supportRequests)
      .values(requestData)
      .returning({
        id: supportRequests.id,
        fullName: supportRequests.fullName,
        subject: supportRequests.subject,
        assigned_to_id: supportRequests.assigned_to_id
      });

    console.log('Raw database result:', result);
    
    if (!result || !result.length) {
      throw new Error('No data returned from database insert');
    }

    console.log('Successfully created support request:', result[0]);
    return result[0];
  } catch (error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

async function simulateKafka4Requests() {
  console.log('Starting simulation with database config:', {
    host: process.env.PGHOST || '42.96.40.138',
    database: process.env.PGDATABASE || 'content',
    user: process.env.PGUSER || 'postgres'
  });
  
  try {
    console.log('Kết nối database với config:', {
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER
    });

    // Test database connection first
    console.log('Testing database connection with config:', {
      host: process.env.PGHOST || '42.96.40.138',
      database: process.env.PGDATABASE || 'content',
      user: process.env.PGUSER || 'postgres'
    });

    const testResult = await db.query('SELECT NOW()');
    console.log('Database connection successful:', testResult);
    
    // Don't clear database to preserve existing data
    console.log('Bắt đầu mô phỏng tạo 4 yêu cầu hỗ trợ...');

    // Lấy danh sách người dùng active không phải admin
    const activeUsers = await db
      .select()
      .from(users)
      .where(
        and(
          ne(users.role, 'admin'),
          eq(users.status, 'active')
        )
      );

    if (activeUsers.length === 0) {
      console.error('Không tìm thấy người dùng active không phải admin');
      return;
    }

    console.log(`Tìm thấy ${activeUsers.length} người dùng để phân công`);

    // Tạo và xử lý 4 yêu cầu
    for (let i = 0; i < 4; i++) {
      const assigneeIndex = i % activeUsers.length;
      const assignee = activeUsers[assigneeIndex];
      
      try {
        console.log(`Đang tạo yêu cầu ${i + 1}/4 cho ${assignee.name}`);
        const request = await createSupportRequest(assignee.id);
        console.log(`Đã tạo yêu cầu ${i + 1}, phân công cho ${assignee.name}`);
        
        // Đợi 1 giây giữa các yêu cầu
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Lỗi khi tạo yêu cầu ${i + 1}:`, error);
      }
    }

    console.log('Hoàn tất mô phỏng');
  } catch (error) {
    console.error('Lỗi khi mô phỏng:', error);
    process.exit(1);
  }
}

// Thực thi mô phỏng
simulateKafka4Requests().then(() => {
  console.log('Script hoàn thành');
  process.exit(0);
}).catch(err => {
  console.error('Script thất bại:', err);
  process.exit(1);
});
