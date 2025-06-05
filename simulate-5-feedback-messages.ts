
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

    // Send confirmation email to user
    try {
      const { emailService } = await import('./server/email.js');
      const confirmationSubject = "Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi - EMSO";
      const confirmationContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 10px 0;">Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi</h2>
            <p style="margin: 0; color: #666;">Xin chào ${message.full_name},</p>
          </div>

          <div style="background-color: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
            <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; margin-bottom: 15px;">
              <p style="margin: 0; color: #155724; font-weight: 500;">
                Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi. Chúng tôi vô cùng trân trọng những đóng góp quý báu của bạn. 
                Chúng tôi sẽ sớm phản hồi về Đóng góp của bạn qua email bạn đã đăng ký nhé.
              </p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
              <h4 style="color: #495057; margin: 0 0 10px 0;">Thông tin đóng góp của bạn:</h4>
              <p style="margin: 5px 0; color: #6c757d;"><strong>Chủ đề:</strong> ${message.subject}</p>
              <p style="margin: 5px 0; color: #6c757d;"><strong>Loại đóng góp:</strong> ${
                message.feedback_type === 'bug_report' ? 'Báo lỗi' :
                message.feedback_type === 'feature_request' ? 'Yêu cầu tính năng' :
                message.feedback_type === 'complaint' ? 'Khiếu nại' :
                message.feedback_type === 'suggestion' ? 'Đề xuất' :
                message.feedback_type === 'other' ? 'Khác' : 'Chưa phân loại'
              }</p>
              <p style="margin: 5px 0; color: #6c757d;"><strong>Mã yêu cầu:</strong> #${newRequest[0].id}</p>
            </div>

            <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
              <p style="margin: 0; color: #0d47a1; font-weight: 500;">
                Hãy cùng chúng tôi chung tay xây dựng Mạng xã hội vì người Việt.
              </p>
              <p style="margin: 10px 0 0 0; color: #0d47a1; font-weight: 600;">
                Trân trọng cảm ơn!
              </p>
            </div>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            <p>Email này được gửi từ EMSO - Mạng xã hội vì người Việt.</p>
            <p>Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi.</p>
            <p style="margin-top: 15px;">
              <a href="https://emso.vn/about_us/mission" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Về chúng tôi</a>
              <a href="https://policies.emso.vn/community-standards" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Tiêu chuẩn cộng đồng</a>
              <a href="https://policies.emso.vn/money-making-policy" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Chính sách kiếm tiền</a>
              <a href="https://policies.emso.vn/ipr" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Chính sách nội dung</a>
              <a href="https://policies.emso.vn/advertising-marketing" style="color: #3B82F6; text-decoration: none;">Chính sách quảng cáo</a>
            </p>
          </div>
        </div>
      `;

      const emailSent = await emailService.sendEmail(
        message.email,
        confirmationSubject,
        confirmationContent
      );

      if (emailSent) {
        console.log(`📨 Confirmation email sent successfully to ${message.email} for feedback #${newRequest[0].id}`);
      } else {
        console.log(`⚠️ Failed to send confirmation email to ${message.email} for feedback #${newRequest[0].id}`);
      }
    } catch (emailError) {
      console.log(`❌ Error sending confirmation email: ${emailError}`);
      // Don't throw error - we don't want to fail the feedback processing if email fails
    }

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
