
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
    console.log("🔄 Processing user data:", userData);

    // Check if user already exists
    const existingUser = await db.select().from(realUsers).where({
      email: userData.email
    });

    if (existingUser.length > 0) {
      console.log(`⚠️ User with email ${userData.email} already exists`);
      return existingUser[0];
    }

    // Insert new real user with text verified field
    const newRealUser = await db
      .insert(realUsers)
      .values({
        id: userData.id,
        fullName: userData.fullName,
        email: userData.email,
        verified: userData.verified,
        lastLogin: now,
        assignedToId: userData.assignedToId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log(`✅ Created new real user:`, newRealUser[0]);
    return newRealUser[0];
  } catch (error) {
    console.error("❌ Error processing real user message:", error);
    throw error;
  }
}

async function simulateKafkaRealUsers() {
  console.log("🚀 Starting Kafka simulation...");

  const testUsers = [
    {
      id: "113725869733725553",
      fullName: JSON.stringify({
        id: "113725869733725553",
        name: "Bùi Tự"
      }),
      email: "btu@gmail.com",
      verified: "unverified" as const,
      assignedToId: 2
    },
    {
      id: "114040296560430925",
      fullName: JSON.stringify({
        id: "114040296560430925", 
        name: "Tuyền Dream"
      }),
      email: "tuyen@gmail.com",
      verified: "verified" as const,
      assignedToId: 3
    }
  ];

  for (const userData of testUsers) {
    try {
      console.log("\n📝 Processing user:", userData);
      const result = await processRealUserMessage(userData);
      console.log("✨ Successfully processed user:", result);
      // Wait 1 second between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to process user ${userData.email}:`, error);
      console.error("Full error:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }

  console.log('✅ Completed real users simulation');
}

// Run simulation
simulateKafkaRealUsers()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
