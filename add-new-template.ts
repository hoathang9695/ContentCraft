
import { db } from './server/db.js';
import { emailTemplates } from './shared/schema.js';

async function addNewTemplate() {
  try {
    const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #333; margin: 0 0 10px 0;">Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi</h2>
    <p style="margin: 0; color: #666;">Xin chào {{fullName}},</p>
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
      <p style="margin: 5px 0; color: #6c757d;"><strong>Chủ đề:</strong> {{subject}}</p>
      <p style="margin: 5px 0; color: #6c757d;"><strong>Mã yêu cầu:</strong> #{{requestId}}</p>
    </div>
  </div>
</div>`;

    const variables = JSON.stringify([
      "{{fullName}}", 
      "{{subject}}", 
      "{{requestId}}", 
      "{{companyName}}"
    ]);

    const [newTemplate] = await db
      .insert(emailTemplates)
      .values({
        name: "Xác nhận Feedback v2",
        type: "feedback_confirmation",
        subject: "Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi - {{companyName}}",
        htmlContent: htmlContent,
        variables: variables,
        description: "Template xác nhận feedback với thiết kế cải tiến",
        isActive: true,
      })
      .returning();

    console.log('Template đã được tạo thành công:', newTemplate);
  } catch (error) {
    console.error('Lỗi khi tạo template:', error);
  }
}

addNewTemplate();
