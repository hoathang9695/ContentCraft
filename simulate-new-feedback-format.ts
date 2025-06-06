import { db } from "./server/db.js";
import { users, supportRequests } from "./shared/schema.js";
import { eq } from "drizzle-orm";

interface NewFeedbackMessage {
  id: string;
  full_name: string; // Will be stored as JSONB with {id, name} structure
  email: string;
  subject: string;
  type: "feedback";
  feedback_type?:
    | "bug_report"
    | "feature_request"
    | "complaint"
    | "suggestion"
    | "other";
  feature_type?: string;
  detailed_description?: string;
  attachment_url?: string | string[];
}

async function processFeedbackMessage(message: NewFeedbackMessage) {
  return await db.transaction(async (tx) => {
    // Validate required fields
    if (!message.full_name || !message.email || !message.subject) {
      throw new Error(`Invalid feedback message: ${JSON.stringify(message)}`);
    }

    console.log(
      `🔄 Processing new format feedback message: ${message.subject}`,
    );

    // Parse full_name if it's a string (convert to JSONB format)
    let fullNameJsonb;
    try {
      if (typeof message.full_name === "string") {
        // If it's a simple string, create the JSONB structure
        fullNameJsonb = {
          id: message.id || Date.now().toString(),
          name: message.full_name,
        };
      } else {
        // If it's already an object, use it directly
        fullNameJsonb = message.full_name;
      }
    } catch (error) {
      console.error("Error parsing full_name:", error);
      fullNameJsonb = {
        id: message.id || Date.now().toString(),
        name: String(message.full_name),
      };
    }

    // Get active users for round-robin assignment
    const activeUsers = await tx
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("No active users found to assign feedback.");
    }

    // Find last assigned FEEDBACK REQUEST for round-robin
    const lastAssignedFeedbackRequest =
      await tx.query.supportRequests.findFirst({
        where: eq(supportRequests.type, "feedback"),
        orderBy: (supportRequests, { desc }) => [
          desc(supportRequests.assigned_at),
        ],
      });

    // Calculate next assignee (round-robin) based on feedback requests only
    let nextAssigneeIndex = 0;
    if (
      lastAssignedFeedbackRequest &&
      lastAssignedFeedbackRequest.assigned_to_id
    ) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedFeedbackRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Handle attachment_url - convert array to JSON string if it's an array
    let attachmentUrl = message.attachment_url;
    if (Array.isArray(attachmentUrl)) {
      attachmentUrl = JSON.stringify(attachmentUrl);
    }

    // Prepare insert data with new JSONB full_name structure
    const insertData = {
      full_name: fullNameJsonb, // JSONB format: {id, name}
      email: message.email,
      subject: message.subject,
      content: message.detailed_description || `Feedback: ${message.subject}`,
      status: "pending",
      type: "feedback",
      feedback_type: message.feedback_type || null,
      feature_type: message.feature_type || null,
      detailed_description: message.detailed_description || null,
      attachment_url: attachmentUrl || null,
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

    const assignedUser = activeUsers.find((u) => u.id === assigned_to_id);
    console.log(`✅ Feedback request created with ID ${newRequest[0].id}`);
    console.log(
      `👤 Assigned to: ${assignedUser?.name} (ID: ${assigned_to_id})`,
    );
    console.log(`📧 Email: ${message.email}, Type: ${message.feedback_type}`);
    console.log(`👥 Full Name JSONB:`, fullNameJsonb);

    // Send confirmation email
    try {
      const { emailService } = await import("./server/email.js");

      const emailSent = await emailService.sendFeedbackConfirmation({
        to: message.email,
        fullName: fullNameJsonb.name, // Use name from JSONB
        subject: message.subject,
        feedbackType: message.feedback_type,
        requestId: newRequest[0].id,
      });

      if (emailSent) {
        console.log(
          `📨 Confirmation email sent successfully to ${message.email} for feedback #${newRequest[0].id}`,
        );
      } else {
        console.log(
          `⚠️ Failed to send confirmation email to ${message.email} for feedback #${newRequest[0].id}`,
        );
      }
    } catch (emailError) {
      console.log(`❌ Error sending confirmation email: ${emailError}`);
    }

    return newRequest[0];
  });
}

