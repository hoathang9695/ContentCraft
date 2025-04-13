
import { db } from './server/db';
import { users } from './shared/schema';
import { and, ne, eq } from 'drizzle-orm';
import { simulateKafkaMessage } from './server/kafka-simulator';

async function simulateKafka4Messages() {
  try {
    console.log('Bắt đầu mô phỏng gửi 4 tin nhắn Kafka...');
    
    // Lấy danh sách user active không phải admin
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

    // Tạo và xử lý 4 tin nhắn
    const messages = [];
    for (let i = 0; i < 4; i++) {
      const userIndex = i % activeUsers.length;
      const user = activeUsers[userIndex];
      
      const contentId = `content-${Date.now()}-${i}`;
      try {
        const message = await simulateKafkaMessage(contentId);
        messages.push({
          contentId,
          assignedTo: user.name
        });
        console.log(`Đã xử lý tin nhắn ${i + 1}/4, phân công cho ${user.name}`);
        
        // Đợi một chút giữa các tin nhắn
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Lỗi khi xử lý tin nhắn ${i + 1}:`, error);
      }
    }

    console.log('\nKết quả phân công:');
    messages.forEach((msg, index) => {
      console.log(`${index + 1}. Content ${msg.contentId} -> ${msg.assignedTo}`);
    });

  } catch (error) {
    console.error('Lỗi khi mô phỏng Kafka:', error);
  }
}

// Chạy mô phỏng
simulateKafka4Messages()
  .then(() => {
    console.log('Hoàn tất mô phỏng');
    process.exit(0);
  })
  .catch(error => {
    console.error('Lỗi:', error);
    process.exit(1);
  });
