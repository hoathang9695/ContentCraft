import { db } from './server/db.ts';
import * as schema from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

const { users, contents } = schema;

// Danh sách người dùng được phân công xử lý
const USER_USERNAMES = ['hoanganh', 'minhphuong', 'lamhong', 'thanhha'];
const CONTENT_COUNT_PER_USER = 10; // Số lượng nội dung cho mỗi người dùng

async function fixAssignContent() {
  try {
    console.log('Bắt đầu phân công nội dung...');
    
    // Lấy thông tin người dùng
    const userMap = {};
    for (const username of USER_USERNAMES) {
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user.length > 0) {
        userMap[username] = user[0];
        console.log(`Đã tìm thấy người dùng: ${username} (ID: ${user[0].id})`);
      }
    }
    
    // Lấy tất cả nội dung chưa được phân công
    const allContents = await db.select().from(contents).where(sql`assigned_to_id IS NULL`);
    console.log(`Tìm thấy ${allContents.length} nội dung chưa được phân công`);
    
    // Phân công nội dung theo phương thức chia vòng tròn
    const currentDate = new Date('2025-04-06');
    const updates = [];
    
    for (let i = 0; i < allContents.length; i++) {
      const content = allContents[i];
      const userIndex = i % USER_USERNAMES.length;
      const username = USER_USERNAMES[userIndex];
      const userId = userMap[username].id;
      
      // Cập nhật nội dung
      const updateResult = await db.execute(sql`
        UPDATE contents 
        SET assigned_to_id = ${userId}, assigned_at = ${currentDate} 
        WHERE id = ${content.id}
      `);
      
      console.log(`Đã phân công nội dung ID: ${content.id} cho ${userMap[username].name} (${username})`);
    }
    
    // Kiểm tra kết quả phân công
    const distributionResult = await db.execute(sql`
      SELECT u.name, COUNT(*) as count
      FROM contents c
      JOIN users u ON c.assigned_to_id = u.id
      GROUP BY u.name
      ORDER BY count DESC
    `);
    
    console.log('\nPhân bố nội dung sau khi phân công:');
    distributionResult.rows.forEach(row => {
      console.log(`${row.name}: ${row.count} nội dung`);
    });
    
    console.log('\nHoàn tất phân công nội dung!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi phân công nội dung:', error);
    process.exit(1);
  }
}

// Thực thi
fixAssignContent();