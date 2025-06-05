import * as nodemailer from 'nodemailer';
import { db } from './db';
import { smtpConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: SMTPConfig;
  private readonly encryptionKey = process.env.SMTP_ENCRYPTION_KEY || 'emso-smtp-key-32-characters-long!';
  private readonly algorithm = 'aes-256-cbc';

  constructor(config?: SMTPConfig) {
    this.config = config || this.getDefaultSMTPConfig();
    this.initializeFromDB();
  }

  private encryptPassword(password: string): string {
    if (!password) return '';
    try {
      const iv = randomBytes(16);

      // Ensure key is exactly 32 bytes for aes-256-cbc
      const keyBuffer = Buffer.alloc(32);
      const sourceKey = Buffer.from(this.encryptionKey);
      sourceKey.copy(keyBuffer, 0, 0, Math.min(sourceKey.length, 32));

      const cipher = createCipheriv(this.algorithm, keyBuffer, iv);
      let encrypted = cipher.update(password);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
      console.error('Error encrypting password:', error);
      return password; // Fallback to plain text if encryption fails
    }
  }

  private decryptPassword(encryptedPassword: string): string {
    if (!encryptedPassword) return '';
    try {
      const textParts = encryptedPassword.split(':');
      if (textParts.length !== 2) {
        // Assume it's plain text password (for backward compatibility)
        return encryptedPassword;
      }
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');

      // Ensure key is exactly 32 bytes for aes-256-cbc
      const keyBuffer = Buffer.alloc(32);
      const sourceKey = Buffer.from(this.encryptionKey);
      sourceKey.copy(keyBuffer, 0, 0, Math.min(sourceKey.length, 32));

      const decipher = createDecipheriv(this.algorithm, keyBuffer, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (error) {
      console.error('Error decrypting password:', error);
      // If decryption fails, assume it's a plain text password (backward compatibility)
      return encryptedPassword;
    }
  }

  private async initializeFromDB() {
    try {
      await this.loadConfigFromDB();
      this.initializeTransporter();
    } catch (error) {
      console.error("Failed to load SMTP config from DB:", error);
      // Fallback to default config
      this.initializeTransporter();
    }
  }

  public async loadConfigFromDB(): Promise<void> {
    try {
      // Get the most recent active config (sorted by createdAt DESC)
      const result = await db.select().from(smtpConfig)
        .where(eq(smtpConfig.isActive, true))
        .orderBy(smtpConfig.createdAt)
        .limit(1);

      if (result.length > 0) {
        const dbConfig = result[0];
        this.config = {
          host: dbConfig.host,
          port: dbConfig.port,
          secure: dbConfig.secure,
          user: dbConfig.user,
          password: this.decryptPassword(dbConfig.password),
          fromName: dbConfig.fromName,
          fromEmail: dbConfig.fromEmail
        };
        console.log(`SMTP config loaded from database (ID: ${dbConfig.id}) with encrypted password`);
      } else {
        console.log("No active SMTP config found in database, using defaults");
      }
    } catch (error) {
      console.error("Error loading SMTP config from database:", error);
      throw error;
    }
  }

  private initializeTransporter() {
    if (!this.config.user || !this.config.password) {
      console.log("SMTP not configured - email functionality disabled");
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    });

    console.log("SMTP transporter initialized:", {
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
    });
  }

  private getDefaultSMTPConfig(): SMTPConfig {
    return {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || "",
      password: process.env.SMTP_PASSWORD || "",
      fromName: process.env.SMTP_FROM_NAME || "EMSO System",
      fromEmail: process.env.SMTP_FROM_EMAIL || ""
    };
  }

  public getConfig(): SMTPConfig {
    return { ...this.config };
  }

  public async updateConfig(config: SMTPConfig): Promise<void> {
    try {
      // Deactivate all existing configs
      await db.update(smtpConfig)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(smtpConfig.isActive, true));

      // Insert new config as active
      await db.insert(smtpConfig).values({
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        password: this.encryptPassword(config.password),
        fromName: config.fromName,
        fromEmail: config.fromEmail,
        isActive: true
      });

      // Update internal config
      this.config = { ...config };

      // Reinitialize transporter with new config
      this.initializeTransporter();

      console.log("SMTP configuration updated in database");
    } catch (error) {
      console.error("Error updating SMTP config in database:", error);
      throw error;
    }
  }

  public async sendEmail(to: string, subject: string, content: string): Promise<boolean> {
    if (!this.transporter) {
      console.error('SMTP transporter not initialized');
      return false;
    }

    try {
      const mailOptions = {
        from: this.config ? `"${this.config.fromName}" <${this.config.fromEmail}>` : 'noreply@example.com',
        to,
        subject,
        html: content
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendReplyEmail(data: {
    to: string;
    subject: string;
    content: string;
    originalRequest: {
      id: number;
      full_name: string;
      subject: string;
      content: string;
    };
  }): Promise<boolean> {
    return this.sendReplyEmailWithAttachments({
      ...data,
      attachments: []
    });
  }

  async sendDirectEmail(data: {
    to: string;
    subject: string;
    content: string;
    attachments?: Array<{
      filename: string;
      path: string;
      contentType?: string;
      cid?: string;
    }>;
    userInfo: {
      id: number;
      name: string;
      email: string;
    };
  }): Promise<boolean> {
    if (!this.transporter) {
      console.error('SMTP transporter not initialized');
      return false;
    }

    try {
      // Process content to handle embedded images
      let processedContent = data.content;
      const imageAttachments: Array<any> = [];
      const fileAttachments: Array<any> = [];

      // Extract data URLs from content and replace with CID references
      const dataUrlRegex = /<img[^>]+src="data:([^;]+);base64,([^"]+)"[^>]*>/g;
      let match;
      let imageIndex = 0;

      while ((match = dataUrlRegex.exec(data.content)) !== null) {
        const mimeType = match[1];
        const base64Data = match[2];
        const cid = `embedded-image-${imageIndex}`;

        // Replace data URL with CID reference
        processedContent = processedContent.replace(match[0], 
          match[0].replace(`data:${mimeType};base64,${base64Data}`, `cid:${cid}`)
        );

        // Add to embedded attachments
        imageAttachments.push({
          filename: `embedded-image-${imageIndex}.${mimeType.split('/')[1]}`,
          content: base64Data,
          encoding: 'base64',
          cid: cid,
          contentType: mimeType
        });

        imageIndex++;
      }

      // Prepare file attachments (from file uploads)
      if (data.attachments && data.attachments.length > 0) {
        data.attachments.forEach(attachment => {
          fileAttachments.push({
            filename: attachment.filename,
            path: attachment.path,
            contentType: attachment.contentType
          });
        });
      }

      const attachmentInfo = fileAttachments.length > 0 
        ? `<div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; margin-top: 15px;">
             <h4 style="color: #0066cc; margin: 0 0 10px 0; font-size: 14px;">📎 Tập tin đính kèm:</h4>
             <ul style="margin: 0; padding-left: 20px; color: #495057;">
               ${fileAttachments.map(att => `<li style="margin-bottom: 5px;">${att.filename}</li>`).join('')}
             </ul>
           </div>`
        : '';

      const footerHtml = `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            <p>Email này được gửi từ EMSO - Mạng xã hội vì người Việt.</p>
            <p>Rất hy vọng nhận được nhiều sự góp ý, chung tay xây dựng mạng xã hội của Việt Nam bạn nhé!</p>
            <p style="margin-top: 15px;">
              <a href="https://emso.vn/about_us/mission" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Về chúng tôi</a>
              <a href="https://policies.emso.vn/community-standards" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Tiêu chuẩn cộng đồng</a>
              <a href="https://policies.emso.vn/money-making-policy" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Chính sách kiếm tiền</a>
              <a href="https://policies.emso.vn/ipr" style="color: #3B82F6; text-decoration: none; margin-right: 10px;">Chính sách nội dung</a>
              <a href="https://policies.emso.vn/advertising-marketing" style="color: #3B82F6; text-decoration: none;">Chính sách quảng cáo</a>
            </p>
          </div>
        `;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 10px 0;">Thông báo từ EMSO System</h2>
            <p style="margin: 0; color: #666;">Xin chào ${data.userInfo.name}, đây là thông báo từ hệ thống EMSO.</p>
          </div>

          <div style="background-color: #fff; padding: 20px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #495057; margin: 0 0 15px 0;">Nội dung thông báo:</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff;">
              ${processedContent}
            </div>
            ${attachmentInfo}
          </div>

          ${footerHtml}
        </div>
      `;

      const mailOptions: any = {
        from: this.config ? `"${this.config.fromName}" <${this.config.fromEmail}>` : 'noreply@example.com',
        to: data.to,
        subject: data.subject,
        html: htmlContent,
        attachments: [...imageAttachments, ...fileAttachments]
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Direct email sent successfully to ${data.to} for user #${data.userInfo.id} with ${imageAttachments.length} embedded images and ${fileAttachments.length} file attachments`);
      return true;
    } catch (error) {
      console.error('Error sending direct email:', error);
      return false;
    }
  }

  async sendReplyEmailWithAttachments(data: {
    to: string;
    subject: string;
    content: string;
    attachments?: Array<{
      filename: string;
      path: string;
      contentType?: string;
      cid?: string;
    }>;
    originalRequest: {
      id: number;
      full_name: string;
      subject: string;
      content: string;
    };
  }): Promise<boolean> {
    if (!this.transporter) {
      console.error('SMTP transporter not initialized');
      return false;
    }

    try {
      const { EmailTemplateService } = await import('./email-templates.js');
      
      // Process content to handle embedded images
      let processedContent = data.content;
      const imageAttachments: Array<any> = [];
      const fileAttachments: Array<any> = [];

      // Extract data URLs from content and replace with CID references
      const dataUrlRegex = /<img[^>]+src="data:([^;]+);base64,([^"]+)"[^>]*>/g;
      let match;
      let imageIndex = 0;

      while ((match = dataUrlRegex.exec(data.content)) !== null) {
        const mimeType = match[1];
        const base64Data = match[2];
        const cid = `embedded-image-${imageIndex}`;

        // Replace data URL with CID reference
        processedContent = processedContent.replace(match[0], 
          match[0].replace(`data:${mimeType};base64,${base64Data}`, `cid:${cid}`)
        );

        // Add to embedded attachments
        imageAttachments.push({
          filename: `embedded-image-${imageIndex}.${mimeType.split('/')[1]}`,
          content: base64Data,
          encoding: 'base64',
          cid: cid,
          contentType: mimeType
        });

        imageIndex++;
      }

      // Prepare file attachments (from file uploads)
      if (data.attachments && data.attachments.length > 0) {
        data.attachments.forEach(attachment => {
          fileAttachments.push({
            filename: attachment.filename,
            path: attachment.path,
            contentType: attachment.contentType
          });
        });
      }

      const attachmentInfo = fileAttachments.length > 0 
        ? `<div style="background-color: #e8f4fd; padding: 15px; border-radius: 6px; margin-top: 15px;">
             <h4 style="color: #0066cc; margin: 0 0 10px 0; font-size: 14px;">📎 Tập tin đính kèm:</h4>
             <ul style="margin: 0; padding-left: 20px; color: #495057;">
               ${fileAttachments.map(att => `<li style="margin-bottom: 5px;">${att.filename}</li>`).join('')}
             </ul>
           </div>`
        : '';

      // Use email template service for admin reply
      const emailTemplate = EmailTemplateService.getAdminReplyTemplate({
        userName: data.originalRequest.full_name,
        adminMessage: processedContent,
        originalRequest: data.originalRequest,
        attachmentInfo
      });

      const mailOptions: any = {
        from: this.config ? `"${this.config.fromName}" <${this.config.fromEmail}>` : 'noreply@example.com',
        to: data.to,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        attachments: [...imageAttachments, ...fileAttachments]
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Reply email sent successfully to ${data.to} for request #${data.originalRequest.id} with ${imageAttachments.length} embedded images and ${fileAttachments.length} file attachments`);
      return true;
    } catch (error) {
      console.error('Error sending reply email:', error);
      return false;
    }
  }

  public async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log("SMTP connection test successful");
      return true;
    } catch (error) {
      console.error("SMTP connection test failed:", error);
      return false;
    }
  }

  public async sendTestEmail(testEmail: string): Promise<boolean> {
    const subject = "Test Email từ EMSO System";
    const html = `
      <h2>Test Email thành công!</h2>
      <p>Đây là email test từ EMSO System.</p>
      <p>Thời gian gửi: ${new Date().toLocaleString('vi-VN')}</p>
      <p>Cấu hình SMTP đang hoạt động bình thường.</p>
    `;

    return await this.sendEmail(testEmail, subject, html);
  }

  // Template-based email methods
  public async sendFeedbackConfirmation(data: {
    to: string;
    fullName: string;
    subject: string;
    feedbackType?: string;
    requestId: number;
  }): Promise<boolean> {
    try {
      // Always ensure fresh SMTP config and transporter
      console.log('🔄 Initializing SMTP for feedback confirmation...');
      await this.loadConfigFromDB();
      this.initializeTransporter();
      
      if (!this.transporter) {
        console.error('❌ Failed to initialize SMTP transporter after config load');
        return false;
      }
      
      console.log('✅ SMTP transporter ready for email sending');
      
      const { EmailTemplateService } = await import('./email-templates.js');
      
      // First try to get template from database
      let emailTemplate = await EmailTemplateService.getTemplateFromDatabase('feedback_confirmation');
      
      if (emailTemplate) {
        // Use database template and render variables
        const variables = {
          fullName: data.fullName,
          subject: data.subject,
          feedbackType: data.feedbackType,
          requestId: data.requestId,
          companyName: 'EMSO'
        };
        
        emailTemplate.html = EmailTemplateService.renderTemplate(emailTemplate.html, variables);
        emailTemplate.subject = EmailTemplateService.renderTemplate(emailTemplate.subject, variables);
        
        console.log(`📧 Using database template for feedback confirmation to ${data.to}`);
        console.log(`📝 Template name: ${emailTemplate.subject}`);
      } else {
        // Fallback to hardcoded template
        emailTemplate = EmailTemplateService.getFeedbackConfirmationTemplate({
          fullName: data.fullName,
          subject: data.subject,
          feedbackType: data.feedbackType,
          requestId: data.requestId
        });
        
        console.log(`📧 Using fallback template for feedback confirmation to ${data.to}`);
      }

      return await this.sendEmail(data.to, emailTemplate.subject, emailTemplate.html);
    } catch (error) {
      console.error('Error sending feedback confirmation email:', error);
      return false;
    }
  }

  public async sendSupportConfirmation(data: {
    to: string;
    fullName: string;
    subject: string;
    requestId: number;
  }): Promise<boolean> {
    try {
      // Always ensure fresh SMTP config and transporter
      console.log('🔄 Initializing SMTP for support confirmation...');
      await this.loadConfigFromDB();
      this.initializeTransporter();
      
      if (!this.transporter) {
        console.error('❌ Failed to initialize SMTP transporter after config load');
        return false;
      }
      
      console.log('✅ SMTP transporter ready for email sending');
      
      const { EmailTemplateService } = await import('./email-templates.js');
      
      // First try to get template from database
      let emailTemplate = await EmailTemplateService.getTemplateFromDatabase('support_confirmation');
      
      if (emailTemplate) {
        // Use database template and render variables
        const variables = {
          fullName: data.fullName,
          subject: data.subject,
          requestId: data.requestId,
          companyName: 'EMSO'
        };
        
        emailTemplate.html = EmailTemplateService.renderTemplate(emailTemplate.html, variables);
        emailTemplate.subject = EmailTemplateService.renderTemplate(emailTemplate.subject, variables);
        
        console.log(`📧 Using database template for support confirmation to ${data.to}`);
        console.log(`📝 Template name: ${emailTemplate.subject}`);
      } else {
        // Fallback to hardcoded template
        emailTemplate = EmailTemplateService.getSupportConfirmationTemplate({
          fullName: data.fullName,
          subject: data.subject,
          requestId: data.requestId
        });
        
        console.log(`📧 Using fallback template for support confirmation to ${data.to}`);
      }

      return await this.sendEmail(data.to, emailTemplate.subject, emailTemplate.html);
    } catch (error) {
      console.error('Error sending support confirmation email:', error);
      return false;
    }
  }

  public async sendWelcomeEmail(data: {
    to: string;
    fullName: string;
  }): Promise<boolean> {
    try {
      const { EmailTemplateService } = await import('./email-templates.js');
      const emailTemplate = EmailTemplateService.getWelcomeTemplate({
        fullName: data.fullName,
        email: data.to
      });

      return await this.sendEmail(data.to, emailTemplate.subject, emailTemplate.html);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  public async sendSystemNotification(data: {
    to: string;
    userName: string;
    title: string;
    message: string;
    isImportant?: boolean;
  }): Promise<boolean> {
    try {
      const { EmailTemplateService } = await import('./email-templates.js');
      const emailTemplate = EmailTemplateService.getSystemNotificationTemplate({
        userName: data.userName,
        title: data.title,
        message: data.message,
        isImportant: data.isImportant
      });

      return await this.sendEmail(data.to, emailTemplate.subject, emailTemplate.html);
    } catch (error) {
      console.error('Error sending system notification email:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export interface for use in other files
export type { SMTPConfig };