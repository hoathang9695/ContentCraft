
import { db } from "./server/db";
import { users, supportRequests } from "./shared/schema";
import { and, ne, eq, desc } from "drizzle-orm";

// Interface for tick message (matching kafka-consumer.ts)
interface TickMessage {
  id: string;
  full_name: string;
  email: string;
  subject?: string;
  type: "tick";
  phone_number?: string;
  detailed_description?: string;
  attachment_url?: string | string[];
}

async function processTickMessage(message: TickMessage) {
  return await db.transaction(async (tx) => {
    try {
      // Validate required fields
      if (
        !message.id ||
        !message.full_name ||
        !message.email ||
        !message.type
      ) {
        console.log(
          `❌ Invalid tick message: ${JSON.stringify(message)}`,
        );
        return;
      }

      // Check for duplicate tick request based on email and type
      const existingRequest = await tx
        .select()
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.email, message.email),
            eq(supportRequests.type, "tick"),
          ),
        )
        .limit(1);

      if (existingRequest.length > 0) {
        console.log(
          `⚠️ Tick request for ${message.email} already exists, skipping...`,
        );
        return existingRequest[0];
      }

      console.log(
        `🎫 Processing tick message: ${message.full_name} (${message.email})`,
      );

      // Get active users (exclude admin for tick assignment)
      const activeUsers = await tx
        .select()
        .from(users)
        .where(and(eq(users.status, "active"), ne(users.role, "admin")));

      if (!activeUsers || activeUsers.length === 0) {
        console.log(
          "❌ No active non-admin users found to assign tick.",
        );
        return;
      }

      console.log(
        `👥 Found ${activeUsers.length} active users for tick assignment`,
      );

      // Find last assigned TICK REQUEST for round-robin (specific to type='tick')
      const lastAssignedTickRequest =
        await tx.query.supportRequests.findFirst({
          where: eq(supportRequests.type, "tick"),
          orderBy: (supportRequests, { desc }) => [
            desc(supportRequests.assigned_at),
          ],
        });

      // Calculate next assignee (round-robin) based on tick requests only
      let nextAssigneeIndex = 0;
      if (
        lastAssignedTickRequest &&
        lastAssignedTickRequest.assigned_to_id
      ) {
        const lastAssigneeIndex = activeUsers.findIndex(
          (user) => user.id === lastAssignedTickRequest.assigned_to_id,
        );
        if (lastAssigneeIndex !== -1) {
          nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
        }
      }

      const assigned_to_id = activeUsers[nextAssigneeIndex].id;
      const now = new Date();

      // Prepare full_name as JSON object format
      const fullNameObj = {
        id: message.id,
        name: message.full_name,
      };

      // Prepare insert data with type='tick' and tick-specific fields
      const insertData = {
        full_name: fullNameObj,
        email: message.email,
        subject: message.subject || "Yêu cầu tick xanh",
        content:
          message.detailed_description ||
          "Yêu cầu tick xanh từ người dùng",
        status: "pending" as const,
        type: "tick" as const, // Explicitly set type
        phone_number: message.phone_number || null,
        attachment_url: message.attachment_url
          ? JSON.stringify(message.attachment_url)
          : null,
        assigned_to_id,
        assigned_at: now,
        created_at: now,
        updated_at: now,
      };

      // Insert into DB
      const newRequest = await tx
        .insert(supportRequests)
        .values(insertData)
        .returning();

      console.log(
        `✅ Tick request created with ID ${newRequest[0].id}`,
      );
      console.log(
        `👤 Assigned to user ID ${assigned_to_id} (${activeUsers.find((u) => u.id === assigned_to_id)?.name})`,
      );
      console.log(`📧 Email: ${message.email}, Name: ${message.full_name}`);

      return newRequest[0];
    } catch (error) {
      console.error(`❌ Error processing tick message: ${error}`);
      throw error;
    }
  });
}

