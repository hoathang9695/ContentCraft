
import { db } from "./server/db";
import { realUsers } from "./shared/schema";
import { and, eq } from "drizzle-orm";

async function simulateUserLogin() {
  console.log("🚀 Simulating login for Lệ Quyên...");

  try {
    const loginTime = new Date();

    // Get existing user first
    const user = await db
      .select()
      .from(realUsers)
      .where(
        and(
          eq(realUsers.fullName['id'], "114161342588621045"),
          eq(realUsers.email, "quyen@gmail.com")
        )
      )
      .limit(1);

    if (!user || user.length === 0) {
      throw new Error("User not found");
    }

    // Update lastLogin for the found user
    const result = await db
      .update(realUsers)
      .set({
        lastLogin: loginTime,
        updatedAt: loginTime
      })
      .where(eq(realUsers.id, user[0].id))
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
