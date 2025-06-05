
-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  variables TEXT NOT NULL, -- JSON array of variable names
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Insert default templates
INSERT INTO email_templates (name, type, subject, html_content, variables, description, is_active) VALUES
(
  'Xác nhận Feedback mặc định',
  'feedback_confirmation',
  'Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi - {{companyName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
  </div>',
  '["{{fullName}}", "{{companyName}}", "{{subject}}", "{{requestId}}"]',
  'Template mặc định cho email xác nhận feedback',
  true
),
(
  'Xác nhận Hỗ trợ mặc định',
  'support_confirmation', 
  'Xác nhận yêu cầu hỗ trợ - {{companyName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="color: #333; margin: 0 0 10px 0;">Xác nhận yêu cầu hỗ trợ</h2>
      <p style="margin: 0; color: #666;">Xin chào {{fullName}},</p>
    </div>
    <div style="background-color: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
      <div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3; margin-bottom: 15px;">
        <p style="margin: 0; color: #0d47a1; font-weight: 500;">
          Cảm ơn bạn đã liên hệ với chúng tôi. Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn và sẽ phản hồi trong thời gian sớm nhất.
        </p>
      </div>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
        <h4 style="color: #495057; margin: 0 0 10px 0;">Thông tin yêu cầu của bạn:</h4>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Chủ đề:</strong> {{subject}}</p>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Mã yêu cầu:</strong> #{{requestId}}</p>
      </div>
    </div>
  </div>',
  '["{{fullName}}", "{{companyName}}", "{{subject}}", "{{requestId}}"]',
  'Template mặc định cho email xác nhận hỗ trợ',
  true
),
(
  'Chào mừng thành viên mới',
  'welcome',
  'Chào mừng bạn đến với {{companyName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="color: #333; margin: 0 0 10px 0;">Chào mừng bạn đến với {{companyName}}</h2>
      <p style="margin: 0; color: #666;">Xin chào {{fullName}},</p>
    </div>
    <div style="background-color: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; margin-bottom: 15px;">
        <p style="margin: 0; color: #155724; font-weight: 500;">
          Chào mừng bạn gia nhập cộng đồng {{companyName}}! Chúng tôi rất vui mừng có bạn cùng tham gia xây dựng {{companyTagline}}.
        </p>
      </div>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
        <h4 style="color: #495057; margin: 0 0 10px 0;">Thông tin tài khoản:</h4>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Email:</strong> {{email}}</p>
      </div>
    </div>
  </div>',
  '["{{fullName}}", "{{companyName}}", "{{companyTagline}}", "{{email}}"]',
  'Template chào mừng thành viên mới',
  true
);
