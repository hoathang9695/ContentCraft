
export interface EmailTemplateData {
  [key: string]: any;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export class EmailTemplateService {
  private static readonly COMPANY_NAME = "EMSO";
  private static readonly COMPANY_TAGLINE = "Mạng xã hội vì người Việt";

  // Load template from database by type
  static async getTemplateFromDatabase(type: string): Promise<EmailTemplate | null> {
    try {
      const { db } = await import('./db.js');
      const { emailTemplates } = await import('../shared/schema.js');
      const { eq, and, desc } = await import('drizzle-orm');
      
      console.log(`🔍 Looking for template with type: ${type}`);
      
      const [template] = await db
        .select()
        .from(emailTemplates)
        .where(and(
          eq(emailTemplates.type, type),
          eq(emailTemplates.isActive, true)
        ))
        .orderBy(desc(emailTemplates.createdAt))
        .limit(1);
      
      console.log(`📋 Found template:`, template ? {
        id: template.id,
        name: template.name,
        type: template.type,
        isActive: template.isActive
      } : 'No template found');
      
      if (template) {
        const variables = JSON.parse(template.variables || '[]');
        console.log(`✅ Returning database template: ${template.name}`);
        return {
          subject: template.subject,
          html: template.htmlContent
        };
      }
      
      console.log(`❌ No active template found for type: ${type}`);
      return null;
    } catch (error) {
      console.error('Error loading template from database:', error);
      return null;
    }
  }

  // Render template with variables
  static renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value || ''));
    }
    return rendered;
  }
  
  private static readonly FOOTER_LINKS = [
    { text: "Về chúng tôi", url: "https://emso.vn/about_us/mission" },
    { text: "Tiêu chuẩn cộng đồng", url: "https://policies.emso.vn/community-standards" },
    { text: "Chính sách kiếm tiền", url: "https://policies.emso.vn/money-making-policy" },
    { text: "Chính sách nội dung", url: "https://policies.emso.vn/ipr" },
    { text: "Chính sách quảng cáo", url: "https://policies.emso.vn/advertising-marketing" }
  ];

  private static generateFooter(): string {
    const links = this.FOOTER_LINKS
      .map(link => `<a href="${link.url}" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">${link.text}</a>`)
      .join('');

    return `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
        <p>Email này được gửi từ ${this.COMPANY_NAME} - ${this.COMPANY_TAGLINE}.</p>
        <p>Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi.</p>
        <p style="margin-top: 15px;">
          ${links}
        </p>
      </div>
    `;
  }

  private static generateBaseTemplate(title: string, content: string, greeting?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0 0 10px 0;">${title}</h2>
          ${greeting ? `<p style="margin: 0; color: #666;">${greeting}</p>` : ''}
        </div>

        <div style="background-color: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
          ${content}
        </div>

        ${this.generateFooter()}
      </div>
    `;
  }

  static getFeedbackConfirmationTemplate(data: {
    fullName: string;
    subject: string;
    feedbackType?: string;
    requestId: number;
  }): EmailTemplate {
    const feedbackTypeMap = {
      'bug_report': 'Báo lỗi',
      'feature_request': 'Yêu cầu tính năng',
      'complaint': 'Khiếu nại',
      'suggestion': 'Đề xuất',
      'other': 'Khác'
    };

    const feedbackTypeText = data.feedbackType ? feedbackTypeMap[data.feedbackType] || 'Chưa phân loại' : 'Chưa phân loại';

    const content = `
      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; margin-bottom: 15px;">
        <p style="margin: 0; color: #155724; font-weight: 500;">
          Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi. Chúng tôi vô cùng trân trọng những đóng góp quý báu của bạn. 
          Chúng tôi sẽ sớm phản hồi về Đóng góp của bạn qua email bạn đã đăng ký nhé.
        </p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
        <h4 style="color: #495057; margin: 0 0 10px 0;">Thông tin đóng góp của bạn:</h4>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Chủ đề:</strong> ${data.subject}</p>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Loại đóng góp:</strong> ${feedbackTypeText}</p>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Mã yêu cầu:</strong> #${data.requestId}</p>
      </div>

      <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
        <p style="margin: 0; color: #0d47a1; font-weight: 500;">
          Hãy cùng chúng tôi chung tay xây dựng ${this.COMPANY_TAGLINE}.
        </p>
        <p style="margin: 10px 0 0 0; color: #0d47a1; font-weight: 600;">
          Trân trọng cảm ơn!
        </p>
      </div>
    `;

    return {
      subject: "Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi - EMSO",
      html: this.generateBaseTemplate(
        "Cảm ơn bạn đã gửi Đóng góp ý kiến & Báo lỗi",
        content,
        `Xin chào ${data.fullName},`
      )
    };
  }

  static getSupportConfirmationTemplate(data: {
    fullName: string;
    subject: string;
    requestId: number;
  }): EmailTemplate {
    const content = `
      <div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3; margin-bottom: 15px;">
        <p style="margin: 0; color: #0d47a1; font-weight: 500;">
          Cảm ơn bạn đã liên hệ với chúng tôi. Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn và sẽ phản hồi trong thời gian sớm nhất.
        </p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
        <h4 style="color: #495057; margin: 0 0 10px 0;">Thông tin yêu cầu của bạn:</h4>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Chủ đề:</strong> ${data.subject}</p>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Mã yêu cầu:</strong> #${data.requestId}</p>
      </div>

      <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404; font-weight: 500;">
          Chúng tôi cam kết mang đến trải nghiệm tốt nhất cho người dùng ${this.COMPANY_TAGLINE}.
        </p>
      </div>
    `;

    return {
      subject: "Xác nhận yêu cầu hỗ trợ - EMSO",
      html: this.generateBaseTemplate(
        "Xác nhận yêu cầu hỗ trợ",
        content,
        `Xin chào ${data.fullName},`
      )
    };
  }

  static getWelcomeTemplate(data: {
    fullName: string;
    email: string;
  }): EmailTemplate {
    const content = `
      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; margin-bottom: 15px;">
        <p style="margin: 0; color: #155724; font-weight: 500;">
          Chào mừng bạn gia nhập cộng đồng ${this.COMPANY_NAME}! Chúng tôi rất vui mừng có bạn cùng tham gia xây dựng ${this.COMPANY_TAGLINE}.
        </p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
        <h4 style="color: #495057; margin: 0 0 10px 0;">Thông tin tài khoản:</h4>
        <p style="margin: 5px 0; color: #6c757d;"><strong>Email:</strong> ${data.email}</p>
      </div>

      <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 6px; border-left: 4px solid #2196f3;">
        <p style="margin: 0; color: #0d47a1; font-weight: 500;">
          Hãy khám phá và tận hưởng những trải nghiệm tuyệt vời trên nền tảng của chúng tôi!
        </p>
      </div>
    `;

    return {
      subject: "Chào mừng bạn đến với EMSO",
      html: this.generateBaseTemplate(
        "Chào mừng bạn đến với EMSO",
        content,
        `Xin chào ${data.fullName},`
      )
    };
  }

  static getSystemNotificationTemplate(data: {
    userName: string;
    title: string;
    message: string;
    isImportant?: boolean;
  }): EmailTemplate {
    const alertStyle = data.isImportant 
      ? "background-color: #f8d7da; border-left: 4px solid #dc3545; color: #721c24;"
      : "background-color: #e8f4fd; border-left: 4px solid #2196f3; color: #0d47a1;";

    const content = `
      <div style="${alertStyle} padding: 15px; border-radius: 6px; margin-bottom: 15px;">
        <p style="margin: 0; font-weight: 500;">
          ${data.message}
        </p>
      </div>
    `;

    return {
      subject: `${data.title} - EMSO`,
      html: this.generateBaseTemplate(
        data.title,
        content,
        `Xin chào ${data.userName},`
      )
    };
  }

  // Template cho email phản hồi từ admin
  static getAdminReplyTemplate(data: {
    userName: string | { id: string; name: string };
    adminMessage: string;
    originalRequest: {
      id: number;
      subject: string;
      content: string;
    };
    attachmentInfo?: string;
  }): EmailTemplate {
    // Extract actual name from userName (handle both string and object formats)
    const actualUserName = typeof data.userName === 'string' 
      ? data.userName 
      : data.userName?.name || 'N/A';
    const content = `
      <h3 style="color: #495057; margin: 0 0 15px 0;">Nội dung phản hồi:</h3>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff;">
        ${data.adminMessage}
      </div>
      ${data.attachmentInfo || ''}

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; margin-top: 20px;">
        <h4 style="color: #6c757d; margin: 0 0 10px 0;">Yêu cầu gốc của bạn:</h4>
        <p style="margin: 0 0 5px 0; color: #495057;"><strong>Chủ đề:</strong> ${data.originalRequest.subject}</p>
        <p style="margin: 0; color: #6c757d; font-size: 14px; padding: 10px; background-color: #fff; border-radius: 4px;">
          ${data.originalRequest.content.replace(/\n/g, '<br>')}
        </p>
      </div>
    `;

    return {
      subject: "Phản hồi từ hệ thống hỗ trợ - EMSO",
      html: this.generateBaseTemplate(
        "Phản hồi từ hệ thống hỗ trợ",
        content,
        `Xin chào ${actualUserName}, cảm ơn bạn đã liên hệ với chúng tôi. Dưới đây là phản hồi cho yêu cầu hỗ trợ của bạn.`
      )
    };
  }
}
