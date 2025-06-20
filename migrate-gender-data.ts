
import { db } from "./server/db";
import { fakeUsers } from "./shared/schema";
import { sql, eq } from "drizzle-orm";

async function migrateGenderData() {
  try {
    console.log("🔄 Bắt đầu migrate dữ liệu gender...");

    // Kiểm tra dữ liệu hiện tại
    const currentData = await db
      .select({
        id: fakeUsers.id,
        name: fakeUsers.name,
        gender: fakeUsers.gender
      })
      .from(fakeUsers)
      .where(sql`gender IN ('male', 'female', 'nam', 'nữ', 'Nam', 'Nữ')`);

    console.log(`📊 Tìm thấy ${currentData.length} bản ghi cần migrate`);

    if (currentData.length === 0) {
      console.log("✅ Không có dữ liệu nào cần migrate");
      return;
    }

    // Hiển thị một vài ví dụ
    console.log("\n📋 Một vài ví dụ dữ liệu cần migrate:");
    currentData.slice(0, 5).forEach(user => {
      console.log(`  - ID ${user.id}: ${user.name} (${user.gender})`);
    });

    // Migrate dữ liệu từng loại
    let totalUpdated = 0;

    // 1. Migrate 'male', 'nam', 'Nam' -> 'male_adult'
    console.log("\n🔄 Migrate Nam -> Nam trung niên...");
    const maleResult = await db
      .update(fakeUsers)
      .set({ gender: "male_adult" })
      .where(sql`gender IN ('male', 'nam', 'Nam')`)
      .returning({ id: fakeUsers.id, name: fakeUsers.name });

    console.log(`✅ Đã cập nhật ${maleResult.length} người dùng Nam`);
    totalUpdated += maleResult.length;

    // 2. Migrate 'female', 'nữ', 'Nữ' -> 'female_adult'
    console.log("\n🔄 Migrate Nữ -> Nữ trung niên...");
    const femaleResult = await db
      .update(fakeUsers)
      .set({ gender: "female_adult" })
      .where(sql`gender IN ('female', 'nữ', 'Nữ')`)
      .returning({ id: fakeUsers.id, name: fakeUsers.name });

    console.log(`✅ Đã cập nhật ${femaleResult.length} người dùng Nữ`);
    totalUpdated += femaleResult.length;

    // Kiểm tra kết quả sau khi migrate
    console.log("\n📊 Kiểm tra kết quả sau migrate:");
    const afterMigration = await db
      .select({
        gender: fakeUsers.gender,
        count: sql<number>`count(*)`
      })
      .from(fakeUsers)
      .groupBy(fakeUsers.gender)
      .orderBy(fakeUsers.gender);

    afterMigration.forEach(row => {
      console.log(`  - ${row.gender}: ${row.count} người dùng`);
    });

    console.log(`\n✅ Hoàn thành migrate! Tổng cộng đã cập nhật ${totalUpdated} bản ghi`);

    // Kiểm tra xem còn dữ liệu cũ nào không
    const remainingOldData = await db
      .select({
        id: fakeUsers.id,
        name: fakeUsers.name,
        gender: fakeUsers.gender
      })
      .from(fakeUsers)
      .where(sql`gender IN ('male', 'female', 'nam', 'nữ', 'Nam', 'Nữ')`);

    if (remainingOldData.length > 0) {
      console.log(`\n⚠️ Cảnh báo: Vẫn còn ${remainingOldData.length} bản ghi chưa được migrate:`);
      remainingOldData.forEach(user => {
        console.log(`  - ID ${user.id}: ${user.name} (${user.gender})`);
      });
    } else {
      console.log("\n🎉 Tất cả dữ liệu đã được migrate thành công!");
    }

  } catch (error) {
    console.error("❌ Lỗi khi migrate dữ liệu:", error);
    
    if (error instanceof Error) {
      console.error("Chi tiết lỗi:", error.message);
      console.error("Stack trace:", error.stack);
    }
  }
}

// Chạy migration
migrateGenderData()
  .then(() => {
    console.log("\n✨ Migration script hoàn thành");
    process.exit(0);
  })
  .catch(err => {
    console.error("\n💥 Migration script thất bại:", err);
    process.exit(1);
  });
