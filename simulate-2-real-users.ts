
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
      fullName: 'Hoàng Ngọc Lan',
      email: 'example@gmail.com',
      verified: 'unverified',
      lastLogin: now,
      assignedToId: activeUsers[0].id,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log('First user inserted:', result1[0]);

    // Create second user
    console.log('Inserting second user...');
    const result2 = await db.insert(realUsers).values({
      fullName: 'Hoàng Ngọc Dương', 
      email: 'duong@example.com',
      verified: 'unverified',
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
import { db } from './server/db';
import { realUsers } from './shared/schema';

async function processRealUserMessage(userData: {
  id: string;
  fullName: string;
  email: string;
  verified: 'verified' | 'unverified';
  assignedToId: number;
}) {
  try {
    const now = new Date();

    // Insert real user data
    const newRealUser = await db.insert(realUsers).values({
      fullName: JSON.stringify({ id: userData.id, name: userData.fullName }),
      email: userData.email,
      verified: userData.verified,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
      assignedToId: userData.assignedToId
    }).returning();

    console.log(`Created real user with ID ${newRealUser[0].id}, assigned to user ID ${userData.assignedToId}`);
    return newRealUser[0];
  } catch (error) {
    console.error('Error processing real user message:', error);
    throw error;
  }
}

async function simulateKafkaRealUsers() {
  const testUsers = [
    {
      id: "113728049762216423",
      fullName: "Hoàng Ngọc Lan",
      email: "lan@gmail.com",
      verified: "unverified" as const,
      assignedToId: 2
    },
    {
      id: "113752366387735850", 
      fullName: "Hoàng Ngọc Dương",
      email: "duong@gmail.com",
      verified: "verified" as const,
      assignedToId: 3
    }
  ];

  console.log('Starting simulation for real users...');

  for (const userData of testUsers) {
    try {
      await processRealUserMessage(userData);
      // Wait 1 second between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to process user ${userData.email}:`, error);
    }
  }

  console.log('Completed real users simulation');
}

// Run simulation
simulateKafkaRealUsers()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
