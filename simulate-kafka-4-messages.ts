import { db } from './server/db';
import { users } from './shared/schema';
import { and, ne, eq } from 'drizzle-orm';
import { simulateKafkaMessage } from './server/kafka-simulator';

async function simulateKafka4Messages() {
  try {
    console.log('Bắt đầu mô phỏng gửi 4 tin nhắn Kafka...');

    // Kết nối đến PostgreSQL database
    console.log('Connected to PostgreSQL database');

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
      const contentId = `content-${Date.now()}-${i}`;
      try {
        await simulateKafkaMessage(contentId);
        await new Promise(resolve => setTimeout(resolve, 300)); // Đợi 300ms giữa các tin nhắn
      } catch (error) {
        console.error(`Lỗi khi xử lý tin nhắn ${i + 1}:`, error);
      }
    }

    console.log('\nKết quả phân công:');
    for (const message of messages) {
      console.log(`${message.contentId} -> ${message.assignedTo}`);
    }
    console.log('Hoàn tất mô phỏng');
  } catch (error) {
    console.error('Lỗi khi mô phỏng Kafka:', error);
  }
}

// Chạy mô phỏng
simulateKafka4Messages();