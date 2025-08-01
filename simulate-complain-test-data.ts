
import { db } from "./server/db";
import { users, complainManagement } from "./shared/schema";
import { eq, ne, and } from "drizzle-orm";

interface ComplainMessage {
  type:
    | "user_complain"
    | "page_complain"
    | "post_complain"
    | "group_complain"
    | "event_complain"
    | "song_complain"
    | "product_complain"
    | "project_complain";
  receiver_account_id: {
    id: string;
    name: string;
    email: string;
  };
  activity_id: string;
  activity_class_name: string;
  reason?: string;
  descriptions: string;
  media_attachment?: string[];
}

async function processComplainMessage(message: ComplainMessage) {
  try {
    console.log(`🔄 Processing complain message: ${JSON.stringify(message, null, 2)}`);

    // Get active users for round-robin assignment (exclude admin)
    const activeUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.status, "active"), ne(users.role, "admin")));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("No active non-admin users found for assignment");
    }

    console.log(`👥 Found ${activeUsers.length} active non-admin users`);

    // Get last assigned COMPLAIN for round-robin
    const lastAssignedComplain = await db.query.complainManagement.findFirst({
      orderBy: (complainManagement, { desc }) => [
        desc(complainManagement.createdAt),
      ],
    });

    // Calculate next assignee index
    let nextAssigneeIndex = 0;
    if (lastAssignedComplain && lastAssignedComplain.assignedToId) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedComplain.assignedToId,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assignedUser = activeUsers[nextAssigneeIndex];
    const now = new Date();

    // Prepare insert data
    const insertData = {
      complainerInfo: message.receiver_account_id,
      activityId: message.activity_id,
      activityClassName: message.activity_class_name,
      complainType: message.type,
      reason: message.reason || null,
      descriptions: message.descriptions,
      mediaAttachment: message.media_attachment || null,
      status: "pending" as const,
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`📝 Inserting complain data for ${assignedUser.name}`);

    // Insert new complain
    const result = await db
      .insert(complainManagement)
      .values(insertData)
      .returning();

    console.log(
      `✅ Successfully inserted complain: ID ${result[0].id}, ComplainerID: ${message.receiver_account_id.id}, AssignedTo: ${assignedUser.name}`,
    );
    return result[0];
  } catch (error) {
    console.error(`❌ Error processing complain message: ${error}`);
    throw error;
  }
}

async function simulateComplainTestData() {
  console.log("🚀 Starting Complain Test Data simulation with exact data from attached file...");

  // Exact data from attached file
  const testComplainMessages: ComplainMessage[] = [
    // 1. COMPLAIN USER
    {
      type: "user_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Account",
      reason: "Spam tin nhắn",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa tài khoản của tôi.",
      media_attachment: ["linl 1", "link2"]
    },
    // 2. COMPLAIN PAGE
    {
      type: "page_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Page",
      reason: "Spam tin nhắn",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa Trang của tôi.",
      media_attachment: ["linl 1", "link2"]
    },
    // 3. COMPLAIN POST
    {
      type: "post_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Post",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa Post của tôi.",
      media_attachment: ["linl 1", "link2"]
    },
    // 4. COMPLAIN GROUP
    {
      type: "group_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Group",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa Group của tôi.",
      media_attachment: ["linl 1", "link2"]
    },
    // 5. COMPLAIN EVENT
    {
      type: "event_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Event",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa Event của tôi.",
      media_attachment: ["linl 1", "link2"]
    },
    // 6. COMPLAIN SONG
    {
      type: "song_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Song",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa Bài hát của tôi.",
      media_attachment: ["linl 1", "link2"]
    },
    // 7. COMPLAIN PRODUCT
    {
      type: "product_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Product",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa Sản phẩm của tôi.",
      media_attachment: ["linl 1", "link2"]
    },
    // 8. COMPLAIN PROJECT (Fixed type from "product_complain" to "project_complain")
    {
      type: "project_complain",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "abcd@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Project",
      descriptions: "Tôi không làm gì vi phạm, sao lại khóa Dự án của tôi.",
      media_attachment: ["linl 1", "link2"]
    }
  ];

  try {
    console.log(`📝 Processing ${testComplainMessages.length} complain messages from attached file...`);

    for (let i = 0; i < testComplainMessages.length; i++) {
      const message = testComplainMessages[i];
      console.log(`\n--- Processing message ${i + 1}/${testComplainMessages.length}: ${message.type} ---`);
      
      await processComplainMessage(message);
      
      // Small delay between insertions
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("\n✅ All test complain messages processed successfully!");
    
    // Show final statistics
    console.log("\n📊 Final Statistics:");
    const totalComplaints = await db.select().from(complainManagement);
    console.log(`Total complaints in database: ${totalComplaints.length}`);

  } catch (error) {
    console.error("❌ Error in test simulation:", error);
  } finally {
    console.log("🏁 Test simulation completed");
    process.exit(0);
  }
}

// Run the test simulation
simulateComplainTestData();
