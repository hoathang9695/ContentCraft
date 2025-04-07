/**
 * Script phân phối nội dung cho 4 người dùng theo phương thức vòng tròn
 */
import { db } from './server/db';
import { users, contents } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

// Danh sách người dùng sẽ được phân công
const USER_USERNAMES = ['minhanh', 'ngocanh', 'hoanganh', 'lamanh'];
// Số lượng nội dung mỗi người dùng
const CONTENT_PER_USER = 5;

// Tạo ID ngẫu nhiên 18 chữ số
function generateRandomId(): string {
  return Math.floor(100000000000000000 + Math.random() * 900000000000000000).toString();
}

// Hàm chính để tạo nội dung
async function createRoundRobinContents() {
  try {
    console.log('Bắt đầu tạo nội dung theo phương thức chia vòng tròn...');
    
    // Lấy thông tin người dùng
    const userRecords: any[] = [];
    for (const username of USER_USERNAMES) {
      const result = await db.select().from(users).where(eq(users.username, username));
      if (result.length > 0) {
        userRecords.push(result[0]);
        console.log(`Đã tìm thấy người dùng: ${username} (ID: ${result[0].id})`);
      } else {
        console.error(`Không tìm thấy người dùng: ${username}`);
        process.exit(1);
      }
    }
    
    // Xóa tất cả nội dung hiện tại
    console.log('Xóa tất cả nội dung hiện tại...');
    await db.delete(contents);
    
    // Tạo nội dung cho từng người dùng
    const currentDate = new Date();
    const totalContentCount = USER_USERNAMES.length * CONTENT_PER_USER;
    
    for (let i = 0; i < totalContentCount; i++) {
      const userIndex = i % userRecords.length;
      const user = userRecords[userIndex];
      
      console.log(`Tạo nội dung ${i+1}/${totalContentCount} cho ${user.username}`);
      
      // Tạo ID ngẫu nhiên 18 chữ số
      const externalId = generateRandomId();
      
      // Thêm nội dung vào cơ sở dữ liệu
      await db.insert(contents).values({
        externalId: externalId,
        source: 'Web Trẻ Thơ',
        sourceVerification: 'unverified',
        status: 'pending',
        assigned_to_id: user.id,
        assignedAt: currentDate,
        comments: 0,
        reactions: 0,
        createdAt: currentDate
      });
    }
    
    console.log('Đã hoàn thành việc tạo nội dung theo phương thức chia vòng tròn.');
    
    // Hiển thị thống kê
    console.log('\nThống kê phân công:');
    for (const user of userRecords) {
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(contents)
        .where(eq(contents.assigned_to_id, user.id));
      
      console.log(`- ${user.username}: ${count[0].count} nội dung`);
    }
  } catch (error) {
    console.error('Lỗi khi tạo nội dung:', error);
  }
}

// Chạy hàm tạo nội dung
createRoundRobinContents()
  .then(() => {
    console.log('Script đã hoàn tất.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Lỗi:', error);
    process.exit(1);
  });