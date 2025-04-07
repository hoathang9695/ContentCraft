/**
 * Script mô phỏng Kafka gửi nội dung đến 4 người dùng (minhanh, ngocanh, hoanganh, lamanh) 
 * theo phương thức vòng tròn, mỗi người nhận 5 nội dung.
 */
import { ContentMessage, processContentMessage } from './server/kafka-consumer';
import { db } from './server/db';
import { users, contents } from './shared/schema';
import { eq } from 'drizzle-orm';

// Danh sách tên người dùng được chỉ định
const USER_USERNAMES = ['minhanh', 'ngocanh', 'hoanganh', 'lamanh'];
// Số lượng nội dung mỗi người
const CONTENT_COUNT_PER_USER = 5;

// Hàm tạo ID ngẫu nhiên 18 số
function generateRandomId(): string {
  // Tạo ID có độ dài 18 chữ số
  return Math.floor(100000000000000000 + Math.random() * 900000000000000000).toString();
}

// Hàm trực tiếp xử lý thông điệp mô phỏng Kafka (thay vì dùng qua simulateKafkaMessage)
async function processCustomMessage(externalId: string) {
  // Tạo thông điệp theo yêu cầu cụ thể
  const message: ContentMessage = {
    externalId: externalId,
    source: 'Web Trẻ Thơ',
    categories: null,
    labels: null,
    sourceVerification: 'unverified'
  };
  
  console.log(`Xử lý nội dung: ${JSON.stringify(message)}`);
  
  // Xử lý tin nhắn trực tiếp thông qua kafka-consumer
  try {
    await processContentMessage(message);
    console.log(`Đã xử lý thành công nội dung ID: ${externalId}`);
  } catch (error) {
    console.error(`Lỗi khi xử lý nội dung: ${error}`);
    throw error;
  }
  
  return message;
}

async function simulateKafkaForUsers() {
  try {
    console.log('Bắt đầu mô phỏng Kafka gửi dữ liệu theo phương thức chia vòng tròn...');
    
    // Đảm bảo kết nối đến cơ sở dữ liệu
    console.log('Đang kết nối đến cơ sở dữ liệu...');
    
    // Lấy thông tin người dùng
    const userRecords: any[] = [];
    for (const username of USER_USERNAMES) {
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user.length > 0) {
        userRecords.push(user[0]);
        console.log(`Đã tìm thấy người dùng: ${username} (ID: ${user[0].id})`);
      } else {
        console.error(`Không tìm thấy người dùng: ${username}`);
        console.log(`Vui lòng tạo người dùng ${username} trước khi chạy script này.`);
        return;
      }
    }
    
    // Tổng số nội dung cần tạo
    const totalContentCount = USER_USERNAMES.length * CONTENT_COUNT_PER_USER;
    console.log(`Sẽ tạo ${totalContentCount} nội dung và phân chia cho ${USER_USERNAMES.length} người dùng theo vòng tròn.`);
    
    // Xóa nội dung hiện có nếu cần
    const existingContents = await db.select({ count: db.fn.count() }).from(contents);
    if (existingContents[0].count > 0) {
      console.log(`Đang xóa ${existingContents[0].count} nội dung hiện có...`);
      await db.delete(contents);
      console.log('Đã xóa nội dung hiện có');
    }
    
    // Mô phỏng tin nhắn Kafka và xử lý
    const createdContents = [];
    for (let i = 0; i < totalContentCount; i++) {
      // Tạo ID ngẫu nhiên 18 số
      const externalId = generateRandomId();
      
      // Xử lý tin nhắn
      try {
        console.log(`Đang xử lý nội dung ${i + 1}/${totalContentCount}: externalId=${externalId}`);
        await processCustomMessage(externalId);
        
        // Lấy nội dung vừa tạo để kiểm tra
        const createdContent = await db.select().from(contents).where(eq(contents.externalId, externalId)).limit(1);
        if (createdContent.length > 0) {
          createdContents.push(createdContent[0]);
        }
        
        // Đợi một khoảng thời gian ngắn để tránh đụng độ
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Lỗi khi xử lý nội dung ${externalId}:`, error);
      }
    }
    
    console.log('Hoàn tất mô phỏng Kafka gửi dữ liệu theo phương thức chia vòng tròn.');
    
    // Hiển thị thông tin về các nội dung đã tạo
    console.log('\nThống kê phân công nội dung:');
    const assignmentStats = {};
    userRecords.forEach(user => {
      assignmentStats[user.username] = 0;
    });
    
    createdContents.forEach(content => {
      const assignedUser = userRecords.find(u => u.id === content.assigned_to_id);
      if (assignedUser) {
        assignmentStats[assignedUser.username]++;
      }
    });
    
    for (const [username, count] of Object.entries(assignmentStats)) {
      console.log(`- ${username}: ${count} nội dung`);
    }
    
  } catch (error) {
    console.error('Lỗi khi mô phỏng Kafka:', error);
  }
}

// Chạy hàm mô phỏng
simulateKafkaForUsers()
  .then(() => {
    console.log('Script hoàn tất.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Lỗi khi chạy script:', error);
    process.exit(1);
  });