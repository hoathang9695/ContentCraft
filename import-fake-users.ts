
import xlsx from 'xlsx';
import { db } from './server/db';
import { fakeUsers } from './shared/schema';
import { sql } from 'drizzle-orm';

async function importFakeUsers() {
  try {
    // Đọc file Excel
    const workbook = xlsx.readFile('./attached_assets/Import.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    console.log(`Đã tìm thấy ${data.length} người dùng fake để nhập`);

    // Kiểm tra dữ liệu hiện tại
    const existingUsers = await db.select().from(fakeUsers);
    console.log(`Hiện có ${existingUsers.length} người dùng fake trong cơ sở dữ liệu`);

    // Import từng người dùng
    for (const user of data) {
      // Kiểm tra xem token đã tồn tại chưa
      const existingUser = await db
        .select()
        .from(fakeUsers)
        .where(sql`token = ${user.token}`);

      if (existingUser.length > 0) {
        console.log(`Bỏ qua user có token đã tồn tại: ${user.token}`);
        continue;
      }

      // Thêm người dùng mới
      await db.insert(fakeUsers).values({
        name: user.name,
        token: user.token,
        status: user.status || 'active',
        description: user.description || null
      });

      console.log(`Đã thêm user: ${user.name}`);
    }

    console.log('Hoàn thành import dữ liệu');
  } catch (error) {
    console.error('Lỗi khi import dữ liệu:', error);
  } finally {
    process.exit(0);
  }
}

// Chạy script
importFakeUsers();
