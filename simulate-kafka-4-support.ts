
import { db } from './server/db';
import { users, supportRequests } from './shared/schema';
import { and, ne, eq, sql } from 'drizzle-orm';

async function createSupportRequest(assigneeId: number) {
  try {
    const now = new Date();
    
    // Log before insert
    console.log('Attempting to create support request for assignee:', assigneeId);
    
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

    // Execute insert with detailed error handling
    const result = await db.insert(supportRequests)
      .values(requestData)
      .returning();

    console.log('Insert result:', result);

    if (!result || result.length === 0) {
      throw new Error('No data returned from insert operation');
    }

    return result[0];
  } catch (error) {
    console.error('Detailed error in createSupportRequest:', error);
    throw error;
  }
}

async function clearExistingRequests() {
  try {
    console.log('Clearing existing support requests...');
    await db.delete(supportRequests);
    console.log('Successfully cleared existing requests');
  } catch (error) {
    console.error('Error clearing requests:', error);
    throw error;
  }
}

async function simulateKafka4Requests() {
  try {
    // Clear existing requests first
    await clearExistingRequests();

    // Test database connection
    console.log('Testing database connection...');
    const testResult = await db.execute(sql`SELECT NOW()`);
    console.log('Database connection test successful:', testResult);

    // Get active non-admin users
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

    console.log('Found active users:', activeUsers);

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error('No active non-admin users found');
    }

    // Create requests sequentially with better error handling
    for (let i = 0; i < 4; i++) {
      const assigneeIndex = i % activeUsers.length;
      const assignee = activeUsers[assigneeIndex];

      console.log(`Creating request ${i + 1}/4 for user:`, {
        userId: assignee.id,
        username: assignee.username
      });

      try {
        const request = await createSupportRequest(assignee.id);
        console.log(`Successfully created request ${i + 1}:`, request);
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to create request ${i + 1}:`, error);
        throw error;
      }
    }

    console.log('Successfully completed all request creation');
  } catch (error) {
    console.error('Simulation failed:', error);
    throw error;
  }
}

// Execute with proper error handling
simulateKafka4Requests()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed with error:', err);
    process.exit(1);
  });
