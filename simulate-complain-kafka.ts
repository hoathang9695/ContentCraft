
import { db } from "./server/db";
import { users, complainManagement } from "./shared/schema";
import { eq, ne, and } from "drizzle-orm";

interface ComplainMessage {
  Type: 'user_complain' | 'page_complain' | 'post_complain' | 'group_complain' | 'event_complain' | 'song_complain' | 'product_complain' | 'project_complain';
  type: 'response_reported_status';
  receiver_account_id: {
    id: string;
    name: string;
    email: string;
  };
  activity_id: string;
  activity_class_name: string;
  reason?: string;
  Descriptions: string;
  media_attachment?: string[];
}

async function processComplainMessage(message: ComplainMessage) {
  try {
    console.log(`🔄 Processing complain message: ${JSON.stringify(message)}`);

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
      orderBy: (complainManagement, { desc }) => [desc(complainManagement.createdAt)]
    });

    // Calculate next assignee index
    let nextAssigneeIndex = 0;
    if (lastAssignedComplain && lastAssignedComplain.assignedToId) {
      const lastAssigneeIndex = activeUsers.findIndex(
        user => user.id === lastAssignedComplain.assignedToId
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
      complainType: message.Type,
      reason: message.reason || null,
      descriptions: message.Descriptions,
      mediaAttachment: message.media_attachment || null,
      status: 'pending' as const,
      assignedToId: assignedUser.id,
      assignedToName: assignedUser.name,
      assignedAt: now,
      createdAt: now,
      updatedAt: now
    };

    console.log(`📝 Inserting complain data for ${assignedUser.name}`);

    // Insert new complain
    const result = await db.insert(complainManagement).values(insertData).returning();

    console.log(`✅ Successfully inserted complain: ID ${result[0].id}, ComplainerID: ${message.receiver_account_id.id}, AssignedTo: ${assignedUser.name}`);
    return result[0];
  } catch (error) {
    console.error(`❌ Error processing complain message: ${error}`);
    throw error;
  }
}

async function simulateComplainKafkaMessages() {
  console.log("🚀 Starting Complain Management Kafka simulation...");

  const complainMessages: ComplainMessage[] = [
    {
      Type: "user_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949374",
        name: "Nguyễn Văn A",
        email: "nguyenvana@gmail.com"
      },
      activity_id: "112240909630381155",
      activity_class_name: "Account",
      reason: "Spam tin nhắn",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa tài khoản của tôi.",
      media_attachment: ["link1.jpg", "link2.pdf"]
    },
    {
      Type: "page_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949375",
        name: "Trần Thị B",
        email: "tranthib@gmail.com"
      },
      activity_id: "112240909630381156",
      activity_class_name: "Account",
      reason: "Nội dung không phù hợp",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa Trang của tôi.",
      media_attachment: ["screenshot1.png"]
    },
    {
      Type: "post_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949376",
        name: "Lê Văn C",
        email: "levanc@gmail.com"
      },
      activity_id: "112240909630381157",
      activity_class_name: "Account",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa Post của tôi."
    },
    {
      Type: "group_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949377",
        name: "Phạm Thị D",
        email: "phamthid@gmail.com"
      },
      activity_id: "112240909630381158",
      activity_class_name: "Account",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa Group của tôi.",
      media_attachment: ["evidence1.jpg", "evidence2.pdf"]
    },
    {
      Type: "event_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949378",
        name: "Hoàng Văn E",
        email: "hoangvane@gmail.com"
      },
      activity_id: "112240909630381159",
      activity_class_name: "Account",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa Event của tôi."
    },
    {
      Type: "song_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949379",
        name: "Vũ Thị F",
        email: "vuthif@gmail.com"
      },
      activity_id: "112240909630381160",
      activity_class_name: "Account",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa Bài hát của tôi.",
      media_attachment: ["music_license.pdf"]
    },
    {
      Type: "product_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949380",
        name: "Đỗ Văn G",
        email: "dovang@gmail.com"
      },
      activity_id: "112240909630381161",
      activity_class_name: "Account",
      reason: "Sản phẩm hợp pháp",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa Sản phẩm của tôi.",
      media_attachment: ["product_cert.jpg", "business_license.pdf"]
    },
    {
      Type: "project_complain",
      type: "response_reported_status",
      receiver_account_id: {
        id: "114619409398949381",
        name: "Bùi Thị H",
        email: "buithih@gmail.com"
      },
      activity_id: "112240909630381162",
      activity_class_name: "Account",
      Descriptions: "Tôi không làm gì vi phạm, sao lại khóa Dự án của tôi."
    }
  ];

  try {
    for (const message of complainMessages) {
      await processComplainMessage(message);
      // Small delay between insertions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("✅ All complain messages processed successfully!");
  } catch (error) {
    console.error("❌ Error in simulation:", error);
  } finally {
    process.exit(0);
  }
}

// Run the simulation
simulateComplainKafkaMessages();
