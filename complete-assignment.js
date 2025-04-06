import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

// Danh sách người dùng được phân công xử lý
const USER_IDS = [2, 3, 4, 5]; // Hoàng Anh, Minh Phương, Lâm Hồng, Thanh Hà
const NEEDED_PER_USER = 2; // Cần thêm 2 nội dung cho mỗi người

async function completeAssignment() {
  try {
    console.log('Hoàn thành phân công nội dung...');
    const currentDate = new Date('2025-04-06');
    
    // Lấy nội dung chưa được phân công
    const unassignedContents = await db.execute(sql`
      SELECT id FROM contents 
      WHERE assigned_to_id IS NULL 
      ORDER BY id 
      LIMIT ${USER_IDS.length * NEEDED_PER_USER}
    `);
    
    console.log(`Đã tìm thấy ${unassignedContents.rows.length} nội dung chưa phân công`);
    
    // Phân công nội dung
    let index = 0;
    for (const userId of USER_IDS) {
      for (let i = 0; i < NEEDED_PER_USER; i++) {
        if (index < unassignedContents.rows.length) {
          const contentId = unassignedContents.rows[index].id;
          
          await db.execute(sql`
            UPDATE contents 
            SET assigned_to_id = ${userId}, assigned_at = ${currentDate} 
            WHERE id = ${contentId}
          `);
          
          console.log(`Đã phân công nội dung ID: ${contentId} cho người dùng ID: ${userId}`);
          index++;
        }
      }
    }
    
    // Kiểm tra kết quả phân công
    const finalResult = await db.execute(sql`
      SELECT u.name, COUNT(*) as count
      FROM contents c
      JOIN users u ON c.assigned_to_id = u.id
      GROUP BY u.name
      ORDER BY u.name
    `);
    
    console.log('\nPhân bố nội dung sau khi hoàn tất:');
    finalResult.rows.forEach(row => {
      console.log(`${row.name}: ${row.count} nội dung`);
    });
    
    console.log('\nHoàn tất phân công nội dung!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi hoàn tất phân công nội dung:', error);
    process.exit(1);
  }
}

// Thực thi
completeAssignment();