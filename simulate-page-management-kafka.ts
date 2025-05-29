
import { db } from './server/db';
import { users, pages } from './shared/schema';
import { eq, and, ne, sql } from 'drizzle-orm';

interface PageManagementMessage {
  pageId: string;
  pageName: string;
  pageType: "personal" | "business" | "community";
  managerId?: string;
  phoneNumber?: string;
  monetizationEnabled?: boolean;
}

async function simulatePageMessage(pageData: PageManagementMessage) {
  try {
    console.log(`🔄 Processing page message: ${JSON.stringify(pageData)}`);

    // Get active non-admin users for round-robin assignment
    const activeUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          ne(users.role, "admin")
        )
      );

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("No active non-admin users found for assignment");
    }

    console.log(`Found ${activeUsers.length} active users for assignment`);

    // Get last assigned page for round-robin
    const lastAssigned = await db.query.pages.findFirst({
      orderBy: (pages, { desc }) => [desc(pages.createdAt)]
    });

    // Calculate next assignee index
    let nextAssigneeIndex = 0;
    if (lastAssigned && lastAssigned.assignedToId) {
      const lastAssigneeIndex = activeUsers.findIndex(
        user => user.id === lastAssigned.assignedToId
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assignedToId = activeUsers[nextAssigneeIndex].id;
    const assignedUser = activeUsers[nextAssigneeIndex];

    // Check if page already exists using JSON query
    const existingPage = await db
      .select()
      .from(pages)
      .where(sql`${pages.pageName}::jsonb ->> 'id' = ${pageData.pageId}`)
      .limit(1);

    if (existingPage.length > 0) {
      console.log(`⚠️ Page with ID ${pageData.pageId} already exists, skipping...`);
      return existingPage[0];
    }

    const now = new Date();

    // Insert new page
    const result = await db.insert(pages).values({
      pageName: {
        id: pageData.pageId,
        page_name: pageData.pageName
      },
      pageType: pageData.pageType,
      classification: 'new',
      adminData: pageData.managerId ? {
        id: pageData.managerId,
        admin_name: `Nguyễn Tuấn Tú ${pageData.managerId.slice(-4)}`
      } : null,
      phoneNumber: pageData.phoneNumber || null,
      monetizationEnabled: pageData.monetizationEnabled || false,
      assignedToId: assignedToId,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log(`✅ Successfully created page: ${pageData.pageName} (ID: ${pageData.pageId})`);
    console.log(`👤 Assigned to: ${assignedUser.name} (ID: ${assignedUser.id})`);

    return result[0];
  } catch (error) {
    console.error(`❌ Error processing page: ${error}`);
    throw error;
  }
}

async function simulatePageManagementKafka() {
  try {
    console.log('🚀 Starting Page Management simulation...\n');
    
    // Test database connection first with timeout
    console.log('Testing database connection...');
    const dbTestPromise = db.select().from(users).limit(1);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );
    
    try {
      await Promise.race([dbTestPromise, timeoutPromise]);
      console.log('✅ Database connection successful');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      process.exit(1);
    }

    // Test pages data
    const testPages: PageManagementMessage[] = [
      {
        pageId: "114501234567890123",
        pageName: "Nhóm Kinh Doanh Online",
        pageType: "business",
        managerId: "114550257830462973",
        phoneNumber: "0123456789",
        monetizationEnabled: true
      },
      {
        pageId: "114601234567890124", 
        pageName: "Cộng Đồng Người Yêu Thể Thao",
        pageType: "community",
        managerId: "114550257830462974",
        phoneNumber: "0987654321",
        monetizationEnabled: false
      },
      {
        pageId: "114701234567890125",
        pageName: "Trang Cá Nhân Minh Hoàng",
        pageType: "personal",
        managerId: "114550257830462975",
        phoneNumber: "0345678901",
        monetizationEnabled: false
      },
      {
        pageId: "114801234567890126",
        pageName: "Doanh Nghiệp Công Nghệ Số",
        pageType: "business",
        managerId: "114550257830462976", 
        phoneNumber: "0456789012",
        monetizationEnabled: true
      },
      {
        pageId: "114901234567890127",
        pageName: "Cộng Đồng Học Lập Trình",
        pageType: "community",
        managerId: "114550257830462977",
        phoneNumber: "0567890123",
        monetizationEnabled: false
      }
    ];

    console.log(`Will process ${testPages.length} pages...\n`);

    let successCount = 0;
    let failCount = 0;

    // Process each page message
    for (let i = 0; i < testPages.length; i++) {
      const pageData = testPages[i];

      console.log(`📝 Processing page ${i + 1}/${testPages.length}: ${pageData.pageName}`);
      
      try {
        await simulatePageMessage(pageData);
        successCount++;
        console.log(`✅ Page ${i + 1} processed successfully\n`);
      } catch (error) {
        failCount++;
        console.error(`❌ Failed to process page ${i + 1}: ${error}\n`);
      }

      // Wait 500ms between messages
      if (i < testPages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎉 Page Management simulation completed!`);
    console.log(`✅ Success: ${successCount}, ❌ Failed: ${failCount}\n`);

    // Show assignment distribution
    try {
      const allUsers = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.status, "active"),
            ne(users.role, "admin")
          )
        );

      console.log('📊 Assignment Distribution:');
      for (const user of allUsers) {
        const assignedPages = await db
          .select()
          .from(pages)
          .where(eq(pages.assignedToId, user.id));

        console.log(`👤 ${user.name}: ${assignedPages.length} pages`);
      }

      // Show total pages in database
      const allPages = await db.select().from(pages);
      console.log(`\n📈 Total pages in database: ${allPages.length}`);
      
    } catch (error) {
      console.error('❌ Error showing statistics:', error);
    }

  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

// Run simulation with proper cleanup
simulatePageManagementKafka()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Script failed:', err);
    process.exit(1);
  });
