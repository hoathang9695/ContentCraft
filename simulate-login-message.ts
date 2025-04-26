
import { processRealUserMessage } from './server/kafka-consumer';

async function simulateUserLogin() {
  console.log("🚀 Simulating login message for Lệ Quyên...");

  const loginMessage = {
    id: "114161342588621045", // ID from existing data
    fullName: "Lệ Quyên",
    email: "quyen@gmail.com",
    verified: "unverified" as const,
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
