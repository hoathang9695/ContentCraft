
import { db } from "./server/db";
import { realUsers } from "./shared/schema";
import { eq } from "drizzle-orm";

async function simulateUserLogin() {
  console.log("🚀 Simulating login for Lệ Quyên...");
  
  try {
    // Tìm user với id cụ thể
    const user = await db.query.realUsers.findFirst({
      where: eq(realUsers.fullName.id, "114161342588621045")
    });

    if (!user) {
      console.error("❌ User Lệ Quyên not found in database");
      return;
    }

    console.log("✅ Found user:", user);

    // Cập nhật lastLogin
    const now = new Date();
    const result = await db
      .update(realUsers)
      .set({
        lastLogin: now,
        updatedAt: now
      })
      .where(eq(realUsers.fullName.id, "114161342588621045"))
      .returning();

    if (result.length > 0) {
      console.log("✅ Successfully updated login time for Lệ Quyên");
      console.log("Updated user:", result[0]);
    } else {
      console.log("❌ Failed to update user");
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