async function simulateNewFeedbackMessages() {
  console.log("🚀 Bắt đầu giả lập 5 feedback messages với format mới...");

  const newFeedbackMessages: NewFeedbackMessage[] = [
    {
      id: "113725869733725553",
      full_name: "Bùi Ngọc Tự",
      email: "tubn@emso.vn",
      subject: "contribution",
      type: "feedback",
      feature_type: "Bảng tin điều khiển chuyên nghiệp",
      detailed_description: "kokokokooookoko",
      attachment_url: [
        "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/634/369/326/923/155/original/f04b8e1e3ec5d9ab.jpg",
        "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/635/178/270/352/711/original/c65fb68efb8c93f7.mp4",
        "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/634/369/326/923/155/original/f04b8e1e3ec5d9ab.jpg",
        "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/634/369/326/923/155/original/f04b8e1e3ec5d9ab.jpg",
        "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-pt/previews/d46082ce-e1fc-4811-9f68-9b45ab08f901.jpg",
      ],
    },
    {
      id: "113725869733725554",
      full_name: "Nguyễn Văn An",
      email: "nguyenvanan@test.com",
      subject: "Báo lỗi: Trang không tải",
      type: "feedback",
      feedback_type: "bug_report",
      detailed_description:
        "Trang dashboard không tải được, lỗi 500 server error",
      attachment_url: ["https://example.com/screenshot.png"],
    },
    {
      id: "113725869733725555",
      full_name: "Trần Thị Bình",
      email: "tranthibinh@test.com",
      subject: "Yêu cầu tính năng mới",
      type: "feedback",
      feedback_type: "feature_request",
      feature_type: "Export dữ liệu",
      detailed_description: "Cần tính năng export data ra Excel và CSV",
      attachment_url: [],
    },
    {
      id: "113725869733725556",
      full_name: "Lê Minh Cường",
      email: "leminhcuong@test.com",
      subject: "Khiếu nại về UX",
      type: "feedback",
      feedback_type: "complaint",
      detailed_description: "Giao diện khó sử dụng, cần cải thiện UX/UI",
      attachment_url: [],
    },
    {
      id: "113725869733725557",
      full_name: "Phạm Thị Dung",
      email: "phamthidung@test.com",
      subject: "Đề xuất cải tiến",
      type: "feedback",
      feedback_type: "suggestion",
      feature_type: "Performance",
      detailed_description: "Đề xuất tối ưu hóa tốc độ tải trang",
      attachment_url: [],
    },
    {
      id: "113725869733725558",
      full_name: "Lê Văn Minh",
      email: "levanminh@test.com",
      subject: "Báo lỗi với ảnh đính kèm",
      type: "feedback",
      feedback_type: "bug_report",
      detailed_description: "Gửi kèm nhiều ảnh minh họa lỗi",
      attachment_url: [
        "https://s3.hn-1.cloud.cmctelecom.vn/prod/sn-web/portal/media_attachments/files/114/634/369/326/923/155/original/f04b8e1e3ec5d9ab.jpg",
        "https://cdn3.emso.vn/sn-web/media_attachments/files/114/634/476/653/690/641/original/097ae37eb76bcfd9.jpg",
      ],
    },
  ];

  try {
    for (let i = 0; i < newFeedbackMessages.length; i++) {
      const message = newFeedbackMessages[i];
      await processFeedbackMessage(message);

      // Wait 500ms between messages
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log(`📝 Processed ${i + 1}/5 new format feedback messages\n`);
    }

    console.log("🎉 Hoàn tất giả lập 5 feedback messages với format mới!");
    console.log("📊 Kiểm tra trang /user-feedback/feedback để xem kết quả");
  } catch (error) {
    console.error("❌ Lỗi khi giả lập new format feedback messages:", error);
    throw error;
  }
}

// Run simulation
simulateNewFeedbackMessages()
  .then(() => {
    console.log("✅ New format feedback simulation completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ New format feedback simulation failed:", error);
    process.exit(1);
  });
