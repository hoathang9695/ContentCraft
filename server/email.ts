
import nodemailer from 'nodemailer';

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

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpConfig = this.getSMTPConfig();
    
    if (!smtpConfig.user || !smtpConfig.password) {
      console.log("SMTP not configured - email functionality disabled");
      return;
    }

    this.transporter = nodemailer.createTransporter({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
    });

    console.log("SMTP transporter initialized:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      user: smtpConfig.user,
    });
  }

  private getSMTPConfig(): SMTPConfig {
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

  public updateConfig(config: SMTPConfig) {
    // In a production environment, you might want to store this in database
    // For now, we'll update environment variables
    process.env.SMTP_HOST = config.host;
    process.env.SMTP_PORT = config.port.toString();
    process.env.SMTP_SECURE = config.secure.toString();
    process.env.SMTP_USER = config.user;
    process.env.SMTP_PASSWORD = config.password;
    process.env.SMTP_FROM_NAME = config.fromName;
    process.env.SMTP_FROM_EMAIL = config.fromEmail;

    // Reinitialize transporter with new config
    this.initializeTransporter();
  }

  public async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.transporter) {
      console.error("SMTP not configured");
      return false;
    }

    const smtpConfig = this.getSMTPConfig();

    try {
      const info = await this.transporter.sendMail({
        from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
        to,
        subject,
        text,
        html,
      });

      console.log("Email sent successfully:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
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
    const text = `Test Email thành công! Đây là email test từ EMSO System. Thời gian gửi: ${new Date().toLocaleString('vi-VN')}`;

    return await this.sendEmail(testEmail, subject, html, text);
  }
}

// Export singleton instance
export const emailService = new EmailService();
