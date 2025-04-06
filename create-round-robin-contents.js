import { db } from './server/db.ts';
import * as schema from './shared/schema.ts';
import { eq } from 'drizzle-orm';

const { users, contents } = schema;

// Danh sách người dùng được phân công xử lý
const USER_USERNAMES = ['hoanganh', 'minhphuong', 'lamhong', 'thanhha'];
const CONTENT_COUNT_PER_USER = 10; // Số lượng nội dung cho mỗi người dùng

// Hàm tạo ID ngẫu nhiên 18 chữ số
function generateRandomId() {
  return Math.floor(100000000000000000 + Math.random() * 900000000000000000).toString();
}

async function createRoundRobinContents() {
  try {
    console.log('Tạo nội dung theo phương thức chia vòng tròn...');
    
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
    
    // Tạo nội dung cho từng người dùng
    const currentDate = new Date('2025-04-06');
    const insertPromises = [];
    const totalContentCount = USER_USERNAMES.length * CONTENT_COUNT_PER_USER;
    
    for (let i = 0; i < totalContentCount; i++) {
      const userIndex = i % userRecords.length;
      const user = userRecords[userIndex];
      
      console.log(`Tạo nội dung ${i+1}/${totalContentCount} cho ${user.name}`);
      
      // Tạo ID ngẫu nhiên 18 chữ số
      const externalId = generateRandomId();
      
      // Thêm nội dung vào cơ sở dữ liệu
      const result = await db.insert(contents).values({
        externalId,
        source: 'Web Trẻ Thơ',
        sourceVerification: 'unverified',
        status: 'pending',
        assignedToId: user.id,
        assignedAt: currentDate,
        comments: 0,
        reactions: 0,
        createdAt: currentDate,
        updatedAt: currentDate
      }).returning();
      
      console.log(`Đã tạo nội dung ID: ${result[0].id}, External ID: ${result[0].externalId} cho ${user.name}`);
    }
    
    // Kiểm tra kết quả
    const assignedContents = await db.select({
      assignedToId: contents.assignedToId,
      name: users.name,
      count: db.fn.count(contents.id)
    })
    .from(contents)
    .join(users, eq(contents.assignedToId, users.id))
    .groupBy(contents.assignedToId, users.name);
    
    console.log('\nPhân bố nội dung:');
    assignedContents.forEach(result => {
      console.log(`${result.name}: ${result.count} nội dung`);
    });
    
    console.log('\nHoàn tất tạo nội dung!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi tạo nội dung:', error);
    process.exit(1);
  }
}

// Thực thi
createRoundRobinContents();