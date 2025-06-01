
import * as nodemailer from 'nodemailer';
import { db } from './db';
import { smtpConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

  constructor(config?: SMTPConfig) {
    this.config = config || this.getDefaultSMTPConfig();
    this.initializeFromDB();
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

  private async loadConfigFromDB(): Promise<void> {
    try {
      const result = await db.select().from(smtpConfig).where(eq(smtpConfig.isActive, true)).limit(1);
      
      if (result.length > 0) {
        const dbConfig = result[0];
        this.config = {
          host: dbConfig.host,
          port: dbConfig.port,
          secure: dbConfig.secure,
          user: dbConfig.user,
          password: dbConfig.password,
          fromName: dbConfig.fromName,
          fromEmail: dbConfig.fromEmail
        };
        console.log("SMTP config loaded from database");
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
        password: config.password,
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

  public async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.transporter) {
      console.error("SMTP not configured");
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
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

// Export interface for use in other files
export type { SMTPConfig };
