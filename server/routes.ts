import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { ZodError } from "zod";
import { insertContentSchema, insertCategorySchema, insertLabelSchema, insertFakeUserSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { simulateKafkaMessage, simulateMultipleMessages, simulateMassMessages } from "./kafka-simulator";
import { log } from "./vite";

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

  // Dashboard statistics
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const allContents = await storage.getAllContents();
      const allUsers = await storage.getAllUsers();
      const user = req.user as Express.User;
      const { startDate, endDate } = req.query;

      // If user is admin, show stats for all content, otherwise filter by assigned to user
      let filteredContents = user.role === 'admin' 
        ? allContents 
        : allContents.filter(c => c.assigned_to_id === user.id);

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

      res.json({
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
        // Thông tin khoảng thời gian nếu có lọc
        period: startDate && endDate ? {
          start: startDate,
          end: endDate
        } : null
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching statistics" });
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
      const { itemId, categories, labels, safe, sourceVerification } = req.body;

      if (!itemId) {
        return res.status(400).json({ message: "Item ID is required" });
      }

      // Here you would normally send this to your Gorse service using Kafka
      // For now, we'll simulate a successful response
      log(`Sending update to Gorse service for item ${itemId}`, 'kafka');
      log(`Data: categories=${categories}, labels=${labels}, safe=${safe}, sourceVerification=${sourceVerification || 'unverified'}`, 'kafka');

      res.json({
        success: true,
        message: "Successfully sent content update to Gorse service",
        data: { itemId, categories, labels, safe, sourceVerification }
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
          message: "External ID is required"
        });
      }

      // Simulate Kafka message
      await simulateKafkaMessage(externalId);

      // Simulate sending content update to your Gorse service using Kafka
      log(`Sending update to Gorse service for external ID ${externalId}`, 'kafka');
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
      }

      // Complete processing
      const completedContent = await storage.completeProcessing(contentId, result, user.id);

      res.json({ 
        success: true, 
        message: "Content processing completed successfully",
        data: completedContent
      });
    } catch (error) {
      res.status(500).json({ 
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
  // Get all fake users (available for all authenticated users for comment functionality)
  app.get("/api/fake-users", isAuthenticated, async (req, res) => {
    try {
      const fakeUsers = await storage.getAllFakeUsers();
      res.json(fakeUsers);
    } catch (error) {
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

  const httpServer = createServer(app);
  return httpServer;
}