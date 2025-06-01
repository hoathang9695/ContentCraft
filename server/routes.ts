import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { ZodError } from "zod";
import { desc, eq, and, gte, lte, or, sql } from 'drizzle-orm';
import { insertContentSchema, insertCategorySchema, insertLabelSchema, insertFakeUserSchema, supportRequests, users, realUsers, type SupportRequest, type InsertSupportRequest } from "@shared/schema";
import { pool, db } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";
import { simulateKafkaMessage, simulateMultipleMessages, simulateMassMessages } from "./kafka-simulator";
import { log } from "./vite";
import { emailService, SMTPConfig } from "./email";

// Setup multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename using timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

// Configure file filter
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Only image files are allowed!'));
  }
  cb(null, true);
};

// Setup upload middleware
const upload = multer({ 
  storage: storage_config,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB max file size
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from public directory
  app.use('/images', express.static(path.join(process.cwd(), 'public/images')));

  // Set up authentication routes
  setupAuth(app);

  // Check if user is authenticated middleware with extended debug
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    // Debug info to check session
    console.log(`Session check for ${req.path}:`, {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      isAuthenticated: req.isAuthenticated(),
      user: req.isAuthenticated() ? { 
        id: (req.user as Express.User)?.id,
        username: (req.user as Express.User)?.username,
        role: (req.user as Express.User)?.role
      } : 'Not authenticated'
    });

    // Ghi log chi tiết thông tin session
    console.log("Session details:", {
      session: req.session ? 'Session exists' : 'No session',
      cookie: req.session?.cookie,
      passport: req.session ? (req.session as any).passport : null,
      headers: {
        cookie: req.headers.cookie,
        referer: req.headers.referer,
        origin: req.headers.origin
      },
      method: req.method
    });

    if (req.isAuthenticated()) {
      return next();
    }

    // Kiểm tra đặc biệt cho trường hợp cookie bị mất
    if (!req.headers.cookie || !req.headers.cookie.includes('connect.sid')) {
      console.log("Missing session cookie in request!");
    }

    // Từ chối truy cập nếu không được xác thực
    res.status(401).json({ message: "Unauthorized" });
  };

  // Content routes
  const contentRouter = (await import('./routes/content.router')).default;
  app.use("/api/contents", contentRouter);


  app.get("/api/my-contents", isAuthenticated, async (req, res) => {
    try {
      // Log thông tin để debug
      console.log("User ID requesting contents:", (req.user as Express.User).id);
      console.log("User role:", (req.user as Express.User).role);

      const contents = await storage.getContentsByAssignee((req.user as Express.User).id);

      // Thêm log để kiểm tra số lượng và trạng thái nội dung đang trả về
      console.log("Total contents returned:", contents.length);
      console.log("Contents with 'processing' status:", 
        contents.filter(c => c.status === 'processing').length);
      console.log("Contents with 'unverified' source:", 
        contents.filter(c => c.sourceVerification === 'unverified').length);
      console.log("Contents with BOTH 'processing' AND 'unverified':", 
        contents.filter(c => c.status === 'processing' && c.sourceVerification === 'unverified').length);

      // Kiểm tra và in thông tin nội dung đầu tiên để debug
      if (contents.length > 0) {
        console.log("First content example:", {
          id: contents[0].id,
          status: contents[0].status,
          verification: contents[0].sourceVerification
        });
      }

      res.json(contents);
    } catch (error) {
      console.error("Error fetching contents:", error);
      res.status(500).json({ message: "Error fetching your assigned contents" });
    }
  });

  // Cache for stats API
  let statsCache = new Map();
  const CACHE_DURATION = 30000; // 30 seconds cache

  // Dashboard statistics
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as Express.User;
      const { startDate, endDate } = req.query;

      // Create cache key
      const cacheKey = `stats-${user.id}-${user.role}-${startDate || 'all'}-${endDate || 'all'}`;
      const cached = statsCache.get(cacheKey);

      // Return cached result if still valid
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log("Returning cached stats");
        return res.json(cached.data);
      }

      console.log("Getting stats with params:", req.query);

      const allContents = await storage.getAllContents();
      console.log("Total contents fetched:", allContents.length);

      const allUsers = await storage.getAllUsers();

      // If user is admin, show stats for all content, otherwise filter by assigned to user
      let filteredContents = user.role === 'admin' 
        ? allContents 
        : allContents.filter(c => c.assigned_to_id === user.id);

      console.log("Filtered contents for user:", {
        userId: user.id,
        role: user.role,
        contentCount: filteredContents.length
      });

      // Lọc theo ngày nếu có
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);

        filteredContents = filteredContents.filter(content => {
          // Kiểm tra theo cả ngày tạo và ngày cập nhật
          // Nếu nội dung được tạo HOẶC cập nhật trong khoảng thời gian, sẽ được hiển thị
          if (!content.createdAt && !content.updatedAt) return false;

          // Kiểm tra ngày tạo nếu có
          if (content.createdAt) {
            const createdAt = new Date(content.createdAt);
            if (createdAt >= start && createdAt <= end) return true;
          }

          // Kiểm tra ngày cập nhật nếu có
          if (content.updatedAt) {
            const updatedAt = new Date(content.updatedAt);
            if (updatedAt >= start && updatedAt <= end) return true;
          }

          return false; // Không thỏa mãn điều kiện nào
        });
      }

      // Count contents by status
      const pending = filteredContents.filter(c => c.status === 'pending').length;
      // Không có trạng thái 'processing' trong database, chỉ có 'pending' và 'completed'
      const completed = filteredContents.filter(c => c.status === 'completed').length;

      // Count by source verification
      const verified = filteredContents.filter(c => c.sourceVerification === 'verified').length;
      const unverified = filteredContents.filter(c => c.sourceVerification === 'unverified').length;

      // Đếm số lượng theo safe (an toàn)
      const safe = filteredContents.filter(c => c.safe === true).length;
      const unsafe = filteredContents.filter(c => c.safe === false).length;
      const unchecked = filteredContents.filter(c => c.safe === null).length;

      // Tính số lượng nội dung trên mỗi người dùng
      const assignedPerUser = [];

      if (user.role === 'admin') {
        // Lọc chỉ người dùng active và có role là editor
        const activeEditors = allUsers.filter(u => u.status === 'active' && u.role === 'editor');

        for (const editor of activeEditors) {
          const contentsCount = filteredContents.filter(c => c.assigned_to_id === editor.id).length;
          if (contentsCount > 0) {
            assignedPerUser.push({
              userId: editor.id,
              username: editor.username,
              name: editor.name,
              count: contentsCount
            });
          }
        }

        // Sắp xếp theo số lượng nội dung giảm dần
        assignedPerUser.sort((a, b) => b.count - a.count);
      }

      // Lấy thống kê người dùng thật
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      // Sửa lại phần truy vấn để lấy đúng dữ liệu và lọc theo ngày
      // Lấy tất cả real users trong khoảng thời gian
      const realUsersStats = await db
        .select({
          id: realUsers.id,
          fullName: realUsers.fullName,
          email: realUsers.email,
          verified: realUsers.verified,
          createdAt: realUsers.createdAt,
          updatedAt: realUsers.updatedAt,
          lastLogin: realUsers.lastLogin,
          assignedToId: realUsers.assignedToId
        })
        .from(realUsers)
        .where(
          and(
            start ? gte(realUsers.createdAt, start) : undefined,
            end ? lte(realUsers.createdAt, end) : undefined
          )
        );

      console.log("Real users stats results:", realUsersStats);

      // Lấy tất cả real users từ DB
      const allRealUsers = await db.select().from(realUsers);

      // Tính tổng số người dùng thật (không tính trùng lặp theo ID)
      const uniqueIds = new Set(allRealUsers.map(u => u.fullName?.id));
      const totalRealUsers = uniqueIds.size;

      // Tính số người dùng mới trong 7 ngày
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const newRealUsers = allRealUsers.filter(u => {
        if (!u.createdAt) return false;
        const created = new Date(u.createdAt);
        return created >= sevenDaysAgo;
      }).length;

      console.log("Real users stats:", {
        total: totalRealUsers,
        new: newRealUsers
      });

      // Pages statistics
      const { pages } = await import("../shared/schema");
      const allPages = await db.select().from(pages);
      const totalPages = allPages.length;

      // Tính số trang mới trong 7 ngày gần đây
      const sevenDaysAgoPages = new Date();
      sevenDaysAgoPages.setDate(sevenDaysAgoPages.getDate() - 7);

      const newPages = allPages.filter(p => {
        if (!p.createdAt) return false;
        const created = new Date(p.createdAt);
        return created >= sevenDaysAgoPages;
      }).length;

      console.log("Pages stats:", {
        total: totalPages,
        new: newPages
      });

      // Groups statistics
      const { groups } = await import("../shared/schema");
      const allGroups = await db.select().from(groups);
      const totalGroups = allGroups.length;

      // Tính số nhóm mới trong 7 ngày gần đây
      const sevenDaysAgoGroups = new Date();
      sevenDaysAgoGroups.setDate(sevenDaysAgoGroups.getDate() - 7);

      const newGroups = allGroups.filter(g => {
        if (!g.createdAt) return false;
        const created = new Date(g.createdAt);
        return created >= sevenDaysAgoGroups;
      }).length;

      console.log("Groups stats:", {
        total: totalGroups,
        new: newGroups
      });

      const result = {
        totalContent: filteredContents.length,
        pending,
        completed,
        // Thông tin trạng thái xác minh nguồn
        verified,
        unverified, 
        // Thông tin trạng thái an toàn  
        safe,
        unsafe,
        unchecked,
        // Số lượng bài viết đã được phân công
        assigned: filteredContents.filter(c => c.assigned_to_id !== null).length,
        // Số lượng bài viết chưa được phân công
        unassigned: filteredContents.filter(c => c.assigned_to_id === null).length,
        // Thêm thông tin số lượng nội dung trên mỗi người dùng (chỉ admin mới thấy)
        assignedPerUser: user.role === 'admin' ? assignedPerUser : [],
        // Thống kê người dùng thật
        totalRealUsers,
        newRealUsers,
         totalPages,
        newPages,
        totalGroups,
        newGroups,
        // Thông tin khoảng thời gian nếu có lọc
        period: startDate && endDate ? {
          start: startDate,
          end: endDate
        } : null
      };

      // Cache the result
      statsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      // Clean old cache entries
      if (statsCache.size > 100) {
        const oldestKey = statsCache.keys().next().value;
        statsCache.delete(oldestKey);
      }

      res.json(result);
    } catch (error) {
      console.error("Error in /api/stats:", error);
      res.status(500).json({ 
        message: "Error fetching statistics",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // User management routes (admin only)
  // Check if user is admin middleware
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated() && (req.user as Express.User).role === 'admin') {
      return next();
    }
    res.status(403).json({ message: "Admin access required" });
  };

  // Get all users (admin only)
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove password from response
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Update user status (admin only)
  app.patch("/api/users/:id/status", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { status } = req.body;

      if (!status || !['active', 'pending', 'blocked'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const updatedUser = await storage.updateUserStatus(userId, status);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Error updating user status" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);

      // Không cho phép xóa admin đầu tiên (id=1)
      if (userId === 1) {
        return res.status(400).json({ 
          message: "Cannot delete the main administrator account" 
        });
      }

      // Kiểm tra người dùng tồn tại
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Ghi log hoạt động xóa user
      await storage.logUserActivity({
        userId: (req.user as Express.User).id,
        activityType: "delete_user",
        metadata: {
          details: `Deleted user ${user.username} (ID: ${userId}) and reassigned their content`
        }
      });

      // Thực hiện xóa user
      const deleted = await storage.deleteUser(userId);

      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete user" });
      }

      res.json({ 
        message: "User deleted successfully",
        success: true
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Error deleting user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update user details (admin only)
  // Reset user password (admin only)
  app.post("/api/users/:id/reset-password", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user's password
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Error resetting password" });
    }
  });

  app.patch("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { department, position, role } = req.body;

      // Validate role if it's provided
      if (role && !['admin', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role value" });
      }

      // Build update object with only the fields that are provided
      const updateData: Record<string, string> = {};
      if (department) updateData.department = department;
      if (position) updateData.position = position;
      if (role) updateData.role = role;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields to update" });
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      return res.json({ success: true, data: safeUser });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Error updating user details" });
    }
  });

  // Serve uploaded files as static assets
  app.use('/uploads', express.static(uploadDir));

  // Serve robots.txt từ public directory
  app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'robots.txt'));
  });

  // Upload user avatar (authenticated user)
  app.post("/api/user/avatar/upload", isAuthenticated, upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = (req.user as Express.User).id;

      // Generate relative URL to the uploaded file
      const avatarUrl = `/uploads/${path.basename(req.file.path)}`;

      const updatedUser = await storage.updateUser(userId, { avatarUrl });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message || "Error uploading avatar" });
      } else {
        res.status(500).json({ message: "Error uploading avatar" });
      }
    }
  });

  // Keep the old endpoint for backward compatibility
  app.patch("/api/user/avatar", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as Express.User).id;
      const { avatarUrl } = req.body;

      if (!avatarUrl) {
        return res.status(400).json({ message: "Avatar URL is required" });
      }

      // Validate URL format
      try {
        new URL(avatarUrl);
      } catch (e) {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      const updatedUser = await storage.updateUser(userId, { avatarUrl });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Error updating avatar" });
    }
  });

  // Change password (authenticated user)
  app.post("/api/user/change-password", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as Express.User).id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      // Validate password length
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isPasswordCorrect = await comparePasswords(currentPassword, user.password);
      if (!isPasswordCorrect) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Error changing password" });
    }
  });

  // User activity monitoring routes (admin only)

  // Get all user activities (admin only)
  app.get("/api/user-activities", isAdmin, async (req, res) => {
    try {
      const activities = await storage.getUserActivities();
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user activities" });
    }
  });

  // Get activities for a specific user (admin only)
  app.get("/api/user-activities/:userId", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const activities = await storage.getUserActivities(userId);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user activities" });
    }
  });

  // Get recent activities with limit (admin only)
  app.get("/api/recent-activities", isAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Error fetching recent activities" });
    }
  });

  // Kafka simulation endpoints

  // API endpoint to send content updates to Gorse service
  app.post("/api/kafka/send", isAuthenticated, async (req, res) => {
    try {
      const { externalId, categories, labels, safe, sourceVerification } = req.body;

      if (!externalId) {
        return res.status(400).json({ message: "External ID is required" });
      }

      // Here you would normally send this to your Gorse service using Kafka
      // For now, we'll simulate a successful response
      log(`Sending update to Gorse service for item ${externalId}`, 'kafka');
      log(`Data: categories=${categories}, labels=${labels}, safe=${safe}, sourceVerification=${sourceVerification || 'unverified'}`, 'kafka');

      res.json({
        success: true,
        message: "Successfully sent content update to Gorse service",
        data: { externalId, categories, labels, safe, sourceVerification }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error sending content update to Gorse service",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Tạo endpoint test dành cho public để kiểm thử kafka
  app.post("/api/kafka/test", async (req, res) => {
    try {
      // Tạo ID ngẫu nhiên cho nội dung test
      const contentId = `test-${Date.now()}`;

      const message = await simulateKafkaMessage(contentId);
      res.json({ 
        success: true, 
        message: "Kafka message simulated successfully (test endpoint)",
        data: message
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error simulating Kafka message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint tạm thời để cập nhật trạng thái tất cả nội dung dựa trên Categories - Không yêu cầu xác thực
  app.post("/api/public/update-statuses", async (req, res) => {
    try {
      const count = await storage.updateAllContentStatuses();
      res.json({
        success: true,
        message: `Đã cập nhật trạng thái cho ${count} nội dung dựa trên Categories.`,
        updatedCount: count
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi khi cập nhật trạng thái nội dung",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint không cần xác thực để tạo nhiều nội dung (chỉ cho môi trường phát triển)
  app.post("/api/kafka/dev-simulate", async (req, res) => {
    try {
      const { count = 5 } = req.body;

      // Giới hạn số lượng tin nhắn từ 1 đến 50
      const messageCount = Math.min(Math.max(1, Number(count)), 50);

      log(`Development mode: Simulating ${messageCount} Kafka messages without authentication`, 'kafka-simulator');

      const messages = await simulateMultipleMessages(messageCount);

      res.json({ 
        success: true, 
        message: `${messages.length} Kafka messages simulated successfully`,
        data: messages
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error simulating Kafka messages",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Simulate a single kafka message (admin only)
  app.post("/api/kafka/simulate", isAdmin, async (req, res) => {
    try {
      const { externalId, categories, labels, safe, sourceVerification } = req.body;

      if (!externalId) {
        return res.status(400).json({
          success: false,
          message: "Item ID is required"
        });
      }

      // Simulate sending content update to your Gorse service using Kafka
      log(`Sending update to Gorse service for item ${externalId}`, 'kafka');
      log(`Data: categories=${categories}, labels=${labels}, safe=${safe}, sourceVerification=${sourceVerification || 'unverified'}`, 'kafka');

      // Simulate Kafka message
      await simulateKafkaMessage(externalId);

      res.json({
        success: true,
        message: "Kafka message simulated successfully",
        data: { externalId, categories, labels, safe, sourceVerification }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error simulating Kafka message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Simulate multiple kafka messages (admin only)
  app.post("/api/kafka/simulate-batch", isAdmin, async (req, res) => {
    try {
      const { count = 5 } = req.body;

      // Validate count
      const messageCount = Math.min(Math.max(1, Number(count)), 20);

      const messages = await simulateMultipleMessages(messageCount);
      res.json({ 
        success: true, 
        message: `${messages.length} Kafka messages simulated successfully`,
        data: messages
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error simulating Kafka messages",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Simulate mass kafka messages (special endpoint for 99 messages) (admin only)
  app.post("/api/kafka/simulate-mass", isAdmin, async (req, res) => {
    try {
      const { count = 99 } = req.body;

      // Validate count (no upper limit for mass simulation)
      const messageCount = Math.max(1, Number(count));

      res.json({ 
        success: true, 
        message: `Starting simulation of ${messageCount} Kafka messages. This may take some time...`,
      });

      // Asynchronously process messages without blocking response
      simulateMassMessages(messageCount).then(messages => {
        console.log(`Completed processing ${messages.length} messages in mass simulation`);
      }).catch(err => {
        console.error('Error in mass simulation:', err);
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error starting mass Kafka message simulation",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get assignable users (active editors) (admin only)
  app.get("/api/users/assignable", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Filter for active editors only
      const assignableUsers = users
        .filter(user => user.role === 'editor' && user.status === 'active')
        .map(({ password, ...user }) => user);

      res.json(assignableUsers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching assignable users" });
    }
  });

  // Get editor users for anyone (accessible to all authenticated users)
  app.get("/api/editors", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Filter for active editors only
      const editorUsers = users
        .filter(user => user.role === 'editor' && user.status === 'active')
        .map(({ id, username, name }) => ({ id, username, name }));

      res.json(editorUsers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching editor users" });
    }
  });

  // Assign content to user (admin only)
  app.post("/api/contents/:id/assign", isAdmin, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const content = await storage.assignContentToUser(contentId, Number(userId));

      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      res.json({ 
        success: true, 
        message: "Content assigned successfully",
        data: content
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error assigning content to user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Complete content processing (authenticated user)
  app.post("/api/contents/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const { result } = req.body;
      const user = req.user as Express.User;

      if (!result) {
        return res.status(400).json({ message: "Processing result is required" });
      }

      // Get the content
      const content = await storage.getContent(contentId);

      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Check if content is assigned to the current user or if user is admin
      if (content.assigned_to_id !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "You can only complete content assigned to you" });
      }// Complete processing
      const completedContent = await storage.completeProcessing(contentId, result, user.id);

      res.json({ 
        success: true, 
        message: "Content processing completed successfully",
        data: completedContent
      });
    } catch (error) {res.status(500).json({ 
        success: false,
        message: "Error completing content processing",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API để tăng số lượng comment
  app.patch("/api/contents/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const { count = 1 } = req.body;

      // Lấy thông tin nội dung
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Tính toán số lượng comments mới
      const currentCount = content.comments || 0;
      const newCount = currentCount + count;

      // Cập nhật nội dung
      const updated = await storage.updateContent(contentId, { comments: newCount });

      if (!updated) {
        return res.status(404).json({ message: "Content update failed" });
      }

      res.json({
        success: true,
        message: "Comments count updated successfully",
        data: updated
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error updating comments count",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API để gửi comment đến API bên ngoài
  app.post("/api/contents/:externalId/send-comment", isAuthenticated, async (req, res) => {
    try {
      const { externalId } = req.params;
      const { fakeUserId, comment } = req.body;

      if (!externalId) {
        return res.status(400).json({ success: false, message: "External ID is required" });
      }

      if (!fakeUserId) {
        return res.status(400).json({ success: false, message: "Fake user ID is required" });
      }

      if (!comment) {
        return res.status(400).json({ success: false, message: "Comment content is required" });
      }

      // Lấy thông tin fake user
      const fakeUser = await storage.getFakeUser(Number(fakeUserId));
      if (!fakeUser) {
        return res.status(404).json({ success: false, message: "Fake user not found" });
      }

      // Kiểm tra token của fake user
      if (!fakeUser.token) {
        return res.status(400).json({ success: false, message: "Fake user does not have a valid token" });
      }

      // Tìm nội dung từ external ID
      const contents = await storage.getAllContents();
      const content = contents.find(c => c.externalId === externalId);

      if (!content) {
        return res.status(404).json({ success: false, message: "Content with this external ID not found" });
      }

      try {
        // Gửi comment đến API bên ngoài
        const response = await fetch(`https://prod-sn.emso.vn/api/v1/statuses/${externalId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fakeUser.token}`
          },
          body: JSON.stringify({
            status: comment
          })
        });

        // Kiểm tra kết quả từ API
        if (response.ok) {
          const apiResponse = await response.json();

          // Tăng số lượng comment trong database
          const currentCount = content.comments || 0;
          const updated = await storage.updateContent(content.id, { comments: currentCount + 1 });

          return res.json({
            success: true,
            message: "Comment sent successfully",
            data: {
              externalId,
              contentId: content.id,
              apiResponse
            }
          });
        } else {
          const errorData = await response.json();
          return res.status(response.status).json({
            success: false,
            message: "Failed to send comment to external API",
            error: errorData
          });
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error sending comment to external API",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error processing request",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API để tăng số lượng reactions
  app.patch("/api/contents/:id/reactions", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const { count = 1 } = req.body;

      // Lấy thông tin nội dung
      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Tính toán số lượng reactions mới
      const currentCount = content.reactions || 0;
      const newCount = currentCount + count;

      // Cập nhật nội dung
      const updated = await storage.updateContent(contentId, { reactions: newCount });

      if (!updated) {
        return res.status(404).json({ message: "Content update failed" });
      }

      res.json({
        success: true,
        message: "Reactions count updated successfully",
        data: updated
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: "Error updating reactions count",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ===== Categories and Labels API =====

  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const allCategories = await storage.getAllCategories();
      res.json(allCategories);
    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching categories",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get single category
  app.get("/api/categories/:id", async (req, res) => {
    try {
      const categoryId = Number(req.params.id);
      const category = await storage.getCategory(categoryId);

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(category);
    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching category",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create new category (admin only)
  app.post("/api/categories", isAdmin, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const newCategory = await storage.createCategory(validatedData);
      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Error creating category",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update category (admin only)
  app.put("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const categoryId = Number(req.params.id);
      const existingCategory = await storage.getCategory(categoryId);

      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      const validatedData = insertCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateCategory(categoryId, validatedData);

      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Error updating category",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete category (admin only)
  app.delete("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const categoryId = Number(req.params.id);
      const existingCategory = await storage.getCategory(categoryId);

      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      const deleted = await storage.deleteCategory(categoryId);

      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Error deleting category" });
      }
    } catch (error) {
      res.status(500).json({ 
        message: "Error deleting category",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all labels
  app.get("/api/labels", async (req, res) => {
    try {
      const allLabels = await storage.getAllLabels();
      res.json(allLabels);
    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching labels",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get labels by category
  app.get("/api/categories/:categoryId/labels", async (req, res) => {
    try {
      const categoryId = Number(req.params.categoryId);
      const category = await storage.getCategory(categoryId);

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      const labels = await storage.getLabelsByCategory(categoryId);
      res.json(labels);
    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching labels for category",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get single label
  app.get("/api/labels/:id", async (req, res) => {
    try {
      const labelId = Number(req.params.id);
      const label = await storage.getLabel(labelId);

      if (!label) {
        return res.status(404).json({ message: "Label not found" });
      }

      res.json(label);
    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching label",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create new label (admin only)
  app.post("/api/labels", isAdmin, async (req, res) => {
    try {
      const validatedData = insertLabelSchema.parse(req.body);

      // Verify the category exists
      const category = await storage.getCategory(validatedData.categoryId);
      if (!category) {
        return res.status(400).json({ message: "Category not found" });
      }

      const newLabel = await storage.createLabel(validatedData);
      res.status(201).json(newLabel);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Error creating label",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update label (admin only)
  app.put("/api/labels/:id", isAdmin, async (req, res) => {
    try {
      const labelId = Number(req.params.id);
      const existingLabel = await storage.getLabel(labelId);

      if (!existingLabel) {
        return res.status(404).json({ message: "Label not found" });
      }

      const validatedData = insertLabelSchema.parse(req.body);

      // Verify the category exists if categoryId is being changed
      if (validatedData.categoryId && validatedData.categoryId !== existingLabel.categoryId) {
        const category = await storage.getCategory(validatedData.categoryId);
        if (!category) {
          return res.status(400).json({ message: "Category not found" });
        }
      }

      const updatedLabel = await storage.updateLabel(labelId, validatedData);
      res.json(updatedLabel);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Error updating label",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete label (admin only)
  app.delete("/api/labels/:id", isAdmin, async (req, res) => {
    try {
      const labelId = Number(req.params.id);
      const existingLabel = await storage.getLabel(labelId);

      if (!existingLabel) {
        return res.status(404).json({ message: "Label not found" });
      }

      const deleted = await storage.deleteLabel(labelId);

      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Error deleting label" });
      }
    } catch (error) {
      res.status(500).json({ 
        message: "Error deleting label",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Fake Users API
  // Get all fake users with pagination (available for all authenticated users for comment functionality)
  app.get("/api/fake-users", isAuthenticated, async (req, res) => {
    try {
      console.log("Fake users API called with query:", req.query);

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const search = req.query.search as string || '';

      console.log("Parsed parameters:", { page, pageSize, search });

      // Nếu không có phân trang (để compatibility với comment functionality)
      if (!req.query.page && !req.query.pageSize) {
        console.log("No pagination params - returning all fake users");
        const fakeUsers = await storage.getAllFakeUsers();
        return res.json(fakeUsers);
      }

      console.log("Using pagination - calling getFakeUsersWithPagination");
      const result = await storage.getFakeUsersWithPagination(page, pageSize, search);
      console.log("Pagination result:", { 
        total: result.total, 
        usersCount: result.users.length,
        page: result.page,
        totalPages: result.totalPages 
      });

      // Set cache control headers to prevent caching issues
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json(result);
    } catch (error) {
      console.error("Error in fake users API:", error);
      res.status(500).json({ 
        message: "Error fetching fake users",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get fake user by ID
  app.get("/api/fake-users/:id", isAdmin, async (req, res) => {
    try {
      const fakeUserId = Number(req.params.id);
      const fakeUser = await storage.getFakeUser(fakeUserId);

      if (!fakeUser) {
        return res.status(404).json({ message: "Fake user not found" });
      }
      
      res.json(fakeUser);

    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching fake user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update real user classification
  app.put("/api/real-users/:id/classification", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { classification } = req.body;

      if (!['new', 'potential', 'non_potential'].includes(classification)) {
        return res.status(400).json({ message: "Invalid classification value" });
      }

      const updatedUser = await db
        .update(realUsers)
        .set({ 
          classification,
          updatedAt: new Date()
        })
        .where(eq(realUsers.id, parseInt(id)))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        message: "Classification updated successfully",
        user: updatedUser[0]
      });
    } catch (error) {
      console.error("Error updating classification:", error);
      res.status(500).json({ 
        message: "Error updating classification",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Create fake user (admin only)
  app.post("/api/fake-users", isAdmin, async (req, res) => {
    try {
      // Validate with insertFakeUserSchema
      const validatedData = insertFakeUserSchema.parse({
        ...req.body,
        status: req.body.status || 'active' // Default status is active
      });

      // Kiểm tra xem token đã tồn tại chưa
      const existingFakeUser = await storage.getFakeUserByToken(validatedData.token);
      if (existingFakeUser) {
        return res.status(400).json({ 
          message: "Token đã tồn tại",
          error: "Token này đã được sử dụng bởi một người dùng ảo khác" 
        });
      }

      const newFakeUser = await storage.createFakeUser(validatedData);
      res.status(201).json(newFakeUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Error creating fake user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Bulk upload fake users from Excel (admin only)
  app.post("/api/fake-users/bulk-upload", isAdmin, async (req, res) => {
    try {
      const { users } = req.body;

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ 
          message: "Dữ liệu không hợp lệ",
          error: "Cần cung cấp danh sách người dùng ảo" 
        });
      }

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const userData of users) {
        try {
          // Validate data
          const validatedData = insertFakeUserSchema.parse({
            name: userData.name,
            token: userData.token,
            status: 'active'
          });

          // Kiểm tra token đã tồn tại chưa
          const existingFakeUser = await storage.getFakeUserByToken(validatedData.token);
          if (existingFakeUser) {
            errors.push(`Token "${validatedData.token}" đã tồn tại`);
            failedCount++;
            continue;
          }

          // Tạo người dùng ảo mới
          await storage.createFakeUser(validatedData);
          successCount++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Lỗi với "${userData.name}": ${errorMsg}`);
          failedCount++;
        }
      }

      res.json({
        success: successCount,
        failed: failedCount,
        errors: errors
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Error bulk uploading fake users",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update fake user (admin only)
  app.put("/api/fake-users/:id", isAdmin, async (req, res) => {
    try {
      const fakeUserId = Number(req.params.id);
      const existingFakeUser = await storage.getFakeUser(fakeUserId);

      if (!existingFakeUser) {
        return res.status(404).json({ message: "Fake user not found" });
      }

      // Validate with insertFakeUserSchema.partial() to allow partial updates
      const validatedData = insertFakeUserSchema.partial().parse(req.body);

      // Nếu đang cập nhật token, kiểm tra xem token mới đã tồn tại chưa
      if (validatedData.token && validatedData.token !== existingFakeUser.token) {
        const duplicateUser = await storage.getFakeUserByToken(validatedData.token);
        if (duplicateUser && duplicateUser.id !== fakeUserId) {
          return res.status(400).json({ 
            message: "Token đã tồn tại",
            error: "Token này đã được sử dụng bởi một người dùng ảo khác" 
          });
        }
      }

      const updatedFakeUser = await storage.updateFakeUser(fakeUserId, validatedData);
      res.json(updatedFakeUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Error updating fake user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete fake user (admin only)
  app.delete("/api/fake-users/:id", isAdmin, async (req, res) => {
    try {
      const fakeUserId = Number(req.params.id);
      const existingFakeUser = await storage.getFakeUser(fakeUserId);

      if (!existingFakeUser) {
        return res.status(404).json({ message: "Fake user not found" });
      }

      const deleted = await storage.deleteFakeUser(fakeUserId);

      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Error deleting fake user" });
      }
    } catch (error) {
      res.status(500).json({ 
        message: "Error deleting fake user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get random fake user (for generating comments)
  app.get("/api/random-fake-user", isAuthenticated, async (req, res) => {
    try {
      const randomFakeUser = await storage.getRandomFakeUser();

      if (!randomFakeUser) {
        return res.status(404).json({ message: "No active fake users found" });
      }

      res.json(randomFakeUser);
    } catch (error) {
      res.status(500).json({ 
        message: "Error fetching random fake user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Support routes
  const supportRouter = (await import('./routes/support.router')).default;
  app.use("/api/support-requests", supportRouter);

  // Pages API endpoints
  // Get all pages 
  app.get("/api/pages", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const pageType = req.query.pageType as string;
      const search = req.query.search as string;
      const activeTab = req.query.activeTab as 'all' | 'processed' | 'unprocessed';
      const assignedToId = req.query.assignedToId ? parseInt(req.query.assignedToId as string) : undefined;
      const classification = req.query.classification as string;

      console.log("Pages API called with params:", {
        page, limit, offset, startDate, endDate, pageType, search, activeTab, assignedToId, classification
      });

      // Import pages from schema
      const { pages } = await import("../shared/schema");
      const pagesTable = pages;

      // Build conditions
      const conditions = [];

      // Date range filter
      if (startDate && endDate) {
        conditions.push(
          and(
            gte(pagesTable.createdAt, startDate),
            lte(pagesTable.createdAt, endDate)
          )
        );
      }

      // Page type filter
      if (pageType) {
        conditions.push(eq(pagesTable.pageType, pageType));
      }

      // Assigned user filter
      if (assignedToId) {
        conditions.push(eq(pagesTable.assignedToId, assignedToId));
      }

      // Classification filter
      if (classification) {
        conditions.push(eq(pagesTable.classification, classification));
      }

      // Search filter
      if (search && search.trim()) {
        const searchPattern = `%${search.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${pagesTable.pageName}::jsonb->>'page_name') LIKE ${searchPattern}`,
            sql`LOWER(${pagesTable.pageName}::jsonb->>'name') LIKE ${searchPattern}`,
            sql`LOWER(${pagesTable.phoneNumber}) LIKE ${searchPattern}`
          )
        );
      }

      const whereConditions = conditions;
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pagesTable)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);
      // Update pages API to return manager data from managerId column
      const { users } = await import("../shared/schema");
      // Update pages API to return manager data from managerId column
      // Update pages API to return manager data from managerId column
      const pagesData = await db
          .select({
            id: pagesTable.id,
            pageName: pagesTable.pageName,
            pageType: pagesTable.pageType,
            classification: pagesTable.classification,
            phoneNumber: pagesTable.phoneNumber,
            monetizationEnabled: pagesTable.monetizationEnabled,
            adminData: pagesTable.adminData,
            createdAt: pagesTable.createdAt,
            updatedAt: pagesTable.updatedAt,
            assignedToId: pagesTable.assignedToId,
            processorId: users.id,
            processorName: users.name,
            processorUsername: users.username
          })
          .from(pagesTable)
          .leftJoin(users, eq(pagesTable.assignedToId, users.id))
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
          .orderBy(desc(pagesTable.createdAt))
          .limit(limit)
          .offset(offset);

      // Transform the data to match expected format
      const transformedPages = pagesData.map(page => ({
        ...page,
        classification: page.classification || 'new',
        processor: page.processorId ? {
          id: page.processorId,
          name: page.processorName,
          username: page.processorUsername
        } : null
      }));

      console.log(`Found ${transformedPages.length} pages for page ${page}`);

      res.json({
        data: transformedPages,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      console.error("Error fetching pages:", error);
      res.status(500).json({ 
        message: "Error fetching pages",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update page classification
  app.put("/api/pages/:id/classification", isAuthenticated, async (req, res) => {
    try {
      const pageId = parseInt(req.params.id);
      const { classification } = req.body;

      // Validate classification value
      const validClassifications = ['new', 'potential', 'non_potential'];
      if (!validClassifications.includes(classification)) {
        return res.status(400).json({ 
          message: "Invalid classification value",
          validValues: validClassifications
        });
      }

      // Import pages from schema
      const { pages } = await import("../shared/schema");

      // Update the page classification
      const updatedPage = await db
        .update(pages)
        .set({ 
          classification,
          updatedAt: new Date()
        })
        .where(eq(pages.id, pageId))
        .returning();

      if (!updatedPage.length) {
        return res.status(404).json({ message: "Page not found" });
      }

      res.json({ 
        success: true, 
        message: "Classification updated successfully",
        data: updatedPage[0] 
      });
    } catch (error) {
      console.error("Error updating page classification:", error);
      res.status(500).json({ 
        message: "Error updating page classification",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Groups API endpoints
  // Get all groups 
  app.get("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const groupType = req.query.groupType as string;
      const search = req.query.search as string;
      const activeTab = req.query.activeTab as 'all' | 'processed' | 'unprocessed';
      const assignedToId = req.query.assignedToId ? parseInt(req.query.assignedToId as string) : undefined;
      const classification = req.query.classification as string;

      console.log("Groups API called with params:", {
        page, limit, offset, startDate, endDate, groupType, search, activeTab, assignedToId, classification
      });

      // Import groups from schema
      const { groups } = await import("../shared/schema");
      const groupsTable = groups;

      // Build conditions
      const conditions = [];

      // Date range filter
      if (startDate && endDate) {
        conditions.push(
          and(
            gte(groupsTable.createdAt, startDate),
            lte(groupsTable.createdAt, endDate)
          )
        );
      }

      // Group type filter
      if (groupType) {
        conditions.push(eq(groupsTable.groupType, groupType));
      }

      // Assigned user filter
      if (assignedToId) {
        conditions.push(eq(groupsTable.assignedToId, assignedToId));
      }

      // Classification filter
      if (classification) {
        conditions.push(eq(groupsTable.classification, classification));
      }

      // Search filter
      // Add search condition - search in group name, phone number, and categories
        if (search) {
          conditions.push(
            or(
              sql`${groupsTable.groupName}->>'group_name' ILIKE ${`%${search}%`}`,
              sql`${groupsTable.phoneNumber} ILIKE ${`%${search}%`}`,
              sql`${groupsTable.categories} ILIKE ${`%${search}%`}`
            )
          );
        }

      const whereConditions = conditions;
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(groupsTable)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);

      const groupsData = await db
          .select({
            id: groupsTable.id,
            groupName: groupsTable.groupName,
            groupType: groupsTable.groupType,
            categories: groupsTable.categories,
            classification: groupsTable.classification,
phoneNumber: groupsTable.phoneNumber,
            monetizationEnabled: groupsTable.monetizationEnabled,
            adminData: groupsTable.adminData,
            createdAt: groupsTable.createdAt,
            updatedAt: groupsTable.updatedAt,
            assignedToId: groupsTable.assignedToId,
            processorId: users.id,
            processorName: users.name,
            processorUsername: users.username
          })
          .from(groupsTable)
          .leftJoin(users, eq(groupsTable.assignedToId, users.id))
          .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
          .orderBy(desc(groupsTable.createdAt))
          .limit(limit)
          .offset(offset);

      // Transform the data to match expected format
      const transformedGroups = groupsData.map(group => ({
        ...group,
        classification: group.classification || 'new',
        processor: group.processorId ? {
          id: group.processorId,
          name: group.processorName,
          username: group.processorUsername
        } : null
      }));

      console.log(`Found ${transformedGroups.length} groups for page ${page}`);

      res.json({
        data: transformedGroups,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ 
        message: "Error fetching groups",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update group classification
  app.put("/api/groups/:id/classification", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const { classification } = req.body;

      // Validate classification value
      const validClassifications = ['new', 'potential', 'non_potential'];
      if (!validClassifications.includes(classification)) {
        return res.status(400).json({ 
          message: "Invalid classification value",
          validValues: validClassifications
        });
      }

      // Import groups from schema
      const { groups } = await import("../shared/schema");

      // Update the group classification
      const updatedGroup = await db
        .update(groups)
        .set({ 
          classification,
          updatedAt: new Date()
        })
        .where(eq(groups.id, groupId))
        .returning();

      if (!updatedGroup.length) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.json({ 
        success: true, 
        message: "Classification updated successfully",
        data: updatedGroup[0] 
      });
    } catch (error) {
      console.error("Error updating group classification:", error);
      res.status(500).json({ 
        message: "Error updating group classification",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all real users 
  app.get("/api/real-users", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const verificationStatus = req.query.verificationStatus as 'verified' | 'unverified' | undefined;
      const search = req.query.search as string;
      const activeTab = req.query.activeTab as 'all' | 'processed' | 'unprocessed';
      const assignedToId = req.query.assignedToId ? parseInt(req.query.assignedToId as string) : undefined;
      const classification = req.query.classification as string;

      console.log("Real users API called with params:", {
        page, limit, offset, startDate, endDate, verificationStatus, search, activeTab, assignedToId, classification
      });

      // Build conditions
      const conditions = [];

      // Date range filter
      if (startDate && endDate) {
        conditions.push(
          and(
            gte(realUsers.createdAt, startDate),
            lte(realUsers.createdAt, endDate)
          )
        );
      }

      // Verification status filter
      if (verificationStatus === 'verified') {
        conditions.push(eq(realUsers.verified, 'verified'));
      } else if (verificationStatus === 'unverified') {
        conditions.push(eq(realUsers.verified, 'unverified'));
      }

      // Assigned user filter
      if (assignedToId) {
        conditions.push(eq(realUsers.assignedToId, assignedToId));
      }

      // Classification filter
       if (classification) {
         conditions.push(eq(realUsers.classification, classification));
       }

      // Search filter
      if (search && search.trim()) {
        const searchPattern = `%${search.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(UNACCENT(${realUsers.fullName}::jsonb->>'name')) LIKE ${searchPattern}`,
            sql`LOWER(${realUsers.fullName}::jsonb->>'name') LIKE ${searchPattern}`,
            sql`LOWER(${realUsers.email}) LIKE ${searchPattern}`
          )
        );
      }

      // Active tab filter (processed/unprocessed)
      // This is for future implementation when we add processing status

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(realUsers)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);

      // Get users with pagination and join with assigned user info
      const realUsersData = await db
        .select({
          id: realUsers.id,
          fullName: realUsers.fullName,
          email: realUsers.email,
          verified: realUsers.verified,
          classification: realUsers.classification,
          createdAt: realUsers.createdAt,
          updatedAt: realUsers.updatedAt,
          lastLogin: realUsers.lastLogin,
          assignedToId: realUsers.assignedToId,
          processorId: users.id,
          processorName: users.name,
          processorUsername: users.username
        })
        .from(realUsers)
        .leftJoin(users, eq(realUsers.assignedToId, users.id))
        .where(whereClause)
        .orderBy(desc(realUsers.createdAt))
        .limit(limit)
        .offset(offset);

      // Transform the data to match expected format
      const transformedUsers = realUsersData.map(user => ({
        ...user,
        classification: user.classification || 'new', // Use DB classification or default
        processor: user.processorId ? {
          id: user.processorId,
          name: user.processorName,
          username: user.processorUsername
        } : null
      }));

      console.log(`Found ${transformedUsers.length} real users for page ${page}`);

      res.json({
        data: transformedUsers,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit
        }
      });
    } catch (error) {
      console.error("Error fetching real users:", error);
      res.status(500).json({ 
        message: "Error fetching real users",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);

  // EmailService is already initialized as singleton in email.ts

  // Check if user is authenticated middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // SMTP Configuration endpoints
  app.get("/api/smtp-config", requireAuth, async (req, res) => {
    try {
      // Only admin can access SMTP config
      if ((req.user as Express.User).role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get SMTP config from emailService
      const smtpConfig: SMTPConfig = emailService.getConfig();

      res.json(smtpConfig);
    } catch (error) {
      console.error("Error fetching SMTP config:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/smtp-config", requireAuth, async (req, res) => {
    try {
      // Only admin can update SMTP config
      if ((req.user as Express.User).role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { host, port, secure, user, password, fromName, fromEmail } = req.body;

      // Validate required fields
      if (!host || !port || !user || !password || !fromName || !fromEmail) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const smtpConfig: SMTPConfig = {
        host,
        port: parseInt(port),
        secure: secure || false,
        user,
        password,
        fromName,
        fromEmail
      };

      // Update email service configuration
      await emailService.updateConfig(smtpConfig);

      res.json({ 
        message: "SMTP configuration updated successfully",
        config: smtpConfig 
      });
    } catch (error) {
      console.error("Error updating SMTP config:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/smtp-config/test", requireAuth, async (req, res) => {
    try {
      // Only admin can test SMTP config
      if ((req.user as Express.User).role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { testEmail } = req.body;
      const targetEmail = testEmail || `${(req.user as Express.User).username}@test.com`;

      // Test SMTP connection first
      const connectionOk = await emailService.testConnection();
      if (!connectionOk) {
        return res.status(400).json({ message: "SMTP connection failed. Please check configuration." });
      }

      // Send test email
      const emailSent = await emailService.sendTestEmail(targetEmail);
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send test email" });
      }

      res.json({ 
        message: "SMTP test completed successfully",
        testEmail: targetEmail
      });
    } catch (error) {
      console.error("Error testing SMTP:", error);
      res.status(500).json({ message: "SMTP test failed" });
    }
  });

  return httpServer;
}

// Include adminData in pages API response and query.