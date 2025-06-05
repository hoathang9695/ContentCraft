
import { db } from './server/db.js';
import { emailTemplates } from './shared/schema.js';

async function addNewTemplate() {
  try {
    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <!-- Header with Logo -->
        <div style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); padding: 30px 40px; text-align: center; border-radius: 8px 8px 0 0;">
            <div style="background-color: rgba(255,255,255,0.15); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <div style="width: 50px; height: 50px; background-color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #FF6B35; font-size: 24px; font-weight: bold;">E</span>
                </div>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                {{companyName}}
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
                Mạng xã hội vì người Việt
            </p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #2C3E50; font-size: 24px; font-weight: 600; margin: 0 0 10px 0;">
                    Cảm ơn bạn đã gửi phản hồi!
                </h2>
                <p style="color: #7F8C8D; font-size: 16px; margin: 0;">
                    Xin chào <strong style="color: #2C3E50;">{{fullName}}</strong>,
                </p>
            </div>

            <!-- Success Message -->
            <div style="background: linear-gradient(135deg, #E8F8F5 0%, #D5F4E6 100%); border-left: 4px solid #27AE60; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <div style="width: 24px; height: 24px; background-color: #27AE60; border-radius: 50%; margin-right: 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 14px;">✓</span>
                    </div>
                    <h3 style="color: #27AE60; margin: 0; font-size: 18px; font-weight: 600;">
                        Đã nhận được phản hồi của bạn
                    </h3>
                </div>
                <p style="color: #2C3E50; margin: 0; line-height: 1.6; font-size: 15px;">
                    Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi. Chúng tôi vô cùng trân trọng những đóng góp quý báu của bạn. 
                    Đội ngũ của chúng tôi sẽ xem xét và phản hồi sớm nhất có thể.
                </p>
            </div>

            <!-- Request Details -->
            <div style="background-color: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                <h4 style="color: #495057; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
                    📋 Thông tin yêu cầu của bạn:
                </h4>
                <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #E9ECEF;">
                    <p style="margin: 0 0 8px 0; color: #6C757D; font-size: 14px;">
                        <strong style="color: #495057;">Chủ đề:</strong> {{subject}}
                    </p>
                    <p style="margin: 0; color: #6C757D; font-size: 14px;">
                        <strong style="color: #495057;">Mã yêu cầu:</strong> 
                        <span style="background-color: #FF6B35; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            #{{requestId}}
                        </span>
                    </p>
                </div>
            </div>

            <!-- Call to Action -->
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="background: linear-gradient(135deg, #7165e0 0%, #5a4fcf 100%); border-radius: 8px; padding: 20px;">
                    <p style="color: white; margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">
                        🚀 Hãy cùng chúng tôi xây dựng cộng đồng tốt đẹp hơn!
                    </p>
                    <a href="https://emso.vn" style="display: inline-block; background-color: rgba(255,255,255,0.2); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; border: 2px solid rgba(255,255,255,0.3); transition: all 0.3s ease;">
                        Khám phá EMSO
                    </a>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #2C3E50; padding: 30px 40px; text-align: center;">
            <p style="color: #BDC3C7; margin: 0 0 15px 0; font-size: 14px;">
                Email này được gửi từ <strong style="color: #ECF0F1;">{{companyName}}</strong> - Mạng xã hội vì người Việt
            </p>
            <div style="margin: 20px 0;">
                <a href="https://emso.vn/about_us/mission" style="color: #3498DB; text-decoration: none; margin: 0 10px; font-size: 13px;">Về chúng tôi</a>
                <a href="https://policies.emso.vn/community-standards" style="color: #3498DB; text-decoration: none; margin: 0 10px; font-size: 13px;">Tiêu chuẩn cộng đồng</a>
                <a href="https://policies.emso.vn/ipr" style="color: #3498DB; text-decoration: none; margin: 0 10px; font-size: 13px;">Chính sách</a>
            </div>
            <p style="color: #95A5A6; margin: 0; font-size: 12px;">
                © 2024 {{companyName}}. Tất cả quyền được bảo lưu.
            </p>
        </div>
    </div>
</body>
</html>`;

    const variables = JSON.stringify([
      "{{fullName}}", 
      "{{subject}}", 
      "{{requestId}}", 
      "{{companyName}}"
    ]);

    const [newTemplate] = await db
      .insert(emailTemplates)
      .values({
        name: "Modern Feedback Template",
        type: "feedback_confirmation",
        subject: "Cảm ơn phản hồi của bạn - {{companyName}}",
        htmlContent: htmlContent,
        variables: variables,
        description: "Template email hiện đại với thiết kế gradient và logo",
        isActive: true,
      })
      .returning();

    console.log('Template đã được tạo thành công:', newTemplate);
  } catch (error) {
    console.error('Lỗi khi tạo template:', error);
  }
}

addNewTemplate();
