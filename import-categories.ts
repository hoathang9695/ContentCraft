import fs from 'fs';
import { db } from './server/db';
import { categories } from './shared/schema';

async function importCategories() {
  try {
    // Đọc dữ liệu từ file JSON
    const categoriesData = JSON.parse(fs.readFileSync('./attached_assets/categories.json', 'utf-8'));
    
    console.log(`Đã tìm thấy ${categoriesData.length} danh mục để nhập`);
    
    // Kiểm tra bảng categories hiện tại
    const existingCategories = await db.select().from(categories);
    console.log(`Hiện có ${existingCategories.length} danh mục trong cơ sở dữ liệu`);
    
    if (existingCategories.length > 0) {
      console.log('Xóa dữ liệu cũ trước khi nhập mới...');
      await db.delete(categories);
      console.log('Đã xóa dữ liệu cũ');
    }
    
    // Thêm dữ liệu mới vào bảng categories
    const insertPromises = categoriesData.map(category => {
      return db.insert(categories).values({
        id: category.id,
        name: category.name,
        description: category.description,
        // Các trường ngày tháng được tự động thiết lập với defaultNow()
      });
    });
    
    await Promise.all(insertPromises);
    console.log(`Đã nhập thành công ${categoriesData.length} danh mục`);
    
    // Kiểm tra lại sau khi nhập
    const updatedCategories = await db.select().from(categories);
    console.log(`Bây giờ có ${updatedCategories.length} danh mục trong cơ sở dữ liệu`);
    
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu:', error);
  } finally {
    process.exit(0);
  }
}

// Chạy hàm nhập dữ liệu
importCategories();