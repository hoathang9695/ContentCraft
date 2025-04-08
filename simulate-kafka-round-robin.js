import { db } from './server/db.ts';
import * as schema from './shared/schema.ts';
import { eq } from 'drizzle-orm';

const { users, contents } = schema;

// Danh sách người dùng được phân công xử lý
const USER_USERNAMES = ['hoanganh', 'minhphuong', 'lamhong', 'thanhha'];
const CONTENT_COUNT_PER_USER = 10; // Số lượng nội dung cho mỗi người dùng
const TOTAL_CONTENT_COUNT = USER_USERNAMES.length * CONTENT_COUNT_PER_USER;

// Hàm tạo ID ngẫu nhiên 18 chữ số
function generateRandomId() {
  return Math.floor(100000000000000000 + Math.random() * 900000000000000000).toString();
}

// Hàm tạo nội dung mới
async function createContent(externalId, assigneeId) {
  const currentDate = new Date('2025-04-06');
  
  const insertData = {
    externalId,
    source: 'Web Trẻ Thơ',
    sourceVerification: 'unverified',
    status: 'pending',
    assigneeId,
    comments: 0,
    reactions: 0,
    createdAt: currentDate,
    updatedAt: currentDate
  };
  
  try {
    const result = await db.insert(contents).values(insertData).returning();
    return result[0];
  } catch (error) {
    console.error(`Lỗi khi tạo nội dung ${externalId}:`, error);
    throw error;
  }
}

// Hàm chính để tạo dữ liệu
async function simulateKafkaRoundRobin() {
  try {
    console.log('Bắt đầu mô phỏng Kafka gửi dữ liệu theo phương thức chia vòng tròn...');
    
    // Lấy thông tin người dùng
    const userRecords = [];
    for (const username of USER_USERNAMES) {
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user.length > 0) {
        userRecords.push(user[0]);
        console.log(`Đã tìm thấy người dùng: ${username} (ID: ${user[0].id})`);
      } else {
        console.error(`Không tìm thấy người dùng: ${username}`);
        process.exit(1);
      }
    }
    
    // Tạo nội dung cho từng người dùng theo phương thức chia vòng tròn
    const createdContents = [];
    for (let i = 0; i < TOTAL_CONTENT_COUNT; i++) {
      const userIndex = i % userRecords.length;
      const user = userRecords[userIndex];
      
      const externalId = generateRandomId();
      const content = await createContent(externalId, user.id);
      
      createdContents.push({
        id: content.id,
        externalId: content.externalId,
        assigneeId: content.assigneeId,
        assigneeName: user.name
      });
      
      console.log(`Đã tạo nội dung ${i + 1}/${TOTAL_CONTENT_COUNT}: ID ${content.id}, External ID: ${content.externalId}, phân công cho ${user.name}`);
    }
    
    console.log('\nThống kê nội dung đã tạo theo người dùng:');
    for (const user of userRecords) {
      const userContents = createdContents.filter(c => c.assigneeId === user.id);
      console.log(`${user.name}: ${userContents.length} nội dung`);
    }
    
    console.log('\nHoàn tất mô phỏng Kafka!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi mô phỏng Kafka:', error);
    process.exit(1);
  }
}

// Thực thi mô phỏng
simulateKafkaRoundRobin();