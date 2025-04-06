import { ContentMessage } from './server/kafka-consumer';
import { db } from './server/db';
import { users, contents } from './shared/schema';
import { eq } from 'drizzle-orm';

async function sendCustomMessage() {
  // Tạo ID cho nội dung
  const contentId = '100';
  
  // Tạo thông điệp tùy chỉnh
  const message: ContentMessage = {
    externalId: contentId,
    source: 'Web Trẻ Thơ',
    categories: undefined,
    labels: undefined,
    sourceVerification: 'unverified' as 'unverified'
  };
  
  console.log('Gửi thông điệp Kafka tùy chỉnh:');
  console.log(JSON.stringify(message, null, 2));
  
  try {
    // Kiểm tra nếu nội dung đã tồn tại
    const existingContent = await db.query.contents.findFirst({
      where: eq(contents.externalId, contentId),
    });
    
    if (existingContent) {
      console.log(`Nội dung với ID ${contentId} đã tồn tại.`);
      return;
    }
    
    // Tìm user hoanganh
    const hoanganhUser = await db.query.users.findFirst({
      where: eq(users.username, 'hoanganh'),
    });
    
    if (!hoanganhUser) {
      console.log('Không tìm thấy user hoanganh.');
      return;
    }
    
    const now = new Date();
    
    // Lưu nội dung và phân công cho hoanganh
    await db.insert(contents).values({
      externalId: contentId,
      source: message.source || null,
      categories: null, // Trực tiếp sử dụng null ở đây vì đây là column, không phải object type
      labels: null, // Trực tiếp sử dụng null ở đây vì đây là column, không phải object type
      status: 'pending',
      sourceVerification: message.sourceVerification || 'unverified',
      assigned_to_id: hoanganhUser.id,
      assignedAt: now,
      comments: 0,
      reactions: 0
    });
    
    console.log(`Đã gán nội dung ${contentId} cho user hoanganh (ID: ${hoanganhUser.id})`);
  } catch (error) {
    console.error(`Lỗi khi xử lý thông điệp: ${error}`);
  }
}

// Chạy hàm gửi thông điệp
sendCustomMessage().catch(console.error);