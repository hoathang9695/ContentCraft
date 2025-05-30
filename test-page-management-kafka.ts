
import { db } from './server/db';
import { pages, users } from './shared/schema';
import { eq, and, ne, sql } from 'drizzle-orm';

interface TestPageMessage {
  pageId: string;
  pageName: string;
  pageType: "personal" | "business" | "community";
  managerId?: string | number;
  adminName?: string;
  phoneNumber?: string | null;
  monetizationEnabled?: boolean;
}

async function testPageKafkaProcessing() {
  console.log('🧪 Testing Page Management Kafka Processing...\n');
  
  try {
    // Test message theo format của bạn
    const testMessage: TestPageMessage = {
      pageId: "108277159419230893",
      pageName: "Test trang",
      pageType: "personal",
      managerId: 113939234515516141,
      adminName: "Bạc Nguyễn Văn",
      phoneNumber: null,
      monetizationEnabled: false
    };

    console.log('📝 Test message:', JSON.stringify(testMessage, null, 2));

    // 1. Check active users
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    console.log(`✅ Found ${activeUsers.length} active non-admin users`);

    if (activeUsers.length === 0) {
      console.error('❌ No active non-admin users found!');
      return;
    }

    // 2. Get last assigned page for round-robin
    const lastAssigned = await db.query.pages.findFirst({
      orderBy: (pages, { desc }) => [desc(pages.createdAt)]
    });

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
    console.log(`👤 Assigning to user: ${activeUsers[nextAssigneeIndex].name} (ID: ${assignedToId})`);

    // 3. Check if page already exists
    const existingPage = await db
      .select()
      .from(pages)
      .where(eq(sql`${pages.pageName}::jsonb->>'id'`, testMessage.pageId))
      .limit(1);

    if (existingPage.length > 0) {
      console.log('⚠️ Page already exists, deleting for test...');
      await db.delete(pages).where(eq(pages.id, existingPage[0].id));
    }

    // 4. Simulate processing
    const now = new Date();
    const managerIdStr = testMessage.managerId ? String(testMessage.managerId) : null;

    console.log('🔄 Processing page data...');
    console.log(`   - PageID: ${testMessage.pageId}`);
    console.log(`   - PageName: ${testMessage.pageName}`);
    console.log(`   - PageType: ${testMessage.pageType}`);
    console.log(`   - ManagerID (converted): ${managerIdStr}`);
    console.log(`   - AdminName: ${testMessage.adminName}`);
    console.log(`   - PhoneNumber: ${testMessage.phoneNumber}`);
    console.log(`   - MonetizationEnabled: ${testMessage.monetizationEnabled}`);

    const result = await db.insert(pages).values({
      pageName: {
        id: testMessage.pageId,
        page_name: testMessage.pageName
      },
      pageType: testMessage.pageType,
      classification: 'new',
      adminData: managerIdStr && testMessage.adminName ? {
        id: managerIdStr,
        admin_name: testMessage.adminName
      } : null,
      phoneNumber: testMessage.phoneNumber,
      monetizationEnabled: testMessage.monetizationEnabled || false,
      assignedToId: assignedToId,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log('✅ Page inserted successfully!');
    console.log('📄 Result:', JSON.stringify(result[0], null, 2));

    // 5. Verify the data
    const insertedPage = await db
      .select()
      .from(pages)
      .where(eq(pages.id, result[0].id))
      .limit(1);

    if (insertedPage.length > 0) {
      console.log('\n🔍 Verification - Data retrieved from DB:');
      console.log('   - ID:', insertedPage[0].id);
      console.log('   - PageName JSON:', insertedPage[0].pageName);
      console.log('   - AdminData JSON:', insertedPage[0].adminData);
      console.log('   - AssignedToId:', insertedPage[0].assignedToId);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Detailed error analysis
    if (error.code) {
      console.error('   Error Code:', error.code);
    }
    if (error.detail) {
      console.error('   Error Detail:', error.detail);
    }
    if (error.constraint) {
      console.error('   Constraint:', error.constraint);
    }
  }
}

// Run test
testPageKafkaProcessing()
  .then(() => console.log('\n✨ Test completed'))
  .catch(err => console.error('💥 Test script error:', err))
  .finally(() => process.exit(0));
