
import { db } from "./server/db";
import { realUsers } from "./shared/schema";
import { eq } from "drizzle-orm";

async function simulateUserLogin() {
  console.log("🚀 Simulating login message for Lệ Quyên...");

  try {
    // Update lastLogin time for Lệ Quyên
    const result = await db
      .update(realUsers)
      .set({
        lastLogin: new Date("2025-04-26T01:00:50.629Z"),
        updatedAt: new Date()
      })
      .where(
        eq(realUsers.email, "quyen@gmail.com")
      )
      .returning();

    if (result.length > 0) {
      console.log("✅ Successfully updated login time for Lệ Quyên");
      console.log("Updated user:", result[0]);
    } else {
      console.log("❌ User not found");
    }
  } catch (error) {
    console.error("❌ Error updating login time:", error);
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
