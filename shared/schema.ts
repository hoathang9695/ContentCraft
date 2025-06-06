import { pgTable, text, serial, integer, boolean, timestamp, jsonb, primaryKey, varchar } from "drizzle-orm/pg-core";
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
  labels: text("labels"), // Nhãn
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

// Bảng nhãn (Labels)
export const labels = pgTable("labels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Tên nhãn
  description: text("description"), // Mô tả nhãn (tùy chọn)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema để insert Category
export const insertCategorySchema = createInsertSchema(categories).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

// Schema để insert Label
export const insertLabelSchema = createInsertSchema(labels).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertLabel = z.infer<typeof insertLabelSchema>;
export type Label = typeof labels.$inferSelect;

// Bảng người dùng ảo (FakeUsers) cho việc đẩy comment
export const fakeUsers = pgTable("fake_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Tên người dùng ảo
  token: text("token").notNull().unique(), // Token/ID đại diện cho người dùng
  email: text("email"), // Email của người dùng ảo
  password: text("password"), // Password của người dùng ảo
  description: text("description"), // Mô tả về người dùng ảo
  avatarUrl: text("avatar_url"), // URL avatar (tùy chọn)
  gender: text("gender").notNull().default("male"), // male, female, other
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
  type: text("type").default("support"), // 'support' or 'feedback'
  feedback_type: text("feedback_type"), // 'bug_report', 'feature_request', 'complaint', 'suggestion', 'other'
  feature_type: text("feature_type"), // Loại tính năng đóng góp/báo lỗi
  detailed_description: text("detailed_description"), // Mô tả chi tiết
  attachment_url: text("attachment_url"), // File đính kèm khiếu nại
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
  classification: varchar("classification", { length: 50 }).default("new"),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  assignedToId: integer("assigned_to_id").references(() => users.id),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  pageName: jsonb("page_name").notNull(),
  pageType: varchar("page_type", { length: 100 }).notNull(),
  classification: varchar("classification", { length: 50 }).default("new"),
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
  classification: varchar("classification", { length: 50 }).default("new"),
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
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // feedback_confirmation, support_confirmation, welcome, etc.
  subject: varchar("subject", { length: 500 }).notNull(),
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