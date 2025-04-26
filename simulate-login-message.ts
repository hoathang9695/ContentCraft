import { db } from "./server/db";
import { realUsers } from "./shared/schema";
import { processRealUserMessage } from "./server/kafka-consumer";

async function simulateUserLogin() {
  console.log("🚀 Simulating login message for Lệ Quyên...");

  const loginMessage = {
    id: "114161342588621045",
    fullName: "Lệ Quyên",
    email: "quyen@gmail.com",
    verified: "unverified" as const,
    lastLogin: new Date("2025-04-26T01:00:50.629Z")
  };

  try {
    await processRealUserMessage(loginMessage);
    console.log("✅ Successfully processed login message");
  } catch (error) {
    console.error("⚠️ Error processing login message:", error);
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