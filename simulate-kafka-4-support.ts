
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
  const now = new Date();
  const requestData = {
    fullName: "System Generated",
    email: "system@example.com",
    subject: `Yêu cầu hỗ trợ ${now.getTime()}`,
    content: `Yêu cầu hỗ trợ tự động được tạo lúc ${now.toISOString()}`,
    status: 'pending',
    assigned_to_id: assigneeId,
    assigned_at: now,
    created_at: now,
    updated_at: now
  };

  const newRequest = await db.insert(supportRequests).values(requestData).returning();
  return newRequest[0];
}

async function simulateKafka4Requests() {
  try {
    await clearDatabase();
    
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
