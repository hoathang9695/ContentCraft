import { db } from './server/db';
import { users, realUsers } from './shared/schema';
import { eq, ne } from 'drizzle-orm';

async function processRealUsers() {
  try {
    console.log('Starting to process real users...');

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

    // Create first user
    console.log('Inserting first user...');
    const result1 = await db.insert(realUsers).values({
      id: 113728049762216423,
      fullName: 'Hoàng Ngọc Lan',
      email: 'example@gmail.com',
      verified: false,
      lastLogin: now,
      assignedToId: activeUsers[0].id,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log('First user inserted:', result1[0]);

    // Create second user
    console.log('Inserting second user...');
    const result2 = await db.insert(realUsers).values({
      id: 113728049762216424,
      fullName: 'Hoàng Ngọc Dương', 
      email: 'duong@example.com',
      verified: false,
      lastLogin: now,
      assignedToId: activeUsers[1 % activeUsers.length].id,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log('Second user inserted:', result2[0]);

    // Verify final results
    const finalUsers = await db.select().from(realUsers);
    console.log('Total real users after insert:', finalUsers.length);
    console.log('All real users:', finalUsers);

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