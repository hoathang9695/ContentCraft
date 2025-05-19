
import { db } from "./server/db";
import { realUsers } from "./shared/schema";

async function processRealUserMessage(userData: {
  id: string;
  fullName: string;
  email: string;
  verified: "verified" | "unverified"; 
  assignedToId: number;
}) {
  console.log("🔄 Start processing user data:", userData);
  
  try {
    // Test database connection
    const testQuery = await db.select().from(realUsers).limit(1);
    console.log("✅ Database connection test successful:", testQuery);

    const now = new Date();
    console.log("📝 Preparing to insert with values:", {
      fullName: {
        id: userData.id,
        name: userData.fullName
      },
      email: userData.email,
      verified: userData.verified,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
      assignedToId: userData.assignedToId
    });

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

    console.log("✅ Insert successful, returned data:", newRealUser);
    return newRealUser[0];
  } catch (error) {
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      constraint: error.constraint
    });
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
