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

// Hàm chính để tạo dữ liệu
async function completeKafkaSimulation() {
  try {
    console.log('Kiểm tra và bổ sung dữ liệu còn thiếu...');
    
    // Lấy thông tin người dùng
    const userRecords = [];
    for (const username of USER_USERNAMES) {
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user.length > 0) {
        userRecords.push(user[0]);
      } else {
        console.error(`Không tìm thấy người dùng: ${username}`);
        process.exit(1);
      }
    }
    
    // Kiểm tra số lượng nội dung hiện có
    const existingContents = await db.select().from(contents);
    console.log(`Số lượng nội dung hiện có: ${existingContents.length}`);
    
    // Kiểm tra số lượng nội dung theo từng người dùng
    const contentByUser = {};
    userRecords.forEach(user => {
      contentByUser[user.id] = existingContents.filter(content => content.assigneeId === user.id).length;
      console.log(`${user.name} (ID: ${user.id}): ${contentByUser[user.id]}/${CONTENT_COUNT_PER_USER} nội dung`);
    });
    
    // Thêm nội dung còn thiếu
    const currentDate = new Date('2025-04-06');
    const insertPromises = [];
    
    for (const user of userRecords) {
      const contentsNeeded = CONTENT_COUNT_PER_USER - contentByUser[user.id];
      
      if (contentsNeeded > 0) {
        console.log(`Cần tạo thêm ${contentsNeeded} nội dung cho ${user.name}`);
        
        for (let i = 0; i < contentsNeeded; i++) {
          const externalId = generateRandomId();
          
          insertPromises.push(
            db.insert(contents).values({
              externalId,
              source: 'Web Trẻ Thơ',
              sourceVerification: 'unverified',
              status: 'pending',
              assigneeId: user.id,
              comments: 0,
              reactions: 0,
              createdAt: currentDate,
              updatedAt: currentDate
            })
          );
        }
      }
    }
    
    if (insertPromises.length > 0) {
      await Promise.all(insertPromises);
      console.log(`Đã tạo thêm ${insertPromises.length} nội dung`);
    } else {
      console.log('Không cần tạo thêm nội dung');
    }
    
    // Kiểm tra lại sau khi thêm
    const finalContents = await db.select().from(contents);
    console.log(`\nTổng số nội dung sau khi bổ sung: ${finalContents.length}`);
    
    // Thống kê cuối cùng
    console.log('\nThống kê nội dung theo người dùng:');
    for (const user of userRecords) {
      const userContentCount = finalContents.filter(content => content.assigneeId === user.id).length;
      console.log(`${user.name} (ID: ${user.id}): ${userContentCount}/${CONTENT_COUNT_PER_USER} nội dung`);
    }
    
    console.log('\nHoàn tất mô phỏng Kafka!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi mô phỏng Kafka:', error);
    process.exit(1);
  }
}

// Thực thi mô phỏng
completeKafkaSimulation();