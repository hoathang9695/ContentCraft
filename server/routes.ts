import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { ZodError } from "zod";
import { desc, eq } from 'drizzle-orm';
import { insertContentSchema, insertCategorySchema, insertLabelSchema, insertFakeUserSchema, supportRequests, users, type SupportRequest, type InsertSupportRequest } from "@shared/schema";
import { pool, db } from "./db";
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
  const supportRouter = (await import('./routes/support.router')).default;
  const realUsersRouter = (await import('./routes/real-users.router')).default;

  app.use("/api/contents", contentRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/real-users", realUsersRouter);

  // Create HTTP server
  const server = createServer(app);
  return server;
}