async function simulate5TickRequests() {
  try {
    console.log("🚀 Starting simulation of 5 tick requests...");

    const tickMessages: TickMessage[] = [
      {
        id: "114650001234567890",
        full_name: "Nguyễn Văn Phong",
        email: "nguyenvanphong@test.com",
        subject: "Yêu cầu tick xanh cho tài khoản cá nhân",
        type: "tick",
        phone_number: "0912345678",
        detailed_description:
          "Tôi là content creator với 100K+ followers, muốn được tick xanh để tăng uy tín và độ tin cậy.",
        attachment_url: [
          "https://example.com/social-stats-phong.jpg",
          "https://example.com/portfolio-phong.pdf",
          "https://example.com/id-card-phong.jpg",
        ],
      },
      {
        id: "114650002345678901",
        full_name: "Trần Thị Mai",
        email: "tranthimai@test.com",
        subject: "Xác thực tick xanh cho doanh nghiệp",
        type: "tick",
        phone_number: "0987654321",
        detailed_description:
          "Công ty chúng tôi có hơn 500 nhân viên, cần tick xanh để khẳng định uy tín thương hiệu.",
        attachment_url: [
          "https://example.com/business-license-mai.pdf",
          "https://example.com/company-profile-mai.pdf",
        ],
      },
      {
        id: "114650003456789012",
        full_name: "Lê Hoàng Tuấn",
        email: "lehoangthuan@test.com",
        subject: "Yêu cầu tick xanh cho influencer",
        type: "tick",
        phone_number: "0901234567",
        detailed_description:
          "Tôi là tech influencer với 200K+ followers, chuyên review công nghệ và có nhiều hợp tác với các thương hiệu lớn.",
        attachment_url: [
          "https://example.com/tech-reviews-tuan.jpg",
          "https://example.com/brand-collaborations-tuan.pdf",
          "https://example.com/follower-analytics-tuan.jpg",
        ],
      },
      {
        id: "114650004567890123",
        full_name: "Phạm Văn Hải",
        email: "phamvanhai@test.com",
        subject: "Xác thực tick xanh cho nhà báo",
        type: "tick",
        phone_number: "0976543210",
        detailed_description:
          "Tôi là phóng viên của báo VnExpress với 10+ năm kinh nghiệm, muốn được tick xanh để xác thực danh tính nghề nghiệp.",
        attachment_url: [
          "https://example.com/press-card-hai.jpg",
          "https://example.com/articles-portfolio-hai.pdf",
        ],
      },
      {
        id: "114650005678901234",
        full_name: "Vũ Thị Hương",
        email: "vuthihuong@test.com",
        subject: "Yêu cầu tick xanh cho nghệ sĩ",
        type: "tick",
        phone_number: "0965432109",
        detailed_description:
          "Tôi là ca sĩ độc lập với nhiều MV trên YouTube đạt triệu view, muốn được tick xanh để fan dễ nhận diện tài khoản chính thức.",
        attachment_url: "https://example.com/music-achievements-huong.jpg",
      },
    ];

    console.log(
      `📝 Prepared ${tickMessages.length} tick messages`,
    );

    // Process each tick message
    for (let i = 0; i < tickMessages.length; i++) {
      const message = tickMessages[i];

      try {
        console.log(
          `\n🔄 Processing tick request ${i + 1}/${tickMessages.length}`,
        );
        console.log(`👤 Name: ${message.full_name}`);
        console.log(`📧 Email: ${message.email}`);

        await processTickMessage(message);

        // Wait 1 second between requests to avoid conflicts
        if (i < tickMessages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(
          `❌ Failed to process tick request ${i + 1}:`,
          error,
        );
      }
    }

    console.log("\n🎉 Completed simulation of 5 tick requests");

    // Show summary
    const totalTickRequests = await db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.type, "tick"));

    console.log(`\n📊 Summary:`);
    console.log(
      `✅ Total tick requests in database: ${totalTickRequests.length}`,
    );
  } catch (error) {
    console.error("❌ Simulation failed:", error);
    process.exit(1);
  }
}

// Run simulation
simulate5TickRequests()
  .then(() => {
    console.log("🎯 Script completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Script failed:", err);
    process.exit(1);
  });
