
import { db } from './server/db';
import { users, realUsers } from './shared/schema';
import { eq, ne } from 'drizzle-orm';

async function processRealUsers() {
  try {
    // Get active non-admin users for assignment
    const activeUsers = await db
      .select()
      .from(users)
      .where(
        eq(users.status, 'active'),
        ne(users.role, 'admin')
      );

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error('No active non-admin users found');
    }

    const now = new Date();

    // Create first user
    const user1Index = 0; 
    const assignedToId1 = activeUsers[user1Index].id;

    const newRealUser1 = await db.insert(realUsers).values({
      fullName: "Hoàng Ngọc Lan",
      email: "example@gmail.com",
      verified: 'verified',
      lastLogin: now,
      assignedToId: assignedToId1,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log(`Created real user 1 with ID ${newRealUser1[0].id}, assigned to user ID ${assignedToId1}`);

    // Create second user
    const user2Index = 1 % activeUsers.length;
    const assignedToId2 = activeUsers[user2Index].id;

    const newRealUser2 = await db.insert(realUsers).values({
      fullName: "Hoàng Ngọc Dương",
      email: "example2@gmail.com",
      verified: 'verified', 
      lastLogin: now,
      assignedToId: assignedToId2,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log(`Created real user 2 with ID ${newRealUser2[0].id}, assigned to user ID ${assignedToId2}`);

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
