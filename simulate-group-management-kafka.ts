
import { db } from './server/db';
import { users, groups } from './shared/schema';
import { and, ne, eq, sql } from 'drizzle-orm';

interface TestGroupMessage {
  groupId: string;
  groupName: string;
  groupType: "public" | "private";
  categories?: string;
  adminId?: string;
  adminName?: string;
  phoneNumber?: string | null;
  monetizationEnabled?: boolean;
}

async function testGroupKafkaProcessing() {
  console.log('🧪 Testing Group Management Kafka Processing...\n');
  
  try {
    // Test messages theo format đề xuất
    const testMessages: TestGroupMessage[] = [
      {
        groupId: "113751247015017788",
        groupName: "Gia đình EMSO",
        groupType: "public",
        categories: "gia đình",
        adminId: "114550257830462999",
        adminName: "Admin EMSO",
        phoneNumber: "0999888777",
        monetizationEnabled: false
      },
      {
        groupId: "113751247015017789",
        groupName: "Nhóm Công Nghệ",
        groupType: "private",
        categories: "công nghệ",
        adminId: "114550257830462998",
        adminName: "Tech Admin",
        phoneNumber: null,
        monetizationEnabled: true
      },
      {
        groupId: "113751247015017790", 
        groupName: "Cộng Đồng Kinh Doanh",
        groupType: "public",
        categories: "kinh doanh",
        adminId: "114550257830462997",
        adminName: "Business Admin",
        phoneNumber: "0988123456",
        monetizationEnabled: false
      }
    ];

    console.log('📝 Test messages:', JSON.stringify(testMessages, null, 2));

    // 1. Check active users (exclude admin)
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    console.log(`✅ Found ${activeUsers.length} active non-admin users`);

    if (activeUsers.length === 0) {
      console.error('❌ No active non-admin users found!');
      return;
    }

    // 2. Process each test message
    for (let i = 0; i < testMessages.length; i++) {
      const groupMsg = testMessages[i];
      
      console.log(`\n🔄 Processing message ${i + 1}/${testMessages.length}: ${groupMsg.groupName}`);

      try {
        // Get last assigned group for round-robin
        const lastAssigned = await db.query.groups.findFirst({
          orderBy: (groups, { desc }) => [desc(groups.createdAt)]
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

        console.log(`👤 Will assign to: ${assignedUser.name} (ID: ${assignedToId})`);

        // Check if group already exists
        const existingGroup = await db
          .select()
          .from(groups)
          .where(eq(sql`${groups.groupName}::jsonb->>'id'`, groupMsg.groupId))
          .limit(1);

        if (existingGroup.length > 0) {
          console.log(`⚠️ Group ${groupMsg.groupId} already exists, skipping...`);
          continue;
        }

        // Insert group
        const insertData = {
          groupName: {
            id: groupMsg.groupId,
            group_name: groupMsg.groupName
          },
          groupType: groupMsg.groupType,
          categories: groupMsg.categories || null,
          classification: 'new' as const,
          adminData: groupMsg.adminId && groupMsg.adminName ? {
            id: groupMsg.adminId,
            admin_name: groupMsg.adminName
          } : null,
          phoneNumber: groupMsg.phoneNumber || null,
          monetizationEnabled: groupMsg.monetizationEnabled || false,
          assignedToId: assignedToId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await db.insert(groups).values(insertData).returning();

        console.log(`✅ Successfully inserted group: DB ID ${result[0].id}`);
        console.log(`   Group ID: ${groupMsg.groupId}`);
        console.log(`   Group Name: ${groupMsg.groupName}`);
        console.log(`   Assigned to: ${assignedUser.name}`);

        // Wait 1 second between messages
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error processing group ${groupMsg.groupId}:`, error);
      }
    }

    // 3. Show final assignment distribution
    console.log('\n📊 Final Assignment Distribution:');
    const assignmentStats: Record<string, number> = {};
    
    for (const user of activeUsers) {
      const count = await db
        .select()
        .from(groups)
        .where(eq(groups.assignedToId, user.id));
      
      assignmentStats[user.name] = count.length;
      console.log(`   ${user.name}: ${count.length} groups`);
    }

    console.log('\n✅ Group management Kafka processing test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Execute test
testGroupKafkaProcessing()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
