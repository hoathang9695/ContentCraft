import { db } from './server/db';
import { users, supportRequests } from './shared/schema';
import { and, ne, eq, sql } from 'drizzle-orm';

async function createSupportRequest(assigneeId: number) {
  try {
    const now = new Date();
    const requestData = {
      fullName: "System Generated",
      email: "system@example.com", 
      subject: `Yêu cầu hỗ trợ ${now.getTime()}`,
      content: `Yêu cầu hỗ trợ tự động được tạo lúc ${now.toISOString()}`,
      status: 'pending',
      assigned_to_id: assigneeId,
      assigned_at: now,
      created_at: now,
      updated_at: now
    };

    console.log('Creating support request with data:', requestData);

    const result = await db.insert(supportRequests).values(requestData).returning();

    if (!result || result.length === 0) {
      throw new Error('No data returned from database insert');
    }

    console.log('Successfully created support request:', result[0]);
    return result[0];
  } catch (error) {
    console.error('Error creating support request:', error);
    throw error;
  }
}

async function simulateKafka4Requests() {
  console.log('Starting simulation...');

  try {
    // Get list of active non-admin users
    const activeUsers = await db
      .select()
      .from(users)
      .where(
        and(
          ne(users.role, 'admin'),
          eq(users.status, 'active')
        )
      );

    if (activeUsers.length === 0) {
      console.error('No active non-admin users found');
      return;
    }

    console.log(`Found ${activeUsers.length} users for assignment`);

    // Create 4 support requests
    for (let i = 0; i < 4; i++) {
      const assigneeIndex = i % activeUsers.length;
      const assignee = activeUsers[assigneeIndex];

      try {
        console.log(`Creating request ${i + 1}/4 for ${assignee.username}`);
        const request = await createSupportRequest(assignee.id);
        console.log(`Created request ${i + 1}, assigned to ${assignee.name}`);

        // Wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error creating request ${i + 1}:`, error);
      }
    }

    console.log('Simulation completed');
  } catch (error) {
    console.error('Simulation error:', error);
    process.exit(1);
  }
}

// Run simulation
simulateKafka4Requests().then(() => {
  console.log('Script completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});