import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Hàm chính để tạo mật khẩu
async function main() {
  const password = "123456"; // Mật khẩu chung
  const hashedPassword = await hashPassword(password);
  console.log(hashedPassword);
}

main();