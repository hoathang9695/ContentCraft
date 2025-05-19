
import { db } from "./server/db";
import { realUsers } from "./shared/schema";

async function processRealUserMessage(userData: {
  id: string;
  fullName: string;
  email: string;
  verified: "verified" | "unverified";
  assignedToId: number;
}) {
  try {
    const now = new Date();

    // Insert new real user with proper format
    const newRealUser = await db
      .insert(realUsers)
      .values({
        fullName: {
          id: userData.id,
          name: userData.fullName
        },
        email: userData.email,
        verified: userData.verified,
        lastLogin: now,
        createdAt: now,
        updatedAt: now,
        assignedToId: userData.assignedToId,
      })
      .returning();

    console.log(
      `✅ Created real user with ID ${newRealUser[0].id}, assigned to user ID ${userData.assignedToId}`,
    );
    return newRealUser[0];
  } catch (error) {
    console.error("❌ Error processing real user message:", error);
    throw error;
  }
}

async function simulateKafkaMoreUsers() {
  const testUsers = [
    {
      id: "114515504562199862",
      fullName: "TMI",
      email: "mi@gmail.com",
      verified: "unverified" as const,
      assignedToId: 2
    },
    {
      id: "114518178877541440",
      fullName: "Embers", 
      email: "embers@gmail.com",
      verified: "verified" as const,
      assignedToId: 3
    }
  ];

  console.log("🚀 Starting simulation for additional real users...");

  for (const userData of testUsers) {
    try {
      await processRealUserMessage(userData);
      // Wait 1 second between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`⚠️ Failed to process user ${userData.email}:`, error);
    }
  }

  console.log("✅ Completed additional real users simulation");
}

// Run simulation
simulateKafkaMoreUsers()
  .then(() => {
    console.log("🎉 Script completed successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });
