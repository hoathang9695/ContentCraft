import { db } from './server/db';
import { contents, users } from './shared/schema';
import { sql } from 'drizzle-orm';

async function simulateContentKafka() {
  try {
    console.log('Bắt đầu mô phỏng Kafka gửi 30 nội dung...');
    
    // Lấy thông tin người dùng để phân công
    const editors = await db.select().from(users).where(sql`role = 'editor'`);
    
    if (editors.length === 0) {
      console.error('Không tìm thấy người dùng có vai trò editor');
      return;
    }
    
    console.log(`Tìm thấy ${editors.length} người dùng editor để phân công nội dung`);
    
    // Xoá nội dung hiện có (nếu cần)
    const existingContents = await db.select().from(contents);
    if (existingContents.length > 0) {
      console.log(`Xóa ${existingContents.length} nội dung hiện có...`);
      await db.delete(contents);
      console.log('Đã xóa nội dung hiện có');
    }
    
    // Tạo 30 nội dung và phân chia theo vòng tròn
    const totalContents = 30;
    
    // Sử dụng SQL trực tiếp để tránh các vấn đề về kiểu dữ liệu
    for (let i = 0; i < totalContents; i++) {
      // Phân chia theo vòng tròn
      const assignedEditorIndex = i % editors.length;
      const assignedEditor = editors[assignedEditorIndex];
      
      // Tạo ID ngẫu nhiên cho externalId
      const randomId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      const externalId = `CONTENT-${randomId}`;
      
      await db.execute(sql`
        INSERT INTO contents (
          external_id, source, status, source_verification, 
          assigned_to_id, assigned_at, comments, reactions
        ) VALUES (
          ${externalId}, 'Web Trẻ Thơ', 'processing', 'unverified',
          ${assignedEditor.id}, NOW(), 0, 0
        )
      `);
    }
    
    console.log(`Đã tạo và phân công ${totalContents} nội dung mới`);
    
    // Kiểm tra lại sau khi thêm
    const newContents = await db.select().from(contents);
    console.log(`Hiện có ${newContents.length} nội dung trong cơ sở dữ liệu`);
    
    // Đếm số lượng công việc được phân công cho mỗi editor
    for (const editor of editors) {
      const count = await db.select({ count: sql`count(*)` }).from(contents)
        .where(sql`assigned_to_id = ${editor.id}`);
      
      console.log(`${editor.name} (${editor.username}) được phân công ${count[0].count} nội dung`);
    }
    
  } catch (error) {
    console.error('Lỗi khi mô phỏng dữ liệu Kafka:', error);
  } finally {
    process.exit(0);
  }
}

// Chạy hàm mô phỏng
simulateContentKafka();