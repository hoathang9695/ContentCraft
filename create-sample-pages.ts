
import { db } from "./server/db";
import { pages, users } from "./shared/schema";

async function createSamplePages() {
  console.log("Creating sample pages data...");

  try {
    // Get active users for assignment
    const activeUsers = await db
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (activeUsers.length === 0) {
      console.error("No active users found for assignment");
      return;
    }

    const samplePages = [
      {
        pageName: {
          id: "114286341919509530",
          page_name: "COC Entertainment"
        },
        pageType: "business",
        classification: "new",
        phoneNumber: "0123456789",
        monetizationEnabled: true,
        assignedToId: activeUsers[0].id
      },
      {
        pageName: {
          id: "114523678912345678",
          page_name: "Nhóm Học Tập ABC"
        },
        pageType: "community",
        classification: "potential",
        phoneNumber: "0987654321",
        monetizationEnabled: false,
        assignedToId: activeUsers[activeUsers.length > 1 ? 1 : 0].id
      },
      {
        pageName: {
          id: "114789123456789012",
          page_name: "Shop Thời Trang XYZ"
        },
        pageType: "business",
        classification: "new",
        phoneNumber: "0369258147",
        monetizationEnabled: true,
        assignedToId: activeUsers[activeUsers.length > 2 ? 2 : 0].id
      },
      {
        pageName: {
          id: "114987654321098765",
          page_name: "Trang Cá Nhân Văn"
        },
        pageType: "personal",
        classification: "non_potential",
        phoneNumber: "0147258369",
        monetizationEnabled: false,
        assignedToId: activeUsers[0].id
      },
      {
        pageName: {
          id: "114456789012345678",
          page_name: "Cộng Đồng Game Thủ"
        },
        pageType: "community",
        classification: "potential",
        phoneNumber: "0258147369",
        monetizationEnabled: true,
        assignedToId: activeUsers[activeUsers.length > 1 ? 1 : 0].id
      },
      {
        pageName: {
          id: "114741852963123456",
          page_name: "Doanh Nghiệp ABC Tech"
        },
        pageType: "business",
        classification: "new",
        phoneNumber: "0369147258",
        monetizationEnabled: true,
        assignedToId: activeUsers[activeUsers.length > 2 ? 2 : 0].id
      },
      {
        pageName: {
          id: "114159753486789012",
          page_name: "Trang Cá Nhân Minh"
        },
        pageType: "personal",
        classification: "new",
        phoneNumber: "0789456123",
        monetizationEnabled: false,
        assignedToId: activeUsers[0].id
      },
      {
        pageName: {
          id: "114357951684567890",
          page_name: "Nhóm Yêu Thích Âm Nhạc"
        },
        pageType: "community",
        classification: "potential",
        phoneNumber: "0456123789",
        monetizationEnabled: false,
        assignedToId: activeUsers[activeUsers.length > 1 ? 1 : 0].id
      }
    ];

    // Clear existing sample data first
    await db.delete(pages);
    console.log("Cleared existing pages data");

    // Insert new sample data
    const insertedPages = await db.insert(pages).values(samplePages).returning();

    console.log(`Successfully created ${insertedPages.length} sample pages:`);
    insertedPages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.pageName.page_name} (ID: ${page.pageName.id}) - ${page.pageType}`);
    });

  } catch (error) {
    console.error("Error creating sample pages:", error);
  }
}

// Import needed functions
import { eq } from "drizzle-orm";

// Run the function
createSamplePages()
  .then(() => {
    console.log("Sample pages creation completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
