import * as fs from 'fs';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { db } from './server/db.ts';
import * as schema from './shared/schema.ts';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);
const { users } = schema;

const usernames = ['hoanganh', 'minhphuong', 'lamhong', 'thanhha'];
const newPassword = '123456';

/**
 * Hàm băm mật khẩu - dùng cùng phương thức như trong server/auth.ts
 */
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Cập nhật mật khẩu cho danh sách người dùng
 */
async function updatePasswords() {
  try {
    console.log('Đang cập nhật mật khẩu...');
    
    // Băm mật khẩu mới
    const hashedPassword = await hashPassword(newPassword);
    
    // Cập nhật mật khẩu cho từng người dùng
    for (const username of usernames) {
      const result = await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.username, username))
        .returning();
      
      if (result.length > 0) {
        console.log(`Đã cập nhật mật khẩu cho người dùng: ${username}`);
      } else {
        console.log(`Không tìm thấy người dùng: ${username}`);
      }
    }
    
    console.log('Đã hoàn tất việc cập nhật mật khẩu');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi cập nhật mật khẩu:', error);
    process.exit(1);
  }
}

// Thực thi cập nhật
updatePasswords();