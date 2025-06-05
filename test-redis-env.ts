
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log('🔍 Kiểm tra biến môi trường Redis Search...');
console.log('==========================================');

console.log('REDISEARCH_HOST:', process.env.REDISEARCH_HOST || 'NOT FOUND');
console.log('REDISEARCH_PORT:', process.env.REDISEARCH_PORT || 'NOT FOUND');
console.log('REDISEARCH_PASSWORD:', process.env.REDISEARCH_PASSWORD ? '***HIDDEN***' : 'NOT FOUND');

console.log('==========================================');

// Test connection (basic ping without actually connecting)
if (process.env.REDISEARCH_HOST && process.env.REDISEARCH_PORT && process.env.REDISEARCH_PASSWORD) {
  console.log('✅ Tất cả biến môi trường Redis Search đã được tìm thấy!');
  console.log(`📍 Redis Search Server: ${process.env.REDISEARCH_HOST}:${process.env.REDISEARCH_PORT}`);
} else {
  console.log('❌ Thiếu một số biến môi trường Redis Search');
}

process.exit(0);
