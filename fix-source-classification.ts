
import { db } from "./server/db";
import { contents, realUsers, pages, groups } from "./shared/schema";
import { sql, eq, and } from "drizzle-orm";

async function fixSourceClassification() {
  try {
    console.log("🔄 Bắt đầu cập nhật source_classification cho tất cả nội dung...");

    // 1. Cập nhật cho real users (accounts)
    console.log("\n📱 Cập nhật cho accounts...");
    const realUsersData = await db.select().from(realUsers);
    
    let totalUpdated = 0;
    
    for (const user of realUsersData) {
      try {
        // Get user ID from fullName JSON or use direct id
        let userId;
        if (user.fullName) {
          try {
            const fullNameObj = typeof user.fullName === 'string' 
              ? JSON.parse(user.fullName) 
              : user.fullName;
            userId = fullNameObj.id;
          } catch (e) {
            userId = user.id.toString();
          }
        } else {
          userId = user.id.toString();
        }

        // Update contents for this user
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
          const userName = user.fullName 
            ? (typeof user.fullName === 'object' ? user.fullName.name : JSON.parse(user.fullName as string).name)
            : `User ${user.id}`;
          console.log(`✅ ${userName} (ID: ${userId}): Cập nhật ${updateResult.length} nội dung thành "${user.classification}"`);
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
        let pageId;
        if (page.pageName) {
          try {
            const pageNameObj = typeof page.pageName === 'string' 
              ? JSON.parse(page.pageName) 
              : page.pageName;
            pageId = pageNameObj.id;
          } catch (e) {
            pageId = page.id.toString();
          }
        } else {
          pageId = page.id.toString();
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
          const pageName = page.pageName 
            ? (typeof page.pageName === 'object' ? page.pageName.name : JSON.parse(page.pageName as string).name)
            : `Page ${page.id}`;
          console.log(`✅ ${pageName} (ID: ${pageId}): Cập nhật ${updateResult.length} nội dung thành "${page.classification}"`);
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
        let groupId;
        if (group.groupName) {
          try {
            const groupNameObj = typeof group.groupName === 'string' 
              ? JSON.parse(group.groupName) 
              : group.groupName;
            groupId = groupNameObj.id;
          } catch (e) {
            groupId = group.id.toString();
          }
        } else {
          groupId = group.id.toString();
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
          const groupName = group.groupName 
            ? (typeof group.groupName === 'object' ? group.groupName.name : JSON.parse(group.groupName as string).name)
            : `Group ${group.id}`;
          console.log(`✅ ${groupName} (ID: ${groupId}): Cập nhật ${updateResult.length} nội dung thành "${group.classification}"`);
          totalUpdated += updateResult.length;
        }
      } catch (error) {
        console.error(`❌ Lỗi khi cập nhật group ${group.id}:`, error);
      }
    }

    // 4. Cập nhật tất cả contents chưa có source_classification thành 'new'
    console.log("\n🔄 Cập nhật các nội dung chưa có source_classification...");
    const nullUpdateResult = await db
      .update(contents)
      .set({ sourceClassification: 'new' })
      .where(sql`source_classification IS NULL`)
      .returning({ id: contents.id });
    
    if (nullUpdateResult.length > 0) {
      console.log(`✅ Cập nhật ${nullUpdateResult.length} nội dung NULL thành 'new'`);
      totalUpdated += nullUpdateResult.length;
    }

    // 5. Kiểm tra kết quả
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

    // 6. Kiểm tra cụ thể cho user "Dương Tôn Lữ"
    console.log("\n🔍 Kiểm tra cụ thể cho user 'Dương Tôn Lữ':");
    const duongTonUser = realUsersData.find(user => {
      if (!user.fullName) return false;
      try {
        const fullNameObj = typeof user.fullName === 'string' 
          ? JSON.parse(user.fullName) 
          : user.fullName;
        return fullNameObj.name && fullNameObj.name.includes("Dương Tôn Lữ");
      } catch (e) {
        return false;
      }
    });
    
    if (duongTonUser) {
      let userId;
      try {
        const fullNameObj = typeof duongTonUser.fullName === 'string' 
          ? JSON.parse(duongTonUser.fullName) 
          : duongTonUser.fullName;
        userId = fullNameObj.id;
      } catch (e) {
        userId = duongTonUser.id.toString();
      }
      
      const userContents = await db
        .select({
          id: contents.id,
          externalId: contents.externalId,
          sourceClassification: contents.sourceClassification,
          source: contents.source
        })
        .from(contents)
        .where(
          and(
            sql`source::json->>'type' = 'account'`,
            sql`source::json->>'id' = ${userId}`
          )
        );
      
      console.log(`👤 User "Dương Tôn Lữ" (ID: ${userId}, Classification: ${duongTonUser.classification}):`);
      console.log(`📋 Có ${userContents.length} nội dung:`);
      
      if (userContents.length > 0) {
        userContents.slice(0, 5).forEach(content => {
          console.log(`   - External ID: ${content.externalId}, Source Classification: ${content.sourceClassification}`);
        });
        if (userContents.length > 5) {
          console.log(`   ... và ${userContents.length - 5} nội dung khác`);
        }
      }
    } else {
      console.log("❌ Không tìm thấy user 'Dương Tôn Lữ'");
    }

    console.log(`\n✅ Hoàn thành cập nhật source_classification! Tổng cộng cập nhật: ${totalUpdated} nội dung`);
    
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
