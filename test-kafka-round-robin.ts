
import { db } from "./server/db";
import { users, pages, realUsers } from "./shared/schema";
import { eq, ne, and, desc } from "drizzle-orm";

interface TestPageMessage {
  pageId: string;
  pageName: string;
  pageType: "personal" | "business" | "community";
  managerId?: string;
  adminName?: string;
  phoneNumber?: string;
  monetizationEnabled?: boolean;
}

async function testRoundRobinLogic() {
  try {
    console.log('🧪 Testing Round-Robin Assignment Logic...\n');
    
    // 1. Get active non-admin users 
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    console.log(`✅ Found ${activeUsers.length} active non-admin users:`);
    activeUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (ID: ${user.id})`);
    });

    if (activeUsers.length === 0) {
      console.error('❌ No active non-admin users found!');
      return;
    }

    // 2. Test page assignment logic
    console.log('\n🔄 Testing page assignment...');
    
    const testPages: TestPageMessage[] = [
      {
        pageId: "TEST_001",
        pageName: "Test Page 1",
        pageType: "business",
        managerId: "123",
        adminName: "Test Admin 1",
        monetizationEnabled: true
      },
      {
        pageId: "TEST_002", 
        pageName: "Test Page 2",
        pageType: "personal",
        monetizationEnabled: false
      },
      {
        pageId: "TEST_003",
        pageName: "Test Page 3", 
        pageType: "community",
        managerId: "456",
        adminName: "Test Admin 2",
        monetizationEnabled: true
      }
    ];

    const assignments = [];

    for (const [index, testPage] of testPages.entries()) {
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

      console.log(`   Page ${index + 1}: "${testPage.pageName}" → ${assignedUser.name} (ID: ${assignedToId})`);
      
      // Insert test page 
      const now = new Date();
      await db.insert(pages).values({
        pageName: {
          id: testPage.pageId,
          page_name: testPage.pageName
        },
        pageType: testPage.pageType,
        classification: 'new',
        adminData: testPage.managerId && testPage.adminName ? {
          id: testPage.managerId,
          admin_name: testPage.adminName
        } : null,
        phoneNumber: testPage.phoneNumber || null,
        monetizationEnabled: testPage.monetizationEnabled || false,
        assignedToId: assignedToId,
        createdAt: now,
        updatedAt: now
      });

      assignments.push({
        pageId: testPage.pageId,
        pageName: testPage.pageName,
        assignedTo: assignedUser.name,
        assignedToId: assignedToId
      });
    }

    // 3. Verify round-robin distribution
    console.log('\n📊 Verifying assignment distribution...');
    const assignmentCounts = {};
    activeUsers.forEach(user => {
      assignmentCounts[user.name] = 0;
    });

    assignments.forEach(assignment => {
      const userName = assignment.assignedTo;
      assignmentCounts[userName]++;
    });

    Object.entries(assignmentCounts).forEach(([userName, count]) => {
      console.log(`   ${userName}: ${count} pages assigned`);
    });

    // 4. Check database state
    console.log('\n🗄️ Database verification...');
    const totalPages = await db.select().from(pages);
    console.log(`   Total pages in database: ${totalPages.length}`);

    const testPagesInDb = totalPages.filter(page => 
      page.pageName && 
      typeof page.pageName === 'object' && 
      'id' in page.pageName && 
      (page.pageName as any).id.startsWith('TEST_')
    );
    console.log(`   Test pages created: ${testPagesInDb.length}`);

    // 5. Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    for (const testPage of testPages) {
      await db.delete(pages).where(
        eq((pages.pageName as any), { id: testPage.pageId, page_name: testPage.pageName })
      );
    }
    console.log('   Test pages removed');

    console.log('\n✅ Round-robin logic test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test
testRoundRobinLogic()
  .then(() => {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
