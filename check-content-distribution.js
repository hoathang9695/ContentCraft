import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function checkContentDistribution() {
  try {
    console.log('Kiểm tra phân bố nội dung...');
    
    // Kiểm tra bằng SQL trực tiếp
    const query = await db.execute(sql`
      SELECT u.name, COUNT(*) as count
      FROM contents c
      JOIN users u ON c."assigned_to_id" = u.id
      GROUP BY u.name
      ORDER BY u.name
    `);
    
    console.log('\nSố lượng nội dung theo người dùng:');
    query.rows.forEach(row => {
      console.log(`${row.name}: ${row.count} nội dung`);
    });
    
    // Lấy mẫu các nội dung để kiểm tra
    const contentSamples = await db.execute(sql`
      SELECT c.id, c.external_id, c.source, c.status, u.name as assigned_to_name
      FROM contents c
      JOIN users u ON c."assigned_to_id" = u.id
      ORDER BY c.id
      LIMIT 10
    `);
    
    console.log('\nMẫu nội dung:');
    contentSamples.rows.forEach(content => {
      console.log(`ID: ${content.id}, External ID: ${content.external_id}, Source: ${content.source}, Status: ${content.status}, Assigned to: ${content.assigned_to_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi kiểm tra phân bố nội dung:', error);
    process.exit(1);
  }
}

// Thực thi
checkContentDistribution();