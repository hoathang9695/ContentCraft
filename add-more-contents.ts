import { db } from './server/db';
import { contents, users } from './shared/schema';
import { sql } from 'drizzle-orm';

async function addMoreContents() {
  try {
    console.log('Bắt đầu thêm nội dung bổ sung...');
    
    // Lấy thông tin người dùng để phân công
    const editors = await db.select().from(users).where(sql`role = 'editor'`);
    
    if (editors.length === 0) {
      console.error('Không tìm thấy người dùng có vai trò editor');
      return;
    }
    
    console.log(`Tìm thấy ${editors.length} người dùng editor để phân công nội dung`);
    
    // Đếm số lượng nội dung hiện tại
    const currentContentCount = await db.select({ count: sql`count(*)` }).from(contents);
    const currentCount = Number(currentContentCount[0].count);
    console.log(`Hiện có ${currentCount} nội dung trong cơ sở dữ liệu`);
    
    // Tính số lượng nội dung cần thêm
    const targetCount = 30;
    const additionalNeeded = targetCount - currentCount;
    
    if (additionalNeeded <= 0) {
      console.log('Đã đủ hoặc vượt quá số lượng nội dung cần thiết');
      return;
    }
    
    console.log(`Cần thêm ${additionalNeeded} nội dung nữa để đạt ${targetCount}`);
    
    // Thêm nội dung bổ sung
    for (let i = 0; i < additionalNeeded; i++) {
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
    
    // Kiểm tra lại sau khi thêm
    const newContentCount = await db.select({ count: sql`count(*)` }).from(contents);
    console.log(`Hiện có ${newContentCount[0].count} nội dung trong cơ sở dữ liệu`);
    
    // Đếm số lượng công việc được phân công cho mỗi editor
    for (const editor of editors) {
      const count = await db.select({ count: sql`count(*)` }).from(contents)
        .where(sql`assigned_to_id = ${editor.id}`);
      
      console.log(`${editor.name} (${editor.username}) được phân công ${count[0].count} nội dung`);
    }
    
  } catch (error) {
    console.error('Lỗi khi thêm nội dung bổ sung:', error);
  } finally {
    process.exit(0);
  }
}

// Chạy hàm thêm nội dung
addMoreContents();