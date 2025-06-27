import { pgTable, text, serial, integer, boolean, timestamp, jsonb, primaryKey, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull().default("Marketing"), // 'Marketing', 'Chăm sóc khách hàng', 'Kinh doanh', 'Kế toán', 'Lập trình viên'
  position: text("position").notNull().default("Nhân viên"), // 'Nhân viên', 'Trưởng phòng'
  role: text("role").notNull().default("editor"),
  status: text("status").notNull().default("pending"), // 'active', 'pending', 'inactive'
  avatarUrl: text("avatar_url"),
  can_send_email: boolean("can_send_email").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contents = pgTable("contents", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").unique(), // ID nội dung từ service bên ngoài qua Kafka
  source: text("source"), // Nguồn cấp (có thể null)
  categories: text("categories"), // Danh mục
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed'
  sourceVerification: text("source_verification").notNull().default("unverified"), // 'verified', 'unverified'
  assigned_to_id: integer("assigned_to_id").references(() => users.id), // Người được phân công xử lý
  assignedAt: timestamp("assigned_at"), // Thời điểm phân công
  approver_id: integer("approver_id").references(() => users.id), // Người phê duyệt
  approveTime: timestamp("approve_time"), // Thời điểm phê duyệt
  comments: integer("comments").default(0), // Số lượng comment
  reactions: integer("reactions").default(0), // Số lượng reaction
  processingResult: text("processing_result"), // Kết quả xử lý
  safe: boolean("safe"), // Trạng thái an toàn (true: an toàn, false: không an toàn, null: chưa đánh giá)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  sourceClassification: text("source_classification").default("new"), // 'new', 'potential', 'non_potential', 'positive'
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertContentSchema = createInsertSchema(contents).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertContent = z.infer<typeof insertContentSchema>;
export type Content = typeof contents.$inferSelect;

// Login schema (subset of user)
export const loginSchema = insertUserSchema.pick({
  username: true,
  password: true,
});

export type LoginData = z.infer<typeof loginSchema>;

// User activity log for tracking login/logout/registration
export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  activityType: text("activity_type").notNull(), // 'login', 'logout', 'register'
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"), // Additional info like device, browser, etc
});

export const insertUserActivitySchema = createInsertSchema(userActivities).omit({ 
  id: true,
  timestamp: true 
});

export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;

// Bảng danh mục (Categories)
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Tên danh mục
  description: text("description"), // Mô tả danh mục (tùy chọn)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema để insert Category
export const insertCategorySchema = createInsertSchema(categories).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;



// Bảng người dùng ảo (FakeUsers) cho việc đẩy comment
export const fakeUsers = pgTable("fake_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Tên người dùng ảo
  token: text("token").notNull().unique(), // Token/ID đại diện cho người dùng
  email: text("email"), // Email của người dùng ảo
  password: text("password"), // Password của người dùng ảo
  description: text("description"), // Mô tả về người dùng ảo
  avatarUrl: text("avatar_url"), // URL avatar (tùy chọn)
  gender: text("gender").notNull().default("male_adult"), // male_adult, male_young, male_teen, female_adult, female_young, female_teen, other
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema để insert FakeUser
export const insertFakeUserSchema = createInsertSchema(fakeUsers).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
}).extend({
  email: z.string().email("Email không hợp lệ").optional(),
  password: z.string().min(1, "Password là bắt buộc").optional(),
  gender: z.enum(["male_adult", "male_young", "male_teen", "female_adult", "female_young", "female_teen", "other"]).default("male_adult"),
});

export type InsertFakeUser = z.infer<typeof insertFakeUserSchema>;
export type FakeUser = typeof fakeUsers.$inferSelect;

