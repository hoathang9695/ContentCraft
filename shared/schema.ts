import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contents = pgTable("contents", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").unique(), // ID nội dung từ service bên ngoài qua Kafka
  source: text("source"), // Nguồn cấp
  categories: text("categories"), // Danh mục
  labels: text("labels"), // Nhãn
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed'
  assignedToId: integer("assigned_to_id").references(() => users.id), // Người được phân công xử lý
  assignedAt: timestamp("assigned_at"), // Thời điểm phân công
  approverId: integer("approver_id").references(() => users.id), // Người phê duyệt
  approveTime: timestamp("approve_time"), // Thời điểm phê duyệt
  comments: integer("comments").default(0), // Số lượng comment
  reactions: integer("reactions").default(0), // Số lượng reaction
  processingResult: text("processing_result"), // Kết quả xử lý
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
