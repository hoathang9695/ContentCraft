
import { db } from "./server/db";
import { realUsers } from "./shared/schema";
import { and, eq } from "drizzle-orm";

async function simulateUserLogin() {
  console.log("🚀 Simulating login for Lệ Quyên...");

  try {
    const loginTime = new Date("2025-04-26T01:00:50.629+07:00");

    // Update lastLogin for user with specific ID and email
    const result = await db
      .update(realUsers)
      .set({
        lastLogin: loginTime,
        updatedAt: loginTime,
      })
      .where(
        and(
          eq(realUsers.fullName['id'], "114161342588621045"),
          eq(realUsers.email, "quyen@gmail.com")
        )
      )
      .returning();

    if (result.length > 0) {
      console.log("✅ Successfully updated login time");
      console.log("Updated user:", result[0]);
    } else {
      console.log("❌ No user was updated");
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
