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

    // Check if page already exists using SQL query
    const existingPage = await db
      .select()
      .from(pages)
      .where(sql`${pages.pageName}->>'id' = ${pageData.pageId}`)
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
      managerId: pageData.managerId ? parseInt(pageData.managerId) : null,
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
    console.log('🚀 Starting Page Management Kafka simulation...\n');
    
    // Test database connection first
    try {
      const testResult = await db.select().from(users).limit(1);
      console.log('✅ Database connection test successful');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      throw new Error('Database connection failed');
    }

    // Test pages data
    const testPages: PageManagementMessage[] = [
      {
        pageId: "114501234567890123",
        pageName: "Nhóm Kinh Doanh Online",
        pageType: "business",
        phoneNumber: "0123456789",
        monetizationEnabled: true
      },
      {
        pageId: "114601234567890124", 
        pageName: "Cộng Đồng Người Yêu Thể Thao",
        pageType: "community",
        phoneNumber: "0987654321",
        monetizationEnabled: false
      },
      {
        pageId: "114701234567890125",
        pageName: "Trang Cá Nhân Minh Hoàng",
        pageType: "personal",
        phoneNumber: "0345678901",
        monetizationEnabled: false
      },
      {
        pageId: "114801234567890126",
        pageName: "Doanh Nghiệp Công Nghệ Số",
        pageType: "business", 
        phoneNumber: "0456789012",
        monetizationEnabled: true
      },
      {
        pageId: "114901234567890127",
        pageName: "Cộng Đồng Học Lập Trình",
        pageType: "community",
        phoneNumber: "0567890123",
        monetizationEnabled: false
      }
    ];

    // Process each page message
    for (let i = 0; i < testPages.length; i++) {
      const pageData = testPages[i];

      console.log(`📝 Processing page ${i + 1}/${testPages.length}`);
      
      try {
        // Add timeout to prevent hanging
        await Promise.race([
          simulatePageMessage(pageData),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), 10000)
          )
        ]);
        console.log(`✅ Page ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`❌ Failed to process page ${i + 1}:`, error);
        // Continue with next page instead of stopping
      }

      // Wait 1 second between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(''); // Empty line for better readability
    }

    console.log('🎉 Page Management Kafka simulation completed successfully!');

    // Show assignment distribution
    const allUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          ne(users.role, "admin")
        )
      );

    console.log('\n📊 Assignment Distribution:');
    for (const user of allUsers) {
      const assignedPages = await db
        .select()
        .from(pages)
        .where(eq(pages.assignedToId, user.id));

      console.log(`👤 ${user.name}: ${assignedPages.length} pages`);
    }

  } catch (error) {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  }
}

// Run simulation
simulatePageManagementKafka()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Script failed:', err);
    process.exit(1);
  });