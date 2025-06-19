
import { db } from './server/db';
import { fakeUsers } from './shared/schema';

interface TokenValidationResult {
  id: number;
  name: string;
  token: string;
  email?: string;
  password?: string;
  status: string;
  isValidToken: boolean;
  tokenLength: number;
  hasSpecialChars: boolean;
  errorMessage?: string;
}

async function checkFakeUsersTokens() {
  try {
    console.log('🔍 Đang kiểm tra token của tất cả fake users...\n');

    // Lấy tất cả fake users
    const allFakeUsers = await db.select().from(fakeUsers);
    
    if (allFakeUsers.length === 0) {
      console.log('❌ Không tìm thấy fake user nào trong hệ thống');
      return;
    }

    console.log(`📊 Tìm thấy ${allFakeUsers.length} fake users để kiểm tra\n`);

    const results: TokenValidationResult[] = [];
    let validTokens = 0;
    let invalidTokens = 0;
    let duplicateTokens = 0;
    const tokenCounts = new Map<string, number>();

    // Đếm số lần xuất hiện của mỗi token
    allFakeUsers.forEach(user => {
      const count = tokenCounts.get(user.token) || 0;
      tokenCounts.set(user.token, count + 1);
    });

    // Kiểm tra từng fake user
    for (const user of allFakeUsers) {
      const result: TokenValidationResult = {
        id: user.id,
        name: user.name,
        token: user.token,
        email: user.email || undefined,
        password: user.password || undefined,
        status: user.status,
        isValidToken: true,
        tokenLength: user.token.length,
        hasSpecialChars: /[^a-zA-Z0-9]/.test(user.token)
      };

      // Kiểm tra các tiêu chí validation
      const errors: string[] = [];

      // 1. Token không được rỗng
      if (!user.token || user.token.trim() === '') {
        errors.push('Token rỗng');
        result.isValidToken = false;
      }

      // 2. Token phải có độ dài hợp lý (thường >= 10 characters)
      if (user.token.length < 10) {
        errors.push(`Token quá ngắn (${user.token.length} ký tự)`);
        result.isValidToken = false;
      }

      // 3. Token không nên có khoảng trắng
      if (user.token.includes(' ')) {
        errors.push('Token chứa khoảng trắng');
        result.isValidToken = false;
      }

      // 4. Kiểm tra token trùng lặp
      const tokenCount = tokenCounts.get(user.token) || 0;
      if (tokenCount > 1) {
        errors.push(`Token trùng lặp (xuất hiện ${tokenCount} lần)`);
        result.isValidToken = false;
        duplicateTokens++;
      }

      // 5. Token không nên chứa ký tự đặc biệt nguy hiểm
      if (/[<>'"&]/.test(user.token)) {
        errors.push('Token chứa ký tự đặc biệt nguy hiểm');
        result.isValidToken = false;
      }

      if (errors.length > 0) {
        result.errorMessage = errors.join(', ');
        invalidTokens++;
      } else {
        validTokens++;
      }

      results.push(result);
    }

    // Báo cáo tổng quan
    console.log('📈 TỔNG QUAN KIỂM TRA TOKEN:');
    console.log(`✅ Token hợp lệ: ${validTokens}`);
    console.log(`❌ Token không hợp lệ: ${invalidTokens}`);
    console.log(`🔄 Token trùng lặp: ${duplicateTokens > 0 ? duplicateTokens : 0}\n`);

    // Chi tiết fake users có vấn đề
    const problematicUsers = results.filter(r => !r.isValidToken);
    if (problematicUsers.length > 0) {
      console.log('🚨 CHI TIẾT FAKE USERS CÓ VẤN ĐỀ:');
      console.log('─'.repeat(80));
      
      problematicUsers.forEach((user, index) => {
        console.log(`${index + 1}. User ID: ${user.id}`);
        console.log(`   Tên: ${user.name}`);
        console.log(`   Token: "${user.token}"`);
        console.log(`   Email: ${user.email || 'Không có'}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Độ dài token: ${user.tokenLength}`);
        console.log(`   Lỗi: ${user.errorMessage}`);
        console.log('');
      });
    }

    // Thống kê chi tiết
    console.log('📊 THỐNG KÊ CHI TIẾT:');
    console.log('─'.repeat(50));
    
    const statusCounts = results.reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Phân bổ theo status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} users`);
    });

    const tokenLengthStats = {
      min: Math.min(...results.map(r => r.tokenLength)),
      max: Math.max(...results.map(r => r.tokenLength)),
      avg: Math.round(results.reduce((sum, r) => sum + r.tokenLength, 0) / results.length)
    };

    console.log('\nThống kê độ dài token:');
    console.log(`  Ngắn nhất: ${tokenLengthStats.min} ký tự`);
    console.log(`  Dài nhất: ${tokenLengthStats.max} ký tự`);
    console.log(`  Trung bình: ${tokenLengthStats.avg} ký tự`);

    const usersWithEmail = results.filter(r => r.email).length;
    const usersWithPassword = results.filter(r => r.password).length;
    
    console.log('\nThông tin bổ sung:');
    console.log(`  Có email: ${usersWithEmail}/${results.length} users`);
    console.log(`  Có password: ${usersWithPassword}/${results.length} users`);

    // Kiểm tra token trùng lặp cụ thể
    const duplicateTokensList = Array.from(tokenCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([token, count]) => ({ token, count }));

    if (duplicateTokensList.length > 0) {
      console.log('\n🔄 TOKENS TRÙNG LẶP:');
      console.log('─'.repeat(50));
      duplicateTokensList.forEach(({ token, count }) => {
        console.log(`Token: "${token}" - Xuất hiện ${count} lần`);
        const usersWithToken = results.filter(r => r.token === token);
        usersWithToken.forEach(user => {
          console.log(`  - User ${user.id}: ${user.name}`);
        });
        console.log('');
      });
    }

    // Khuyến nghị
    console.log('💡 KHUYẾN NGHỊ:');
    console.log('─'.repeat(40));
    
    if (invalidTokens > 0) {
      console.log('• Cần sửa hoặc thay thế các token không hợp lệ');
    }
    
    if (duplicateTokens > 0) {
      console.log('• Cần tạo token mới cho các user có token trùng lặp');
    }
    
    if (usersWithEmail < results.length * 0.5) {
      console.log('• Khuyến nghị thêm email cho nhiều fake users hơn');
    }
    
    if (usersWithPassword < results.length * 0.5) {
      console.log('• Khuyến nghị thêm password cho nhiều fake users hơn');
    }

    if (validTokens === results.length) {
      console.log('✅ Tất cả tokens đều hợp lệ!');
    }

  } catch (error) {
    console.error('❌ Lỗi khi kiểm tra fake users tokens:', error);
  } finally {
    process.exit(0);
  }
}

// Chạy script
checkFakeUsersTokens();
