import { db } from './server/db';
import { users, realUsers } from './shared/schema';
import { eq, ne, sql } from 'drizzle-orm';

async function processRealUsers() {
  try {
    console.log('Starting to process real users...');

    // Test database connection
    const testResult = await db.execute(sql`SELECT NOW()`);
    console.log('Database connection test:', testResult.rows[0]);

    // Get active non-admin users for assignment
    const activeUsers = await db
      .select()
      .from(users)
      .where(
        eq(users.status, 'active'),
        ne(users.role, 'admin')
      );

    console.log('Found active users:', activeUsers);

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error('No active non-admin users found');
    }

    const now = new Date();
    console.log('Using timestamp:', now);

    // Create first user
    const user1Index = 0; 
    const assignedToId1 = activeUsers[user1Index].id;

    console.log('Creating first user with assigned_to_id:', assignedToId1);

    const newRealUser1 = await db.insert(realUsers).values({
      id: 113728049762216423,
      fullName: "Hoàng Ngọc Lan",
      email: "example@gmail.com",
      verified: 'verified',
      lastLogin: now,
      assignedToId: assignedToId1,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log('Created real user 1:', newRealUser1[0]);

    // Create second user
    const user2Index = 1 % activeUsers.length;
    const assignedToId2 = activeUsers[user2Index].id;

    console.log('Creating second user with assigned_to_id:', assignedToId2);

    const newRealUser2Result = await db.insert(realUsers).values({
      id: 113728049762216424,
      fullName: "Hoàng Ngọc Dương",
      email: "duong@example.com",
      verified: 'verified', 
      lastLogin: now,
      assignedToId: assignedToId2,
      createdAt: now,
      updatedAt: now
    });

    const insertedUser2 = await db.select().from(realUsers).where(eq(realUsers.id, 113728049762216424));
    console.log('Created real user 2:', insertedUser2[0]);

    // Verify final results
    const finalUsers = await db.select().from(realUsers);
    console.log('Final real users count:', finalUsers.length);

  } catch (error) {
    console.error('Error processing real users:', error);
    throw error;
  }
}

// Run simulation
processRealUsers()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });