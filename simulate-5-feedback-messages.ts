
import { db } from './server/db.js';
import { users, supportRequests } from './shared/schema.js';
import { eq } from 'drizzle-orm';

interface FeedbackMessage {
  full_name: string;
  email: string;
  subject: string;
  content: string;
  type: 'feedback';
  feedback_type?: 'bug_report' | 'feature_request' | 'complaint' | 'suggestion' | 'other';
  feature_type?: string;
  detailed_description?: string;
  attachment_url?: string;
}

async function processFeedbackMessage(message: FeedbackMessage) {
  return await db.transaction(async (tx) => {
    // Validate required fields
    if (!message.full_name || !message.email || !message.subject || !message.content) {
      throw new Error(`Invalid feedback message: ${JSON.stringify(message)}`);
    }

    console.log(`🔄 Processing feedback message: ${message.subject}`);

    // Get active users
    const activeUsers = await tx
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (!activeUsers || activeUsers.length === 0) {
      throw new Error("No active users found to assign feedback.");
    }

    // Find last assigned FEEDBACK REQUEST for round-robin
    const lastAssignedFeedbackRequest = await tx.query.supportRequests.findFirst({
      where: eq(supportRequests.type, 'feedback'),
      orderBy: (supportRequests, { desc }) => [desc(supportRequests.assigned_at)],
    });

    // Calculate next assignee (round-robin) based on feedback requests only
    let nextAssigneeIndex = 0;
    if (lastAssignedFeedbackRequest && lastAssignedFeedbackRequest.assigned_to_id) {
      const lastAssigneeIndex = activeUsers.findIndex(
        (user) => user.id === lastAssignedFeedbackRequest.assigned_to_id,
      );
      if (lastAssigneeIndex !== -1) {
        nextAssigneeIndex = (lastAssigneeIndex + 1) % activeUsers.length;
      }
    }

    const assigned_to_id = activeUsers[nextAssigneeIndex].id;
    const now = new Date();

    // Prepare insert data with type='feedback'
    const insertData = {
      full_name: message.full_name,
      email: message.email,
      subject: message.subject,
      content: message.content,
      status: "pending",
      type: "feedback", // Explicitly set type
      feedback_type: message.feedback_type || null,
      feature_type: message.feature_type || null,
      detailed_description: message.detailed_description || null,
      attachment_url: message.attachment_url || null,
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

    const assignedUser = activeUsers.find(u => u.id === assigned_to_id);
    console.log(`✅ Feedback request created with ID ${newRequest[0].id}`);
    console.log(`👤 Assigned to: ${assignedUser?.name} (ID: ${assigned_to_id})`);
    console.log(`📧 Email: ${message.email}, Type: ${message.feedback_type}`);

    return newRequest[0];
  });
}

async function simulate5FeedbackMessages() {
  console.log('🚀 Bắt đầu giả lập 5 message feedback...');

  const feedbackMessages: FeedbackMessage[] = [
    {
      full_name: "Nguyễn Văn A",
      email: "nguyenvana@test.com",
      subject: "Báo lỗi: Không load được trang",
      content: "Trang dashboard không load được, hiển thị lỗi 500.",
      type: "feedback",
      feedback_type: "bug_report",
      detailed_description: "Lỗi xuất hiện từ 10h sáng nay, affect tất cả users. Browser: Chrome 120.",
      attachment_url: "https://example.com/error-screenshot.png"
    },
    {
      full_name: "Trần Thị B",
      email: "tranthib@test.com", 
      subject: "Yêu cầu tính năng: Export Excel",
      content: "Muốn có tính năng export dữ liệu ra Excel.",
      type: "feedback",
      feedback_type: "feature_request",
      feature_type: "Xuất dữ liệu",
      detailed_description: "Export theo filter hiện tại, hỗ trợ format .xlsx và .csv."
    },
    {
      full_name: "Lê Minh C",
      email: "leminhc@test.com",
      subject: "Khiếu nại: Interface khó sử dụng",
      content: "Giao diện phức tạp, khó tìm các chức năng cần thiết.",
      type: "feedback",
      feedback_type: "complaint",
      detailed_description: "Buttons quá nhỏ, menu không intuitive. Cần redesign UX."
    },
    {
      full_name: "Phạm Thị D",
      email: "phamthid@test.com",
      subject: "Đề xuất: Thêm dark mode",
      content: "Đề xuất thêm dark mode để giảm mỏi mắt.",
      type: "feedback",
      feedback_type: "suggestion", 
      feature_type: "Giao diện người dùng",
      detailed_description: "Toggle switch ở header, lưu preference vào localStorage."
    },
    {
      full_name: "Hoàng Văn E",
      email: "hoangvane@test.com",
      subject: "Khác: Câu hỏi về API",
      content: "Tôi muốn hỏi về API documentation ở đâu?",
      type: "feedback",
      feedback_type: "other",
      detailed_description: "Cần API docs để integrate với hệ thống bên ngoài."
    }
  ];

  try {
    for (let i = 0; i < feedbackMessages.length; i++) {
      const message = feedbackMessages[i];
      await processFeedbackMessage(message);
      
      // Wait 500ms between messages
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log(`📝 Processed ${i + 1}/5 feedback messages\n`);
    }

    console.log('🎉 Hoàn tất giả lập 5 feedback messages!');
    console.log('📊 Kiểm tra trang /user-feedback/feedback để xem kết quả');

  } catch (error) {
    console.error('❌ Lỗi khi giả lập feedback messages:', error);
    throw error;
  }
}

// Run simulation
simulate5FeedbackMessages()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
