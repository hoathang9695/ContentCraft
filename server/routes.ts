import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { ZodError } from "zod";
import { insertContentSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { simulateKafkaMessage, simulateMultipleMessages } from "./kafka-simulator";

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
  // Set up authentication routes
  setupAuth(app);

  // Check if user is authenticated middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Content CRUD API
  app.get("/api/contents", isAuthenticated, async (req, res) => {
    try {
      const contents = await storage.getAllContents();
      res.json(contents);
    } catch (error) {
      res.status(500).json({ message: "Error fetching contents" });
    }
  });

  app.get("/api/contents/:id", isAuthenticated, async (req, res) => {
    try {
      const content = await storage.getContent(Number(req.params.id));
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Error fetching content" });
    }
  });

  app.post("/api/contents", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertContentSchema.parse({
        ...req.body,
        assignedToId: (req.user as Express.User).id,
        assignedAt: new Date()
      });
      
      const newContent = await storage.createContent(validatedData);
      res.status(201).json(newContent);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error creating content" });
    }
  });

  app.put("/api/contents/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getContent(contentId);
      const user = req.user as Express.User;
      
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Check if user is assigned to the content or an admin
      if (existingContent.assignedToId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "You can only edit content assigned to you" });
      }
      
      // Validate request body (partial validation)
      const validatedData = insertContentSchema.partial().parse(req.body);
      
      // If admin or assigned user is completing processing, add completion info
      if (validatedData.status === 'completed') {
        validatedData.approverId = user.id;
        validatedData.approveTime = new Date();
      }
      
      const updatedContent = await storage.updateContent(contentId, validatedData);
      res.json(updatedContent);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Error updating content" });
    }
  });

  app.delete("/api/contents/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = Number(req.params.id);
      const existingContent = await storage.getContent(contentId);
      const user = req.user as Express.User;
      
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Only admin can delete content
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can delete content" });
      }
      
      const deleted = await storage.deleteContent(contentId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Error deleting content" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting content" });
    }
  });

  // Get contents assigned to current user
  app.get("/api/my-contents", isAuthenticated, async (req, res) => {
    try {
      const contents = await storage.getContentsByAssignee((req.user as Express.User).id);
      res.json(contents);
    } catch (error) {
      res.status(500).json({ message: "Error fetching your assigned contents" });
    }
  });

  // Dashboard statistics
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const allContents = await storage.getAllContents();
      const user = req.user as Express.User;
      
      // If user is admin, show stats for all content, otherwise filter by assigned to user
      const filteredContents = user.role === 'admin' 
        ? allContents 
        : allContents.filter(c => c.assignedToId === user.id);
      
      // Count contents by status
      const pending = filteredContents.filter(c => c.status === 'pending').length;
      const processing = filteredContents.filter(c => c.status === 'processing').length;
      const completed = filteredContents.filter(c => c.status === 'completed').length;
      
      res.json({
        totalContent: filteredContents.length,
        pending,
        processing,
        completed
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
  
  // Update user details (admin only)
  app.patch("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { department, position, role } = req.body;
      
      // Validate role if it's provided
      if (role && !['admin', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ message: "Invalid role value" });
      }
      
      // Build update object with only the fields that are provided
      const updateData: Record<string, string> = {};
      if (department) updateData.department = department;
      if (position) updateData.position = position;
      if (role) updateData.role = role;
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Error updating user details" });
    }
  });

  // Serve uploaded files as static assets
  app.use('/uploads', express.static(uploadDir));

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
  
  // Kafka simulation endpoints (admin only)
  
  // Simulate a single kafka message (admin only)
  app.post("/api/kafka/simulate", isAdmin, async (req, res) => {
    try {
      const { contentId } = req.body;
      
      if (!contentId) {
        return res.status(400).json({ message: "Content ID is required" });
      }
      
      const message = await simulateKafkaMessage(contentId);
      res.json({ 
        success: true, 
        message: "Kafka message simulated successfully",
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
      if (content.assignedToId !== user.id && user.role !== 'admin') {
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

  const httpServer = createServer(app);
  return httpServer;
}
