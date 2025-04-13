
import { db } from './server/db';
import { users } from './shared/schema';
import { and, ne, eq } from 'drizzle-orm';
import { processContentMessage } from './server/kafka-consumer';

async function simulateKafkaMessage(externalId: string) {
  const message = {
    externalId,
    source: JSON.stringify({
      id: Date.now().toString(),
      name: `Test Content ${externalId}`,
      type: 'Simulation'
    }),
    sourceVerification: 'verified' as const
  };

  await processContentMessage(message);
  return message;
}

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
    for (let i = 0; i < 4; i++) {
      const contentId = `content-${Date.now()}-${i}`;
      try {
        console.log(`Đang xử lý tin nhắn ${i + 1}/4`);
        const message = await simulateKafkaMessage(contentId);
        console.log(`Đã xử lý tin nhắn ${i + 1}/4:`, message);
        
        // Đợi 1 giây giữa các tin nhắn
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Lỗi khi xử lý tin nhắn ${i + 1}:`, error);
      }
    }

    console.log('Hoàn tất mô phỏng');
  } catch (error) {
    console.error('Lỗi khi mô phỏng Kafka:', error);
  }
}

// Chạy mô phỏng
simulateKafka4Messages();
