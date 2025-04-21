
import { db } from './server/db';
import { users, realUsers } from './shared/schema';
import { eq, ne } from 'drizzle-orm';

async function processRealUserMessage(userData: {
  fullName: string;
  email: string;
}) {
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

    // Get last assigned user to implement round-robin
    const lastAssignedUser = await db.query.realUsers.findFirst({
      orderBy: (realUsers, { desc }) => [desc(realUsers.createdAt)],
    });

    let nextAssigneeIndex = 0;
    if (lastAssignedUser) {
      const lastAssigneeIndex = activeUsers.findIndex(
        user => user.id === lastAssignedUser.id
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assignedToId = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Insert real user data
    const newRealUser = await db.insert(realUsers).values({
      fullName: userData.fullName,
      email: userData.email,
      verified: false,
      createdAt: now,
      updatedAt: now
    }).returning();

    console.log(`Created real user with ID ${newRealUser[0].id}, assigned to user ID ${assignedToId}`);
    return newRealUser[0];
  } catch (error) {
    console.error('Error processing real user message:', error);
    throw error;
  }
}

async function simulateKafkaRealUsers() {
  const testUsers = [
    {
      fullName: "Nguyễn Văn A",
      email: "nguyenvana@example.com"
    },
    {
      fullName: "Trần Thị B", 
      email: "tranthib@example.com"
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
