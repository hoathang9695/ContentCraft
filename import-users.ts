import fs from 'fs';
import { db } from './server/db';
import { users } from './shared/schema';
import { sql } from 'drizzle-orm';

async function importUsers() {
  try {
    // Đọc dữ liệu từ file JSON
    const usersData = JSON.parse(fs.readFileSync('./attached_assets/users.json', 'utf-8'));
    
    console.log(`Đã tìm thấy ${usersData.length} người dùng để nhập`);
    
    // Kiểm tra bảng users hiện tại
    const existingUsers = await db.select().from(users);
    console.log(`Hiện có ${existingUsers.length} người dùng trong cơ sở dữ liệu`);
    
    // Xóa tất cả người dùng hiện tại trừ người dùng admin (id = 1)
    if (existingUsers.length > 1) {
      console.log('Xóa dữ liệu người dùng không phải admin...');
      await db.execute(sql`DELETE FROM users WHERE id > 1`);
      console.log('Đã xóa dữ liệu người dùng không phải admin');
    }
    
    // Lọc ra những người dùng chưa tồn tại (id > 1)
    const usersToImport = usersData.filter(user => user.id > 1);
    
    if (usersToImport.length === 0) {
      console.log('Không có người dùng mới cần nhập');
      return;
    }
    
    // Chuẩn bị chuỗi giá trị cho mệnh đề VALUES
    const valuesString = usersToImport.map(user => {
      return `(${user.id}, '${user.username.replace(/'/g, "''")}', '${user.password.replace(/'/g, "''")}', 
        '${user.name.replace(/'/g, "''")}', '${user.email.replace(/'/g, "''")}', 
        '${user.department.replace(/'/g, "''")}', '${user.position.replace(/'/g, "''")}', 
        '${user.role.replace(/'/g, "''")}', '${user.status.replace(/'/g, "''")}', 
        ${user.avatar_url ? `'${user.avatar_url.replace(/'/g, "''")}'` : 'NULL'}, 
        '${user.created_at.replace(/'/g, "''")}')`
    }).join(', ');
    
    // Thực hiện lệnh INSERT
    const query = `
      INSERT INTO users (id, username, password, name, email, department, position, role, status, avatar_url, created_at)
      VALUES ${valuesString}
    `;
    
    await db.execute(sql.raw(query));
    
    console.log(`Đã nhập thành công ${usersToImport.length} người dùng mới`);
    
    // Kiểm tra lại sau khi nhập
    const updatedUsers = await db.select().from(users);
    console.log(`Bây giờ có ${updatedUsers.length} người dùng trong cơ sở dữ liệu`);
    
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu người dùng:', error);
  } finally {
    process.exit(0);
  }
}

// Chạy hàm nhập dữ liệu
importUsers();