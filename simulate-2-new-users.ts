
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

async function simulateKafkaNewUsers() {
  const testUsers = [
    {
      id: "114161342588621045",
      fullName: "Nguyễn Hoàng Nam",
      email: "nam@gmail.com",
      verified: "unverified" as const,
      assignedToId: 2
    },
    {
      id: "113949854688645781", 
      fullName: "Nguyễn Tuấn Tú",
      email: "tu@gmail.com",
      verified: "verified" as const,
      assignedToId: 3
    }
  ];

  console.log("🚀 Starting simulation for new real users...");

  for (const userData of testUsers) {
    try {
      await processRealUserMessage(userData);
      // Delay 1s between messages
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`⚠️ Failed to process user ${userData.email}:`, error);
    }
  }

  console.log("✅ Completed new real users simulation");
}

// Run simulation
simulateKafkaNewUsers()
  .then(() => {
    console.log("🎉 Script completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });
