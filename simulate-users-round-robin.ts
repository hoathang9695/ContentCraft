/**
 * Script mô phỏng Kafka gửi nội dung đến 4 người dùng (hoanganh, lamhong, thanhha, minhphuong) 
 * theo phương thức vòng tròn, mỗi người nhận 5 nội dung với externalID là 18 số ngẫu nhiên.
 */

import { db } from './server/db';
import { ContentMessage } from './server/kafka-consumer';
import { storage } from './server/storage';

// Hàm tạo ID ngẫu nhiên 18 số
function generateRandomId(): string {
  let result = '';
  for (let i = 0; i < 18; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

// Hàm xử lý tin nhắn Kafka mô phỏng
async function processContentMessage(externalId: string, targetUsername: string) {
  console.log(`Đang tạo nội dung với externalId: ${externalId} cho người dùng: ${targetUsername}`);
  
  // Lấy user ID từ username
  const user = await storage.getUserByUsername(targetUsername);
  if (!user) {
    console.error(`Không tìm thấy người dùng ${targetUsername}`);
    return null;
  }

  // Tạo message giống với định dạng tin nhắn từ Kafka
  const message: ContentMessage = {
    externalId: externalId,
    source: 'Kafka Simulator',
    categories: 'Technology,News',
    labels: 'Breaking,Update',
    sourceVerification: Math.random() > 0.5 ? 'verified' : 'unverified'
  };

  // Tạo nội dung mới trong cơ sở dữ liệu
  const newContent = await storage.createContent({
    title: `Nội dung từ Kafka ${externalId}`,
    content: `Đây là nội dung mẫu được tạo tự động với ID: ${externalId}`,
    status: 'pending',
    sourceUrl: `https://source.example.com/${externalId}`,
    externalId: externalId,
    assigned_to_id: user.id,
    assignedAt: new Date(),
    result: null,
    approver_id: null,
    source: message.source || 'Unknown',
    categories: message.categories || '',
    labels: message.labels || '',
    sourceVerification: message.sourceVerification || 'unverified'
  });

  // Ghi nhật ký hoạt động người dùng
  await storage.logUserActivity({
    userId: user.id,
    activityType: 'assign',
    metadata: {
      action: 'assign',
      details: `Nội dung ${externalId} được phân công tự động từ Kafka`,
      contentId: newContent.id
    }
  });

  console.log(`Đã tạo nội dung ID ${newContent.id} với externalId ${externalId} cho người dùng ${targetUsername}`);
  return newContent;
}

// Xóa tất cả nội dung đã tạo trước đó (để tránh trùng lặp)
async function clearExistingContents() {
  try {
    // Xóa tất cả nội dung từ cơ sở dữ liệu có source là 'Kafka Simulator'
    const result = await db.execute(
      `DELETE FROM contents WHERE source = 'Kafka Simulator'`
    );
    console.log('Đã xóa tất cả nội dung từ Kafka Simulator trước đó');
    return true;
  } catch (error) {
    console.error('Lỗi khi xóa nội dung:', error);
    return false;
  }
}

// Chức năng chính: phân phối nội dung theo vòng tròn
async function simulateRoundRobinDistribution() {
  // Danh sách username theo thứ tự
  const usernames = ['hoanganh', 'lamhong', 'thanhha', 'minhphuong'];
  const contentsPerUser = 5; // Mỗi người dùng nhận 5 nội dung
  const totalContents = usernames.length * contentsPerUser;
  
  console.log(`Bắt đầu mô phỏng phân phối ${totalContents} nội dung theo vòng tròn cho ${usernames.length} người dùng...`);
  
  // Xóa nội dung cũ trước khi tạo mới
  await clearExistingContents();
  
  // Kiểm tra xem các người dùng có tồn tại không
  for (const username of usernames) {
    const user = await storage.getUserByUsername(username);
    if (!user) {
      console.error(`Người dùng ${username} không tồn tại trong hệ thống. Vui lòng kiểm tra lại.`);
      return;
    }
  }

  // Phân phối nội dung theo vòng tròn
  for (let i = 0; i < totalContents; i++) {
    const userIndex = i % usernames.length;
    const username = usernames[userIndex];
    const externalId = generateRandomId();
    
    try {
      await processContentMessage(externalId, username);
    } catch (error) {
      console.error(`Lỗi khi xử lý nội dung cho ${username}:`, error);
    }
  }

  console.log('Hoàn thành mô phỏng phân phối nội dung theo vòng tròn!');
  console.log(`Đã tạo ${totalContents} nội dung cho ${usernames.length} người dùng.`);

  // Hiển thị thống kê số lượng nội dung cho mỗi người dùng
  for (const username of usernames) {
    const user = await storage.getUserByUsername(username);
    if (user) {
      const contents = await storage.getContentsByAssignee(user.id);
      console.log(`${username}: ${contents.length} nội dung`);
    }
  }
}

// Thực thi script
simulateRoundRobinDistribution().then(() => {
  console.log('Script hoàn thành!');
  process.exit(0);
}).catch(err => {
  console.error('Có lỗi xảy ra:', err);
  process.exit(1);
});