
import { db } from './server/db';
import { users, supportRequests } from './shared/schema';
import { and, ne, eq } from 'drizzle-orm';

async function createSupportRequest(assigneeId: number, index: number) {
  try {
    const now = new Date();
    
    const requestData = {
      full_name: `Người dùng ${index}`,
      email: `user${index}@example.com`,
      subject: `Yêu cầu hỗ trợ ${index}`,
      content: `Nội dung yêu cầu hỗ trợ ${index} được tạo lúc ${now.toISOString()}`,
      status: 'pending',
      assigned_to_id: assigneeId,
      assigned_at: now,
      created_at: now,
      updated_at: now
    };

    const result = await db.insert(supportRequests)
      .values(requestData)
      .returning();

    console.log(`Đã tạo yêu cầu hỗ trợ ${index}, ID: ${result[0].id}, phân công cho user ID ${assigneeId}`);
    return result[0];
  } catch (error) {
    console.error(`Lỗi khi tạo yêu cầu hỗ trợ ${index}:`, error);
    throw error;
  }
}

async function simulateKafka5Support() {
  try {
    console.log('Bắt đầu giả lập gửi 5 yêu cầu hỗ trợ...');

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

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error('Không tìm thấy người dùng active không phải admin');
    }

    console.log(`Tìm thấy ${activeUsers.length} người dùng để phân công`);

    // Tạo 5 yêu cầu hỗ trợ
    for (let i = 1; i <= 5; i++) {
      const assigneeIndex = (i - 1) % activeUsers.length;
      const assignee = activeUsers[assigneeIndex];

      console.log(`Đang tạo yêu cầu ${i}/5 cho người dùng:`, assignee.name);

      try {
        await createSupportRequest(assignee.id, i);
        // Đợi 1 giây giữa các yêu cầu
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Lỗi khi tạo yêu cầu ${i}:`, error);
      }
    }

    console.log('Hoàn tất giả lập');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi giả lập:', error);
    process.exit(1);
  }
}

// Thực thi giả lập
simulateKafka5Support();