// Bảng yêu cầu hỗ trợ (Support Requests)
export const supportRequests = pgTable("support_requests", {
  id: serial("id").primaryKey(),
  full_name: jsonb("full_name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed
  assigned_to_id: integer("assigned_to_id").references(() => users.id),
  assigned_at: timestamp("assigned_at"),
  response_content: text("response_content"),
  responder_id: integer("responder_id").references(() => users.id),
  response_time: timestamp("response_time"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  type: text("type").default("support"), // 'support', 'feedback', or 'verify'
  feedback_type: text("feedback_type"), // 'bug_report', 'feature_request', 'complaint', 'suggestion', 'other'
  feature_type: text("feature_type"), // Loại tính năng đóng góp/báo lỗi
  detailed_description: text("detailed_description"), // Mô tả chi tiết
  attachment_url: text("attachment_url"), // File đính kèm khiếu nại
  verification_name: text("verification_name"), // Tên cần xác minh cho yêu cầu xác minh
  phone_number: text("phone_number"), // Số điện thoại cho yêu cầu xác minh
  identity_verification_id: integer("identity_verification_id"), // ID xác minh danh tính
});

export const insertSupportRequestSchema = createInsertSchema(supportRequests).omit({ 
  id: true, 
  created_at: true,
  updated_at: true 
});

export type InsertSupportRequest = z.infer<typeof insertSupportRequestSchema>;
export type SupportRequest = typeof supportRequests.$inferSelect;

// Real users table
export const realUsers = pgTable("real_users", {
  id: serial("id").primaryKey(),
  fullName: jsonb("full_name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  verified: varchar("verified", { length: 50 }).default("unverified"),
  classification: varchar("classification", { length: 50 }).default("new"), // 'new', 'potential', 'non_potential', 'positive'
  deviceToken: varchar("device_token", { length: 500 }), // Firebase FCM device token
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  assignedToId: integer("assigned_to_id").references(() => users.id),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  pageName: jsonb("page_name").notNull(),
  pageType: varchar("page_type", { length: 100 }).notNull(),
  classification: varchar("classification", { length: 50 }).default("new"), // 'new', 'potential', 'non_potential', 'positive'
  adminData: jsonb("admin_data"), // Admin data in JSON format
  phoneNumber: varchar("phone_number", { length: 20 }),
  monetizationEnabled: boolean("monetization_enabled").default(false),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertPageSchema = createInsertSchema(pages).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  groupName: jsonb("group_name").notNull(),
  groupType: varchar("group_type", { length: 100 }).notNull(), // 'public' or 'private'
  categories: varchar("categories", { length: 100 }), // 'business', 'community', 'education', etc.
  classification: varchar("classification", { length: 50 }).default("new"), // 'new', 'potential', 'positive'
  adminData: jsonb("admin_data"), // Admin data in JSON format
  phoneNumber: varchar("phone_number", { length: 20 }),
  monetizationEnabled: boolean("monetization_enabled").default(false),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertGroupSchema = createInsertSchema(groups).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

// SMTP Configuration table
export const smtpConfig = pgTable("smtp_config", {
  id: serial("id").primaryKey(),
  host: varchar("host", { length: 255 }).notNull().default("smtp.gmail.com"),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").notNull().default(false),
  user: varchar("user", { length: 255 }).notNull(),
  password: text("password").notNull(),
  fromName: varchar("from_name", { length: 255 }).notNull().default("EMSO System"),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  variables: text("variables").notNull(), // JSON array of variable names used in template
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema để insert SMTP Config
export const insertSMTPConfigSchema = createInsertSchema(smtpConfig).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertSMTPConfig = z.infer<typeof insertSMTPConfigSchema>;
export type SMTPConfig = typeof smtpConfig.$inferSelect;

// Bảng nội dung vi phạm (Infringing Contents)
export const infringingContents = pgTable("infringing_contents", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(), // ID nội dung từ service bên ngoài
  assigned_to_id: integer("assigned_to_id").references(() => users.id), // Người xử lý
  processing_time: timestamp("processing_time"), // Thời gian xử lý
  violation_description: text("violation_description"), // Mô tả vi phạm
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed'
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInfringingContentSchema = createInsertSchema(infringingContents).omit({ 
  id: true, 
  created_at: true,
  updated_at: true 
});

export type InsertInfringingContent = z.infer<typeof insertInfringingContentSchema>;
export type InfringingContent = typeof infringingContents.$inferSelect;

export interface ContentMessage {
  externalId: string;        // ID nội dung, kiểu string
  source?: {                // Nguồn cấp dạng object
    id: string;            // ID của nguồn
    name: string;          // Tên của nguồn
  };          
  categories?: string;      // Danh mục, kiểu string và optional
  labels?: string;          // Nhãn, kiểu string và optional 
  sourceVerification?: 'verified' | 'unverified';  // Trạng thái xác minh nguồn
}

// Bảng quản lý báo cáo (Report Management)
export const reportManagement = pgTable("report_management", {
  id: serial("id").primaryKey(),
  reportedId: jsonb("reported_id").notNull(), // ID đối tượng bị báo cáo (JSON format)
  reportType: varchar("report_type", { length: 50 }).notNull(), // 'user', 'content', 'page', 'group', 'comment', 'course', 'project', 'recruitment', 'song', 'event'
  reporterName: jsonb("reporter_name").notNull(), // Tên người báo cáo (JSON format)
  reporterEmail: varchar("reporter_email", { length: 255 }).notNull(), // Email người báo cáo
  reason: varchar("reason", { length: 500 }).notNull(), // Lý do báo cáo
  detailedReason: text("detailed_reason"), // Mô tả chi tiết
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'processing', 'completed'
  assignedToId: integer("assigned_to_id").references(() => users.id), // Người được phân công
  assignedToName: varchar("assigned_to_name", { length: 255 }), // Tên người được phân công
  assignedAt: timestamp("assigned_at"), // Thời điểm phân công
  responseContent: text("response_content"), // Nội dung phản hồi
  responderId: integer("responder_id").references(() => users.id), // Người phản hồi
  responseTime: timestamp("response_time"), // Thời gian phản hồi
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Schema để insert Report
export const insertReportManagementSchema = createInsertSchema(reportManagement).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertReportManagement = z.infer<typeof insertReportManagementSchema>;
export type ReportManagement = typeof reportManagement.$inferSelect;

export const commentQueues = pgTable("comment_queues", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull(),
  comment: text("comment").notNull(),
  gender: text("gender").default("all").notNull(),
  status: text("status").default("pending").notNull(),
  sessionId: text("session_id"),
  processedCount: integer("processed_count").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  currentCommentIndex: integer("current_comment_index").default(0),
  totalComments: integer("total_comments").default(0),
  errorInfo: text("error_info"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CommentQueue = typeof commentQueues.$inferSelect;
export type InsertCommentQueue = typeof commentQueues.$inferInsert;

export const savedReports = pgTable('saved_reports', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  reportType: varchar('report_type', { length: 50 }).notNull().default('dashboard'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  reportData: jsonb('report_data').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertSavedReportSchema = createInsertSchema(savedReports).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertSavedReport = z.infer<typeof insertSavedReportSchema>;
export type SavedReport = typeof savedReports.$inferSelect;

// Bảng thông báo (Notifications)
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  targetAudience: varchar("target_audience", { length: 100 }).notNull().default("all"), // 'all', 'new', 'potential', 'positive', 'non_potential'
  status: varchar("status", { length: 50 }).notNull().default("draft"), // 'draft', 'approved', 'sent'
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  sentBy: integer("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at"),
  approvedAt: timestamp("approved_at"),
  recipientCount: integer("recipient_count").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
