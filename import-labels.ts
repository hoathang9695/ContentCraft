import fs from 'fs';
import { db } from './server/db';
import { labels } from './shared/schema';
import { sql } from 'drizzle-orm';

async function importLabels() {
  try {
    // Đọc dữ liệu từ file JSON
    const labelsData = JSON.parse(fs.readFileSync('./attached_assets/labels.json', 'utf-8'));
    
    console.log(`Đã tìm thấy ${labelsData.length} nhãn để nhập`);
    
    // Kiểm tra bảng labels hiện tại
    const existingLabels = await db.select().from(labels);
    console.log(`Hiện có ${existingLabels.length} nhãn trong cơ sở dữ liệu`);
    
    if (existingLabels.length > 0) {
      console.log('Xóa dữ liệu cũ trước khi nhập mới...');
      await db.delete(labels);
      console.log('Đã xóa dữ liệu cũ');
    }
    
    // Sử dụng câu lệnh SQL trực tiếp để nhập nhiều bản ghi cùng lúc
    // Chuẩn bị chuỗi giá trị cho mệnh đề VALUES
    const valuesString = labelsData.map(label => {
      return `(${label.id}, '${label.name.replace(/'/g, "''")}', ${label.category_id}, '${label.description ? label.description.replace(/'/g, "''") : ""}')`
    }).join(', ');
    
    // Thực hiện lệnh INSERT
    const query = `
      INSERT INTO labels (id, name, category_id, description)
      VALUES ${valuesString}
    `;
    
    await db.execute(sql.raw(query));
    
    console.log(`Đã nhập thành công ${labelsData.length} nhãn`);
    
    // Kiểm tra lại sau khi nhập
    const updatedLabels = await db.select().from(labels);
    console.log(`Bây giờ có ${updatedLabels.length} nhãn trong cơ sở dữ liệu`);
    
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu:', error);
  } finally {
    process.exit(0);
  }
}

// Chạy hàm nhập dữ liệu
importLabels();