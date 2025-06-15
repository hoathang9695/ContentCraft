import { db } from "./server/db";
import { contents, realUsers, pages, groups } from "./shared/schema";
import { sql, eq, and } from "drizzle-orm";

async function fixSourceClassification() {
  try {
    console.log("🔄 Bắt đầu cập nhật source_classification cho tất cả nội dung...");

    let totalUpdated = 0;

    // 1. Cập nhật cho real users (accounts)
    console.log("\n📱 Cập nhật cho accounts...");
    const realUsersData = await db.select().from(realUsers);

    for (const user of realUsersData) {
      try {
        // Get user ID from fullName JSON
        let userId;
        if (user.fullName) {
          try {
            const fullNameObj = typeof user.fullName === 'string' 
              ? JSON.parse(user.fullName) 
              : user.fullName;
            userId = fullNameObj.id;
          } catch (e) {
            console.error(`❌ Lỗi parse fullName cho user ${user.id}:`, e);
            continue;
          }
        } else {
          console.warn(`⚠️ User ${user.id} không có fullName, bỏ qua`);
          continue;
        }

        const updateResult = await db
          .update(contents)
          .set({ sourceClassification: user.classification || 'new' })
          .where(
            and(
              sql`source::json->>'type' = 'account'`,
              sql`source::json->>'id' = ${userId}`
            )
          )
          .returning({ id: contents.id });

        if (updateResult.length > 0) {
          const userName = typeof user.fullName === 'object' ? user.fullName.name : JSON.parse(user.fullName as string).name;
          console.log(`✅ ${userName} (ID: ${userId}, Classification: ${user.classification}): Cập nhật ${updateResult.length} nội dung`);
          totalUpdated += updateResult.length;
        }
      } catch (error) {
        console.error(`❌ Lỗi khi cập nhật user ${user.id}:`, error);
      }
    }

    // 2. Cập nhật cho pages
    console.log("\n📄 Cập nhật cho pages...");
    const pagesData = await db.select().from(pages);

    for (const page of pagesData) {
      try {
        // Get page ID from pageName JSON
        let pageId;
        if (page.pageName) {
          try {
            const pageNameObj = typeof page.pageName === 'string' 
              ? JSON.parse(page.pageName) 
              : page.pageName;
            pageId = pageNameObj.id;
          } catch (e) {
            console.error(`❌ Lỗi parse pageName cho page ${page.id}:`, e);
            continue;
          }
        } else {
          console.warn(`⚠️ Page ${page.id} không có pageName, bỏ qua`);
          continue;
        }

        const updateResult = await db
          .update(contents)
          .set({ sourceClassification: page.classification || 'new' })
          .where(
            and(
              sql`source::json->>'type' = 'page'`,
              sql`source::json->>'id' = ${pageId}`
            )
          )
          .returning({ id: contents.id });

        if (updateResult.length > 0) {
          const pageName = typeof page.pageName === 'object' ? page.pageName.name : JSON.parse(page.pageName as string).name;
          console.log(`✅ ${pageName} (ID: ${pageId}, Classification: ${page.classification}): Cập nhật ${updateResult.length} nội dung`);
          totalUpdated += updateResult.length;
        }
      } catch (error) {
        console.error(`❌ Lỗi khi cập nhật page ${page.id}:`, error);
      }
    }

    // 3. Cập nhật cho groups
    console.log("\n👥 Cập nhật cho groups...");
    const groupsData = await db.select().from(groups);

    for (const group of groupsData) {
      try {
        // Get group ID from groupName JSON
        let groupId;
        if (group.groupName) {
          try {
            const groupNameObj = typeof group.groupName === 'string' 
              ? JSON.parse(group.groupName) 
              : group.groupName;
            groupId = groupNameObj.id;
          } catch (e) {
            console.error(`❌ Lỗi parse groupName cho group ${group.id}:`, e);
            continue;
          }
        } else {
          console.warn(`⚠️ Group ${group.id} không có groupName, bỏ qua`);
          continue;
        }

        const updateResult = await db
          .update(contents)
          .set({ sourceClassification: group.classification || 'new' })
          .where(
            and(
              sql`source::json->>'type' = 'group'`,
              sql`source::json->>'id' = ${groupId}`
            )
          )
          .returning({ id: contents.id });

        if (updateResult.length > 0) {
          const groupName = typeof group.groupName === 'object' ? group.groupName.name : JSON.parse(group.groupName as string).name;
          console.log(`✅ ${groupName} (ID: ${groupId}, Classification: ${group.classification}): Cập nhật ${updateResult.length} nội dung`);
          totalUpdated += updateResult.length;
        }
      } catch (error) {
        console.error(`❌ Lỗi khi cập nhật group ${group.id}:`, error);
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

    // 5. Kiểm tra một số ví dụ cụ thể
    console.log("\n🔍 Kiểm tra một số nội dung đã được cập nhật:");
    const sampleContents = await db
      .select({
        id: contents.id,
        externalId: contents.externalId,
        source: contents.source,
        sourceClassification: contents.sourceClassification
      })
      .from(contents)
      .where(sql`source_classification != 'new'`)
      .limit(5);

    if (sampleContents.length > 0) {
      sampleContents.forEach(content => {
        try {
          const sourceObj = JSON.parse(content.source || '{}');
          console.log(`  📋 External ID: ${content.externalId}, Source: ${sourceObj.name} (${sourceObj.type}), Classification: ${content.sourceClassification}`);
        } catch (e) {
          console.log(`  📋 External ID: ${content.externalId}, Classification: ${content.sourceClassification}`);
        }
      });
    } else {
      console.log("  ❌ Không tìm thấy nội dung nào được cập nhật thành công");
    }

    console.log(`\n✅ Hoàn thành cập nhật source_classification! Tổng cộng cập nhật: ${totalUpdated} nội dung`);

  } catch (error) {
    console.error("❌ Lỗi khi cập nhật source_classification:", error);
  }
}

// Chạy script và thoát
fixSourceClassification().then(() => {
  console.log("🎉 Script hoàn thành!");
  process.exit(0);
});