import { db } from "./server/db";
import { processRealUserMessage } from "./server/kafka-consumer";

async function simulateUserLogin() {
  console.log("🚀 Simulating login for Lệ Quyên...");

  const loginMessage = {
    id: "114161342588621045",
    fullName: "Lệ Quyên", 
    email: "quyen@gmail.com",
    verified: "unverified" as const,
    assignedToId: 2, // Assigned to user ID 2
    lastLogin: new Date("2025-04-26T01:00:50.629+07:00")
  };

  try {
    const result = await processRealUserMessage(loginMessage);
    console.log("✅ Successfully simulated login message");
    console.log("Message:", loginMessage);
    console.log("Result:", result);
  } catch (error) {
    console.error("❌ Error simulating login:", error);
  }
}

// Run simulation
simulateUserLogin()
  .then(() => {
    console.log("🎉 Script completed successfully");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });