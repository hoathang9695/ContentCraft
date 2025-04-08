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

async function completeContents() {
  try {
    console.log('Bổ sung nội dung còn thiếu...');
    
    // Lấy thông tin người dùng
    const userMap = {};
    for (const username of USER_USERNAMES) {
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user.length > 0) {
        userMap[user[0].id] = user[0];
        console.log(`Đã tìm thấy người dùng: ${username} (ID: ${user[0].id})`);
      }
    }
    
    // Kiểm tra số lượng nội dung hiện có của từng người dùng
    const contentCounts = await db.select({
      assignedToId: contents.assignedToId,
      count: db.fn.count(contents.id).as('count')
    })
    .from(contents)
    .groupBy(contents.assignedToId);
    
    const userContentCounts = {};
    contentCounts.forEach(item => {
      userContentCounts[item.assignedToId] = parseInt(item.count.toString(), 10);
    });
    
    // Hiển thị số lượng nội dung hiện có
    console.log('\nSố lượng nội dung hiện có:');
    Object.keys(userMap).forEach(userId => {
      const count = userContentCounts[userId] || 0;
      console.log(`${userMap[userId].name}: ${count}/${CONTENT_COUNT_PER_USER} nội dung`);
    });
    
    // Bổ sung nội dung còn thiếu
    const currentDate = new Date('2025-04-06');
    const promises = [];
    
    for (const userId in userMap) {
      const user = userMap[userId];
      const currentCount = userContentCounts[userId] || 0;
      const neededCount = CONTENT_COUNT_PER_USER - currentCount;
      
      if (neededCount > 0) {
        console.log(`\nBổ sung ${neededCount} nội dung cho ${user.name}...`);
        
        for (let i = 0; i < neededCount; i++) {
          const externalId = generateRandomId();
          
          const result = await db.insert(contents).values({
            externalId,
            source: 'Web Trẻ Thơ',
            sourceVerification: 'unverified',
            status: 'pending',
            assignedToId: parseInt(userId, 10),
            assignedAt: currentDate,
            comments: 0,
            reactions: 0,
            createdAt: currentDate,
            updatedAt: currentDate
          }).returning();
          
          console.log(`Đã tạo nội dung ID: ${result[0].id}, External ID: ${result[0].externalId} cho ${user.name}`);
        }
      }
    }
    
    // Kiểm tra lại sau khi bổ sung
    const finalCounts = await db.select({
      assignedToId: contents.assignedToId,
      name: users.name,
      count: db.fn.count(contents.id).as('count')
    })
    .from(contents)
    .join(users, eq(contents.assignedToId, users.id))
    .groupBy(contents.assignedToId, users.name);
    
    console.log('\nSố lượng nội dung sau khi bổ sung:');
    finalCounts.forEach(item => {
      console.log(`${item.name}: ${item.count.toString()} nội dung`);
    });
    
    console.log('\nHoàn tất bổ sung nội dung!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi bổ sung nội dung:', error);
    process.exit(1);
  }
}

// Thực thi
completeContents();