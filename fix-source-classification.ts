
import { db } from "./server/db";
import { contents, realUsers, pages, groups } from "./shared/schema";
import { sql, eq, and } from "drizzle-orm";

async function fixSourceClassification() {
  try {
    console.log("🔄 Bắt đầu cập nhật source_classification cho tất cả nội dung...");

    // 1. Cập nhật cho real users (accounts)
    console.log("\n📱 Cập nhật cho accounts...");
    const realUsersData = await db.select().from(realUsers);
    
    for (const user of realUsersData) {
      const userId = user.fullName ? 
        (typeof user.fullName === 'string' ? 
          JSON.parse(user.fullName).id : 
          user.fullName.id) : 
        user.id.toString();
      
      const updateResult = await db
        .update(contents)
        .set({ source_classification: user.classification || 'new' })
        .where(
          and(
            sql`LOWER(source::json->>'type') = 'account'`,
            sql`source::json->>'id' = ${userId}`
          )
        )
        .returning({ id: contents.id });
      
      if (updateResult.length > 0) {
        console.log(`✅ User "${user.fullName?.name || 'Unknown'}" (${userId}): Cập nhật ${updateResult.length} nội dung thành "${user.classification}"`);
      }
    }

    // 2. Cập nhật cho pages
    console.log("\n📄 Cập nhật cho pages...");
    const pagesData = await db.select().from(pages);
    
    for (const page of pagesData) {
      const pageId = page.pageName ? 
        (typeof page.pageName === 'string' ? 
          JSON.parse(page.pageName).id : 
          page.pageName.id) : 
        page.id.toString();
      
      const updateResult = await db
        .update(contents)
        .set({ source_classification: page.classification || 'new' })
        .where(
          and(
            sql`LOWER(source::json->>'type') = 'page'`,
            sql`source::json->>'id' = ${pageId}`
          )
        )
        .returning({ id: contents.id });
      
      if (updateResult.length > 0) {
        console.log(`✅ Page "${page.pageName?.name || 'Unknown'}" (${pageId}): Cập nhật ${updateResult.length} nội dung thành "${page.classification}"`);
      }
    }

    // 3. Cập nhật cho groups
    console.log("\n👥 Cập nhật cho groups...");
    const groupsData = await db.select().from(groups);
    
    for (const group of groupsData) {
      const groupId = group.groupName ? 
        (typeof group.groupName === 'string' ? 
          JSON.parse(group.groupName).id : 
          group.groupName.id) : 
        group.id.toString();
      
      const updateResult = await db
        .update(contents)
        .set({ source_classification: group.classification || 'new' })
        .where(
          and(
            sql`LOWER(source::json->>'type') = 'group'`,
            sql`source::json->>'id' = ${groupId}`
          )
        )
        .returning({ id: contents.id });
      
      if (updateResult.length > 0) {
        console.log(`✅ Group "${group.groupName?.name || 'Unknown'}" (${groupId}): Cập nhật ${updateResult.length} nội dung thành "${group.classification}"`);
      }
    }

    // 4. Kiểm tra kết quả
    console.log("\n📊 Kiểm tra kết quả sau khi cập nhật:");
    const stats = await db
      .select({
        source_classification: contents.sourceClassification,
        count: sql<number>`count(*)`
      })
      .from(contents)
      .groupBy(contents.sourceClassification)
      .orderBy(contents.sourceClassification);
    
    stats.forEach(stat => {
      console.log(`📈 ${stat.source_classification}: ${stat.count} nội dung`);
    });

    // 5. Kiểm tra cụ thể cho user "Dương Tôn Lữ"
    console.log("\n🔍 Kiểm tra cụ thể cho user 'Dương Tôn Lữ':");
    const duongTonUser = realUsersData.find(user => 
      user.fullName?.name?.includes("Dương Tôn Lữ")
    );
    
    if (duongTonUser) {
      const userId = duongTonUser.fullName ? 
        (typeof duongTonUser.fullName === 'string' ? 
          JSON.parse(duongTonUser.fullName).id : 
          duongTonUser.fullName.id) : 
        duongTonUser.id.toString();
      
      const userContents = await db
        .select({
          id: contents.id,
          externalId: contents.externalId,
          source_classification: contents.sourceClassification
        })
        .from(contents)
        .where(
          and(
            sql`LOWER(source::json->>'type') = 'account'`,
            sql`source::json->>'id' = ${userId}`
          )
        );
      
      console.log(`👤 User "Dương Tôn Lữ" (ID: ${userId}, Classification: ${duongTonUser.classification}):`);
      console.log(`📋 Có ${userContents.length} nội dung:`);
      userContents.forEach(content => {
        console.log(`   - External ID: ${content.externalId}, Source Classification: ${content.source_classification}`);
      });
    }

    console.log("\n✅ Hoàn thành cập nhật source_classification!");
    
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật source_classification:", error);
  }
}

// Chạy script
fixSourceClassification()
  .then(() => {
    console.log("🎉 Script hoàn thành!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script thất bại:", error);
    process.exit(1);
  });
