import { db } from './server/db.js';
import { users, supportRequests } from './shared/schema';
import { and, ne, eq, sql } from 'drizzle-orm';

async function createSupportRequest(assigneeId: number) {
  try {
    const now = new Date();

    // Log before insert
    console.log('Creating support request for assignee:', assigneeId);

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

    console.log('Request data:', requestData);

    const result = await db.insert(supportRequests)
      .values(requestData)
      .returning();

    console.log('Insert result:', result);

    if (!result || result.length === 0) {
      throw new Error('No data returned from insert operation');
    }

    return result[0];
  } catch (error) {
    console.error('Error in createSupportRequest:', error);
    throw error;
  }
}

async function simulateKafka4Requests() {
  console.log('Starting simulation...');

  try {
    // Test database connection
    console.log('Testing database connection...');
    const testResult = await db.execute(sql`SELECT NOW()`);
    console.log('Database connection test successful:', testResult);

    // Get list of active non-admin users
    console.log('Fetching active non-admin users...');
    const activeUsers = await db
      .select()
      .from(users)
      .where(
        and(
          ne(users.role, 'admin'),
          eq(users.status, 'active')
        )
      );

    console.log('Active users found:', activeUsers);

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error('No active non-admin users found');
    }

    // Create 4 support requests
    for (let i = 0; i < 4; i++) {
      const assigneeIndex = i % activeUsers.length;
      const assignee = activeUsers[assigneeIndex];

      console.log(`Creating request ${i + 1}/4 for user:`, assignee);

      try {
        const request = await createSupportRequest(assignee.id);
        console.log(`Created request ${i + 1}, ID: ${request.id}, assigned to user ID ${assignee.id}`);

        // Wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to create request ${i + 1}:`, error);
        //The original code re-threw the error here, which is more appropriate for a simulation.  
        //Leaving it as is will halt the loop on failure
        throw error;
      }
    }

    console.log('Simulation completed successfully');
  } catch (error) {
    console.error('Simulation failed:', error);
    process.exit(1);
  }
}

// Run simulation
simulateKafka4Requests()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });