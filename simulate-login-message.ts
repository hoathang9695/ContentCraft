import { db } from "./server/db";
import { realUsers } from "./shared/schema";
import { eq } from "drizzle-orm";
import { processRealUserMessage } from "./server/kafka-consumer";

async function simulateUserLogin() {
  console.log("🚀 Simulating login for Lệ Quyên...");

  const loginMessage = {
    id: "114161342588621045",
    fullName: "Lệ Quyên",
    email: "quyen@gmail.com",
    verified: "unverified" as const,
    lastLogin: new Date("2025-04-26T01:00:50.629+07:00")
  };

  try {
    await processRealUserMessage(loginMessage);
    console.log("✅ Successfully simulated login message");
    console.log("Message:", loginMessage);
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