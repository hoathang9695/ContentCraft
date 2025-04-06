import { db } from './server/db.ts';
import * as schema from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

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
    
    // Sử dụng SQL trực tiếp để đếm nội dung
    const countQuery = await db.execute(sql`
      SELECT "assigned_to_id" as id, COUNT(*) as count
      FROM contents
      GROUP BY "assigned_to_id"
    `);
    
    // Phân tích kết quả
    const userContentCounts = {};
    countQuery.rows.forEach(row => {
      userContentCounts[row.id] = parseInt(row.count, 10);
    });
    
    // Hiển thị số lượng nội dung hiện có
    console.log('\nSố lượng nội dung hiện có:');
    Object.keys(userMap).forEach(userId => {
      const count = userContentCounts[userId] || 0;
      console.log(`${userMap[userId].name}: ${count}/${CONTENT_COUNT_PER_USER} nội dung`);
    });
    
    // Bổ sung nội dung còn thiếu
    const currentDate = new Date('2025-04-06');
    
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
    
    // Kiểm tra lại bằng SQL trực tiếp
    const finalCountQuery = await db.execute(sql`
      SELECT u.name, COUNT(*) as count
      FROM contents c
      JOIN users u ON c."assigned_to_id" = u.id
      GROUP BY u.name
    `);
    
    console.log('\nSố lượng nội dung sau khi bổ sung:');
    finalCountQuery.rows.forEach(row => {
      console.log(`${row.name}: ${row.count} nội dung`);
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