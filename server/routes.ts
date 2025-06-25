import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { ZodError } from "zod";
import {
  and,
  desc,
  eq,
  gte,
  lte,
  like,
  sql,
  count,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";
import {
  insertContentSchema,
  insertCategorySchema,
  insertFakeUserSchema,
  supportRequests,
  users,
  realUsers,
  type SupportRequest,
  type InsertSupportRequest,
} from "@shared/schema";
import { pool, db } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  simulateKafkaMessage,
  simulateMultipleMessages,
  simulateMassMessages,
} from "./kafka-simulator";
import { log } from "./vite";
import { emailService, SMTPConfig } from "./email";
import { FileCleanupService } from "./file-cleanup";
import { feedbackRouter } from "./routes/feedback.router.js";
import { supportRouter } from "./routes/support.router.js";
import { infringingContentRouter } from "./routes/infringing-content.router.js";
import reportManagementRouter from "./routes/report-management.router.js";
import savedReportsRouter from "./routes/saved-reports.router.js";

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
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "avatar-" + uniqueSuffix + ext);
  },
});

// Configure file filter
const fileFilter = (
  req: Express.Request,
  file: multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error("Only image files are allowed!"));
  }
  cb(null, true);
};

// Setup upload middleware
const upload = multer({
  storage: storage_config,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB max file size
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from public directory
  app.use("/images", express.static(path.join(process.cwd(), "public/images")));

  const httpServer = createServer(app);

  // Setup Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Socket.IO connection handling
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Handle initial badge counts request
    socket.on("request-badge-counts", async () => {
      try {
        const { groups, supportRequests } = await import("../shared/schema");
        const { pages } = await import("../shared/schema");
        const { users } = await import("../shared/schema");
        const { realUsers } = await import("../shared/schema");

        const [realUsersNewCount, pagesNewCount, groupsNewCount] =
          await Promise.all([
            db
              .select({
                count: sql<number>`count(*)`,
              })
              .from(realUsers)
              .where(eq(realUsers.classification, "new")),

            db
              .select({
                count: sql<number>`count(*)`,
              })
              .from(pages)
              .where(eq(pages.classification, "new")),

            db
              .select({
                count: sql<number>`count(*)`,
              })
              .from(groups)
              .where(eq(groups.classification, "new")),
          ]);

        // Đếm support requests có status = 'pending' và type = 'support' (hoặc không có type - backward compatibility)
        const pendingSupportRequests = await db
          .select({ count: sql`count(*)::int` })
          .from(supportRequests)
          .where(
            and(
              eq(supportRequests.status, "pending"),
              or(
                eq(supportRequests.type, "support"),
                isNull(supportRequests.type),
              ),
            ),
          );

        // Đếm feedback requests có type = 'feedback' và status = 'pending'
        const pendingFeedbackRequests = await db
          .select({ count: sql`count(*)::int` })
          .from(supportRequests)
          .where(
            and(
              eq(supportRequests.type, "feedback"),
              eq(supportRequests.status, "pending"),
            ),
          );

        // Đếm verification requests có type = 'verify' và status = 'pending'
        const pendingVerificationRequests = await db
          .select({ count: sql`count(*)::int` })
          .from(supportRequests)
          .where(
            and(
              eq(supportRequests.type, "verify"),
              eq(supportRequests.status, "pending"),
            ),
          );

        // Đếm tick requests có type = 'tick' và status = 'pending'
        const pendingTickRequests = await db
          .select({ count: sql`count(*)::int` })
          .from(supportRequests)
          .where(
            and(
              eq(supportRequests.type, "tick"),
              eq(supportRequests.status, "pending"),
            ),
          );

        // Đếm report requests có status = 'pending'
        const { reportManagement } = await import("../shared/schema");
        const pendingReportRequests = await db
          .select({ count: sql`count(*)::int` })
          .from(reportManagement)
          .where(eq(reportManagement.status, "pending"));

        const pendingSupport = pendingSupportRequests[0]?.count || 0;
        const pendingFeedback = pendingFeedbackRequests[0]?.count || 0;
        const pendingVerification = pendingVerificationRequests[0]?.count || 0;
        const pendingTick = pendingTickRequests[0]?.count || 0;
        const pendingReports = pendingReportRequests[0]?.count || 0;

        // Tổng số pending requests (support + feedback + verification + tick) cho menu cha "Xử lý phản hồi"
        const totalPendingRequests = pendingSupport + pendingFeedback + pendingVerification + pendingTick;

        const badgeCounts = {
          realUsers: realUsersNewCount[0]?.count || 0,
          pages: pagesNewCount[0]?.count || 0,
          groups: groupsNewCount[0]?.count || 0,
          supportRequests: pendingSupport,
          feedbackRequests: pendingFeedback,
          verificationRequests: pendingVerification,
          tickRequests: pendingTick,
          reportRequests: pendingReports,
          totalRequests: totalPendingRequests, // Tổng cho menu cha
        };

        const filteredBadgeCounts = {
          realUsers:
            badgeCounts.realUsers > 0 ? badgeCounts.realUsers : undefined,
          pages: badgeCounts.pages > 0 ? badgeCounts.pages : undefined,
          groups: badgeCounts.groups > 0 ? badgeCounts.groups : undefined,
          supportRequests:
            badgeCounts.supportRequests > 0
              ? badgeCounts.supportRequests
              : undefined,
          feedbackRequests:
            badgeCounts.feedbackRequests > 0
              ? badgeCounts.feedbackRequests
              : undefined,
          verificationRequests:
            badgeCounts.verificationRequests > 0
              ? badgeCounts.verificationRequests
              : undefined,
          tickRequests:
            badgeCounts.tickRequests > 0
              ? badgeCounts.tickRequests
              : undefined,
          reportRequests:
            badgeCounts.reportRequests > 0
              ? badgeCounts.reportRequests
              : undefined,
          totalRequests:
            badgeCounts.totalRequests > 0
              ? badgeCounts.totalRequests
              : undefined,
        };

        // Send initial data to requesting client
        socket.emit("badge-update", filteredBadgeCounts);
        console.log(
          "Sent initial badge counts to client:",
          socket.id,
          filteredBadgeCounts,
        );
      } catch (error) {
        console.error("Error sending initial badge counts:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  async function countNewRealUsers() {
    const { realUsers } = await import("../shared/schema");
    const result = await db
      .select({ count: sql`count(*)::int` })
      .from(realUsers)
      .where(eq(realUsers.classification, "new"));
    return result[0]?.count || 0;
  }

  async function countNewPages() {
    const { pages } = await import("../shared/schema");
    const result = await db
      .select({ count: sql`count(*)::int` })
      .from(pages)
      .where(eq(pages.classification, "new"));
    return result[0]?.count || 0;
  }

  async function countNewGroups() {
    const { groups } = await import("../shared/schema");
    const result = await db
      .select({ count: sql`count(*)::int` })
      .from(groups)
      .where(eq(groups.classification, "new"));
    return result[0]?.count || 0;
  }

  async function countPendingSupportRequests() {
    const { supportRequests } = await import("../shared/schema");
    const result = await db
      .select({ count: sql`count(*)::int` })
      .from(supportRequests)
      .where(eq(supportRequests.status, "pending"));
    return result[0]?.count || 0;
  }

  // Function to broadcast badge updates
  const broadcastBadgeUpdate = async () => {
    try {
      const { groups, supportRequests } = await import("../shared/schema");
      const { pages } = await import("../shared/schema");
      const { users } = await import("../shared/schema");
      const { realUsers } = await import("../shared/schema");

      const [realUsersNewCount, pagesNewCount, groupsNewCount] =
        await Promise.all([
          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(realUsers)
            .where(eq(realUsers.classification, "new")),

          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(pages)
            .where(eq(pages.classification, "new")),

          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(groups)
            .where(eq(groups.classification, "new")),
        ]);

      // Đếm support requests có status = 'pending'
      const pendingSupportRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(supportRequests)
        .where(eq(supportRequests.status, "pending"));

      const pendingSupport = pendingSupportRequests[0]?.count || 0;

      const badgeCounts = {
        realUsers: realUsersNewCount[0]?.count || 0,
        pages: pagesNewCount[0]?.count || 0,
        groups: groupsNewCount[0]?.count || 0,
        supportRequests: pendingSupport,
      };

      const filteredBadgeCounts = {
        realUsers:
          badgeCounts.realUsers > 0 ? badgeCounts.realUsers : undefined,
        pages: badgeCounts.pages > 0 ? badgeCounts.pages : undefined,
        groups: badgeCounts.groups > 0 ? badgeCounts.groups : undefined,
        supportRequests:
          badgeCounts.supportRequests > 0
            ? badgeCounts.supportRequests
            : undefined,
      };

      // Broadcast to all connected clients
      io.emit("badge-update", filteredBadgeCounts);
      console.log("Broadcasted badge update:", filteredBadgeCounts);
    } catch (error) {
      console.error("Error broadcasting badge update:", error);
    }
  };

  // Function to broadcast feedback badge updates
  const broadcastFeedbackBadgeUpdate = async () => {
    try {
      const { groups, supportRequests } = await import("../shared/schema");
      const { pages } = await import("../shared/schema");
      const { users } = await import("../shared/schema");
      const { realUsers } = await import("../shared/schema");

      // Clear any potential cache
      statsCache.clear();

      const [realUsersNewCount, pagesNewCount, groupsNewCount] =
        await Promise.all([
          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(realUsers)
            .where(eq(realUsers.classification, "new")),

          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(pages)
            .where(eq(pages.classification, "new")),

          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(groups)
            .where(eq(groups.classification, "new")),
        ]);

      // Đếm support requests có status = 'pending' và type = 'support' (hoặc không có type - backward compatibility)
      const pendingSupportRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.status, "pending"),
            or(
              eq(supportRequests.type, "support"),
              isNull(supportRequests.type),
            ),
          ),
        );

      // Đếm feedback requests có type = 'feedback' và status = 'pending'
      const pendingFeedbackRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.type, "feedback"),
            eq(supportRequests.status, "pending"),
          ),
        );

      // Đếm verification requests có type = 'verify' và status = 'pending' - với debug logging
      const pendingVerificationRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.type, "verify"),
            eq(supportRequests.status, "pending"),
          ),
        );

      console.log("Badge count debug - Verification requests:", {
        count: pendingVerificationRequests[0]?.count || 0,
        query: "type='verify' AND status='pending'"
      });

      // Đếm tick requests có type = 'tick' và status = 'pending'
      const pendingTickRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.type, "tick"),
            eq(supportRequests.status, "pending"),
          ),
        );

      console.log("Badge count debug - Tick requests:", {
        count: pendingTickRequests[0]?.count || 0,
        query: "type='tick' AND status='pending'"
      });

      // Đếm report requests có status = 'pending'
      const { reportManagement } = await import("../shared/schema");
      const pendingReportRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(reportManagement)
        .where(eq(reportManagement.status, "pending"));

      console.log("Badge count debug - Report requests:", {
        count: pendingReportRequests[0]?.count || 0,
        query: "status='pending'"
      });

      const pendingSupport = pendingSupportRequests[0]?.count || 0;
      const pendingFeedback = pendingFeedbackRequests[0]?.count || 0;
      const pendingVerification = pendingVerificationRequests[0]?.count || 0;
      const pendingTick = pendingTickRequests[0]?.count || 0;
      const pendingReports = pendingReportRequests[0]?.count || 0;

      // Tổng số pending requests (support + feedback + verification + tick) cho menu cha "Xử lý phản hồi"
      const totalPendingRequests = pendingSupport + pendingFeedback + pendingVerification + pendingTick;

      const badgeCounts = {
        realUsers: realUsersNewCount[0]?.count || 0,
        pages: pagesNewCount[0]?.count || 0,
        groups: groupsNewCount[0]?.count || 0,
        supportRequests: pendingSupport,
        feedbackRequests: pendingFeedback,
        verificationRequests: pendingVerification,
        tickRequests: pendingTick,
        reportRequests: pendingReports,
        totalRequests: totalPendingRequests, // Tổng cho menu cha
      };

      const filteredBadgeCounts = {
        realUsers:
          badgeCounts.realUsers > 0 ? badgeCounts.realUsers : undefined,
        pages: badgeCounts.pages > 0 ? badgeCounts.pages : undefined,
        groups: badgeCounts.groups > 0 ? badgeCounts.groups : undefined,
        supportRequests:
          badgeCounts.supportRequests > 0
            ? badgeCounts.supportRequests
            : undefined,
        feedbackRequests:
          badgeCounts.feedbackRequests > 0
            ? badgeCounts.feedbackRequests
            : undefined,
        verificationRequests:
          badgeCounts.verificationRequests > 0
            ? badgeCounts.verificationRequests
            : undefined,
        tickRequests:
          badgeCounts.tickRequests > 0
            ? badgeCounts.tickRequests
            : undefined,
        reportRequests:
          badgeCounts.reportRequests > 0
            ? badgeCounts.reportRequests
            : undefined,
        totalRequests:
          badgeCounts.totalRequests > 0 ? badgeCounts.totalRequests : undefined,
      };

      // Broadcast to all connected clients
      io.emit("badge-update", filteredBadgeCounts);
      console.log("Broadcasted feedback badge update:", filteredBadgeCounts);
    } catch (error) {
      console.error("Error broadcasting feedback badge update:", error);
    }
  };

  // Function to broadcast report badge updates
  const broadcastReportBadgeUpdate = async () => {
    try {
      const { reportManagement } = await import("../shared/schema");
      
      // Đếm report requests có status = 'pending'
      const pendingReportRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(reportManagement)
        .where(eq(reportManagement.status, "pending"));

      console.log("Report badge update - Report requests:", {
        count: pendingReportRequests[0]?.count || 0,
        query: "status='pending'"
      });

      const pendingReports = pendingReportRequests[0]?.count || 0;

      const badgeCounts = {
        reportRequests: pendingReports,
      };

      const filteredBadgeCounts = {
        reportRequests:
          badgeCounts.reportRequests > 0
            ? badgeCounts.reportRequests
            : undefined,
      };

      // Broadcast to all connected clients
      io.emit("badge-update", filteredBadgeCounts);
      console.log("Broadcasted report badge update:", filteredBadgeCounts);
    } catch (error) {
      console.error("Error broadcasting report badge update:", error);
    }
  };

  // Make broadcastBadgeUpdate available globally
  (global as any).broadcastBadgeUpdate = broadcastBadgeUpdate;
  (global as any).broadcastFeedbackBadgeUpdate = broadcastFeedbackBadgeUpdate;
  (global as any).broadcastReportBadgeUpdate = broadcastReportBadgeUpdate;

  // Start automatic file cleanup service
  const fileCleanupService = FileCleanupService.getInstance();
  fileCleanupService.startAutoCleanup();

  // Set up authentication routes
  setupAuth(app);

  // Check if user is authenticated middleware with extended debug
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    // Debug info to check session
    console.log(`Session check for ${req.path}:`, {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      isAuthenticated: req.isAuthenticated(),
      user: req.isAuthenticated()
        ? {
            id: (req.user as Express.User)?.id,
            username: (req.user as Express.User)?.username,
            role: (req.user as Express.User)?.role,
          }
        : "Not authenticated",
    });

    // Ghi log chi tiết thông tin session
    console.log("Session details:", {
      session: req.session ? "Session exists" : "No session",
      cookie: req.session?.cookie,
      passport: req.session ? (req.session as any).passport : null,
      headers: {
        cookie: req.headers.cookie,
        referer: req.headers.referer,
        origin: req.headers.origin,
      },
      method: req.method,
    });

    if (req.isAuthenticated()) {
      return next();
    }

    // Kiểm tra đặc biệt cho trường hợp cookie bị mất
    if (!req.headers.cookie || !req.headers.cookie.includes("connect.sid")) {
      console.log("Missing session cookie in request!");
    }

    // Từ chối truy cập nếu không được xác thực
    res.status(401).json({ message: "Unauthorized" });
  };

  // Content routes
  const contentRouter = (await import("./routes/content.router")).default;
  app.use("/api/contents", contentRouter);

  app.get("/api/my-contents", isAuthenticated, async (req, res) => {
    try {
      // Log thông tin để debug
      console.log(
        "User ID requesting contents:",
        (req.user as Express.User).id,
      );
      console.log("User role:", (req.user as Express.User).role);

      const contents = await storage.getContentsByAssignee(
        (req.user as Express.User).id,
      );

      // Thêm log để kiểm tra số lượng và trạng thái nội dung đang trả về
      console.log("Total contents returned:", contents.length);
      console.log(
        "Contents with 'processing' status:",
        contents.filter((c) => c.status === "processing").length,
      );
      console.log(
        "Contents with 'unverified' source:",
        contents.filter((c) => c.sourceVerification === "unverified").length,
      );
      console.log(
        "Contents with BOTH 'processing' AND 'unverified':",
        contents.filter(
          (c) =>
            c.status === "processing" && c.sourceVerification === "unverified",
        ).length,
      );

      // Kiểm tra và in thông tin nội dung đầu tiên để debug
      if (contents.length > 0) {
        console.log("First content example:", {
          id: contents[0].id,
          status: contents[0].status,
          verification: contents[0].sourceVerification,
        });
      }

      res.json(contents);
    } catch (error) {
      console.error("Error fetching contents:", error);
      res
        .status(500)
        .json({ message: "Error fetching your assigned contents" });
    }
  });

  // Cache for stats API
  let statsCache = new Map();
  const CACHE_DURATION = 300000; // 5 minutes cache (increased from 30 seconds)

  // Dashboard statistics
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as Express.User;
      const { startDate, endDate } = req.query;

      // Create cache key
      const cacheKey = `stats-${user.id}-${user.role}-${startDate || "all"}-${endDate || "all"}`;
      const cached = statsCache.get(cacheKey);

      // Return cached result if still valid
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log("Returning cached stats");
        return res.json(cached.data);
      }

      console.log("Getting stats with params:", req.query);

      // Sử dụng aggregation query thay vì fetch toàn bộ dữ liệu
      const { contents } = await import("../shared/schema");

      // Build date conditions
      const dateConditions = [];
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);

        dateConditions.push(
          or(
            and(gte(contents.createdAt, start), lte(contents.createdAt, end)),
            and(gte(contents.updatedAt, start), lte(contents.updatedAt, end)),
          ),
        );
      }

      // User filter condition
      const userConditions =
        user.role === "admin" ? [] : [eq(contents.assigned_to_id, user.id)];

      const whereClause = [...dateConditions, ...userConditions];
      const finalWhere =
        whereClause.length > 0 ? and(...whereClause) : undefined;

      // Sử dụng một query duy nhất để lấy tất cả stats
      const statsQuery = await db
        .select({
          totalContent: sql<number>`count(*)`,
          pending: sql<number>`count(*) filter (where status = 'pending')`,
          completed: sql<number>`count(*) filter (where status = 'completed')`,
          verified: sql<number>`count(*) filter (where "source_verification" = 'verified')`,
          unverified: sql<number>`count(*) filter (where "source_verification" = 'unverified')`,
          safe: sql<number>`count(*) filter (where safe = true)`,
          unsafe: sql<number>`count(*) filter (where safe = false)`,
          unchecked: sql<number>`count(*) filter (where safe is null)`,
          assigned: sql<number>`count(*) filter (where assigned_to_id is not null)`,
          unassigned: sql<number>`count(*) filter (where assigned_to_id is null)`,
        })
        .from(contents)
        .where(finalWhere);

      const contentStats = statsQuery[0];

      // Lấy assignment per user chỉ khi cần thiết (admin)
      let assignedPerUser = [];
      if (user.role === "admin") {
        const assignmentQuery = await db
          .select({
            userId: contents.assigned_to_id,
            username: users.username,
            name: users.name,
            count: sql<number>`count(*)`,
          })
          .from(contents)
          .innerJoin(users, eq(contents.assigned_to_id, users.id))
          .where(
            and(
              eq(users.status, "active"),
              eq(users.role, "editor"),
              finalWhere,
            ),
          )
          .groupBy(contents.assigned_to_id, users.username, users.name)
          .orderBy(desc(sql`count(*)`));

        assignedPerUser = assignmentQuery.map((row) => ({
          userId: row.userId,
          username: row.username,
          name: row.name,
          count: Number(row.count),
        }));
      }

      // Tối ưu queries cho real users, pages và groups
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Real users stats với aggregation
      const { pages, groups } = await import("../shared/schema");

      // Build date filter conditions for each table
      let realUsersDateFilter = undefined;
      let pagesDateFilter = undefined;
      let groupsDateFilter = undefined;
      let supportRequestsDateFilter = undefined;

      if (startDate && endDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);

        realUsersDateFilter = and(
          gte(realUsers.createdAt, start),
          lte(realUsers.createdAt, end)
        );

        pagesDateFilter = and(
          gte(pages.createdAt, start),
          lte(pages.createdAt, end)
        );

        groupsDateFilter = and(
          gte(groups.createdAt, start),
          lte(groups.createdAt, end)
        );

        supportRequestsDateFilter = and(
          gte(supportRequests.created_at, start),
          lte(supportRequests.created_at, end)
        );
      }

      const [
        realUsersStats,
        pagesStats,
        groupsStats,
        supportRequestsStats,
        feedbackRequestsStats,
      ] = await Promise.all([
        // Real users aggregation with date filter
        db
          .select({
            total: sql<number>`count(distinct ${realUsers.id})`,
            new: sql<number>`count(distinct ${realUsers.id}) filter (where ${realUsers.createdAt} >= ${sevenDaysAgo})`,
          })
          .from(realUsers)
          .where(realUsersDateFilter),

        // Pages aggregation with date filter
        db
          .select({
            total: sql<number>`count(*)`,
            new: sql<number>`count(*) filter (where ${pages.createdAt} >= ${sevenDaysAgo})`,
          })
          .from(pages)
          .where(pagesDateFilter),

        // Groups aggregation with date filter
        db
          .select({
            total: sql<number>`count(*)`,
            new: sql<number>`count(*) filter (where ${groups.createdAt} >= ${sevenDaysAgo})`,
          })
          .from(groups)
          .where(groupsDateFilter),

        // Support requests aggregation with date filter (only type = 'support' or null for backward compatibility)
        db
          .select({
            total: sql<number>`count(*) filter (where type = 'support' OR type IS NULL)`,
            pending: sql<number>`count(*) filter (where (type = 'support' OR type IS NULL) AND status = 'pending')`,
            processing: sql<number>`count(*) filter (where (type = 'support' OR type IS NULL) AND status = 'processing')`,
            completed: sql<number>`count(*) filter (where (type = 'support' OR type IS NULL) AND status = 'completed')`,
          })
          .from(supportRequests)
          .where(supportRequestsDateFilter),

        // Feedback requests aggregation with date filter (only type = 'feedback')
        db
          .select({
            total: sql<number>`count(*) filter (where type = 'feedback')`,
            pending: sql<number>`count(*) filter (where type = 'feedback' AND status = 'pending')`,
            processing: sql<number>`count(*) filter (where type = 'feedback' AND status = 'processing')`,
            completed: sql<number>`count(*) filter (where type = 'feedback' AND status = 'completed')`,
          })
          .from(supportRequests)
          .where(supportRequestsDateFilter),
      ]);

      const totalRealUsers = Number(realUsersStats[0]?.total || 0);
      const newRealUsers = Number(realUsersStats[0]?.new || 0);
      const totalPages = Number(pagesStats[0]?.total || 0);
      const newPages = Number(pagesStats[0]?.new || 0);
      const totalGroups = Number(groupsStats[0]?.total || 0);
      const newGroups = Number(groupsStats[0]?.new || 0);
      const totalSupportRequests = Number(supportRequestsStats[0]?.total || 0);
      const pendingSupportRequests = Number(
        supportRequestsStats[0]?.pending || 0,
      );
      const processingSupportRequests = Number(
        supportRequestsStats[0]?.processing || 0,
      );
      const completedSupportRequests = Number(
        supportRequestsStats[0]?.completed || 0,
      );
      const totalFeedbackRequests = Number(
        feedbackRequestsStats[0]?.total || 0,
      );
      const pendingFeedbackRequests = Number(
        feedbackRequestsStats[0]?.pending || 0,
      );
      const processingFeedbackRequests = Number(
        feedbackRequestsStats[0]?.processing || 0,
      );
      const completedFeedbackRequests = Number(
        feedbackRequestsStats[0]?.completed || 0,
      );

      console.log("Optimized stats:", {
        realUsers: { total: totalRealUsers, new: newRealUsers },
        pages: { total: totalPages, new: newPages },
        groups: { total: totalGroups, new: newGroups },
        supportRequests: {
          total: totalSupportRequests,
          pending: pendingSupportRequests,
          processing: processingSupportRequests,
          completed: completedSupportRequests,
        },
        feedbackRequests: {
          total: totalFeedbackRequests,
          pending: pendingFeedbackRequests,
          processing: processingFeedbackRequests,
          completed: completedFeedbackRequests,
        },
      });

      const result = {
        totalContent: Number(contentStats.totalContent),
        pending: Number(contentStats.pending),
        completed: Number(contentStats.completed),
        // Thông tin trạng thái xác minh nguồn
        verified: Number(contentStats.verified),
        unverified: Number(contentStats.unverified),
        // Thông tin trạng thái an toàn
        safe: Number(contentStats.safe),
        unsafe: Number(contentStats.unsafe),
        unchecked: Number(contentStats.unchecked),
        // Số lượng bài viết đã được phân công
        assigned: Number(contentStats.assigned),
        // Số lượng bài viết chưa được phân công
        unassigned: Number(contentStats.unassigned),
        // Thêm thông tin số lượng nội dung trên mỗi người dùng (chỉ admin mới thấy)
        assignedPerUser,
        // Thống kê người dùng thật
        totalRealUsers,
        newRealUsers,
        totalPages,
        newPages,
        totalGroups,
        newGroups,
        // Thống kê yêu cầu hỗ trợ
        totalSupportRequests,
        pendingSupportRequests,
        processingSupportRequests,
        completedSupportRequests,
        // Thống kê feedback requests
        totalFeedbackRequests,
        pendingFeedbackRequests,
        processingFeedbackRequests,
        completedFeedbackRequests,
        // Thông tin khoảng thời gian nếu có lọc
        period:
          startDate && endDate
            ? {
                start: startDate,
                end: endDate,
              }
            : null,
      };

      // Cache the result
      statsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
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
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // User management routes (admin only)
  // Check if user is admin middleware
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated() && (req.user as Express.User).role === "admin") {
      return next();
    }
    res.status(403).json({ message: "Admin access required" });
  };

  // Get all users (admin only)
  app.get("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    console.log('GET /api/users - Auth check:', {
      isAuthenticated: req.isAuthenticated(),
      user: req.isAuthenticated() ? { 
        id: (req.user as Express.User)?.id,
        username: (req.user as Express.User)?.username,
        role: (req.user as Express.User)?.role
      } : 'Not authenticated'
    });

    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        password: users.password,
        name: users.name,
        email: users.email,
        department: users.department,
        position: users.position,
        role: users.role,
        status: users.status,
        avatarUrl: users.avatarUrl,
        can_send_email: users.can_send_email,
        createdAt: users.createdAt
      }).from(users).orderBy(users.id);

      console.log('Fetched users with email permission:', allUsers.map(u => ({ 
        id: u.id, 
        username: u.username, 
        can_send_email: u.can_send_email,
        can_send_email_type: typeof u.can_send_email
      })));
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Error fetching users' });
    }
  });

  // Update user email permission
  app.put("/api/users/:id/email-permission", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { can_send_email } = req.body;

      console.log('Updating email permission for user:', userId, 'value:', can_send_email);
      console.log('Request body:', req.body);

      // Validate input
      if (typeof can_send_email !== 'boolean') {
        console.log('Invalid can_send_email value:', can_send_email, 'type:', typeof can_send_email);
        return res.status(400).json({ message: 'can_send_email must be a boolean' });
      }

      // Check if user exists first
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (existingUser.length === 0) {
        console.log('User not found:', userId);
        return res.status(404).json({ message: 'User not found' });
      }

      console.log('User found:', existingUser[0].username, 'current can_send_email:', existingUser[0].can_send_email);

      // Update the user
      const result = await db
        .update(users)
        .set({ 
          can_send_email: can_send_email,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      console.log('Update result:', result);

      if (result.length === 0) {
        return res.status(404).json({ message: 'User not found after update' });
      }

      res.json({ 
        message: 'Email permission updated successfully',
        user: {
          id: result[0].id,
          username: result[0].username,
          can_send_email: result[0].can_send_email
        }
      });
    } catch (error) {
      console.error('Error updating email permission:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
      res.status(500).json({ 
        message: 'Error updating email permission',
        error: error.message
      });
    }
  });

  // Update user
  app.put("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { username, name, role, status, can_send_email, password } = req.body;

      const updateData: any = {
        username,
        name,
        role,
        status,
        can_send_email,
        updatedAt: new Date()
      };

      // Only update password if provided
      if (password && password.trim()) {
        const bcrypt = require('bcrypt');
        updateData.password = await bcrypt.hash(password, 10);
      }

      await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user' });
    }
  });

  // Update user status (admin only)
  app.patch("/api/users/:id/status", isAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const { status } = req.body;

      if (!status || !["active", "pending", "blocked"].includes(status)) {
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
          message: "Cannot delete the main administrator account",
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
          details: `Deleted user ${user.username} (ID: ${userId}) and reassigned their content`,
        },
      });

      // Thực hiện xóa user
      const deleted = await storage.deleteUser(userId);

      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete user" });
      }

      res.json({
        message: "User deleted successfully",
        success: true,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error deleting user",
        error: error instanceof Error ? error.message : String(error),
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
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword,
      });

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
      if (role && !["admin", "editor", "viewer"].includes(role)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid role value" });
      }

      // Build update object with only the fields that are provided
      const updateData: Record<string, string> = {};
      if (department) updateData.department = department;
      if (position) updateData.position = position;
      if (role) updateData.role = role;

      if (Object.keys(updateData).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No valid fields to update" });
      }

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Remove password from response
      const { password, ...safeUser } = updatedUser;
      return res.json({ success: true, data: safeUser });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Error updating user details" });
    }
  });

  app.get('/api/auth/check', async (req, res) => {
    console.log('Auth check request:', {
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      user: req.user ? {
        id: (req.user as Express.User).id,
        username: (req.user as Express.User).username,
        role: (req.user as Express.User).role
      } : null
    });

    if (req.isAuthenticated()) {
      try {
        // Get full user data including email permission
        const userData = await db.select()
          .from(users)
          .where(eq(users.id, (req.user as Express.User).id))
          .limit(1);

        if (userData.length > 0) {
          const user = userData[0];
          console.log('Auth check - user data from DB:', {
            id: user.id,
            username: user.username,
            role: user.role,
            can_send_email: user.can_send_email
          });

          // Set can_send_email to true for admin role if it's null/undefined
          const canSendEmail = user.can_send_email !== null && user.can_send_email !== undefined 
            ? user.can_send_email 
            : (user.role === 'admin' ? true : false);

          res.json({ 
            user: {
              id: user.id,
              username: user.username,
              name: user.name,
              role: user.role,
              can_send_email: canSendEmail
            }
          });
        } else {
          res.status(401).json({ message: 'User not found' });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Error fetching user data' });
      }
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // Serve uploaded files as static assets
  app.use("/uploads", express.static(uploadDir));

  // Serve robots.txt từ public directory
  app.get("/robots.txt", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "robots.txt"));
  });

  // Upload user avatar (authenticated user)
  app.post(
    "/api/user/avatar/upload",
    isAuthenticated,
    upload.single("avatar"),
    async (req, res) => {
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
          res
            .status(400)
            .json({ message: error.message || "Error uploading avatar" });
        } else {
          res.status(500).json({ message: "Error uploading avatar" });
        }
      }
    },
  );

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
        return res
          .status(400)
          .json({ message: "Current password and new password are required" });
      }

      // Validate password length
      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "New password must be at least 6 characters long" });
      }

      // Get current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isPasswordCorrect = await comparePasswords(
        currentPassword,
        user.password,
      );
      if (!isPasswordCorrect) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword,
      });

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
      const { externalId, categories, labels, safe, sourceVerification } =
        req.body;

      if (!externalId) {
        return res.status(400).json({ message: "External ID is required" });
      }

      // Here you would normally send this to your Gorse service using Kafka
      // For now, we'll simulate a successful response
      log(`Sending update to Gorse service for item ${externalId}`, "kafka");
      log(
        `Data: categories=${categories}, labels=${labels}, safe=${safe}, sourceVerification=${sourceVerification || "unverified"}`,
        "kafka",
      );

      res.json({
        success: true,
        message: "Successfully sent content update to Gorse service",
        data: { externalId, categories, labels, safe, sourceVerification },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error sending content update to Gorse service",
        error: error instanceof Error ? error.message : String(error),
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
        data: message,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error simulating Kafka message",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Endpoint tạm thời để cập nhật trạng thái tất cả nội dung dựa trên Categories - Không yêu cầu xác thực
  app.post("/api/public/update-statuses", async (req, res) => {
    try {
      const count = await storage.updateAllContentStatuses();
      res.json({
        success: true,
        message: "Updated content statuses successfully",
        updatedCount: count,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating content status",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Endpoint không cần xác thực để tạo nhiều nội dung (chỉ cho môi tr ờng phát triển)
  app.post("/api/kafka/dev-simulate", async (req, res) => {
    try {
      const { count = 5 } = req.body;

      // Giới hạn số lượng tin nhắn từ 1 đến 50
      const messageCount = Math.min(Math.max(1, Number(count)), 50);

      log(
        `Development mode: Simulating ${messageCount} Kafka messages without authentication`,
        "kafka-simulator",
      );

      const messages = await simulateMultipleMessages(messageCount);

      res.json({
        success: true,
        message: `${messages.length} Kafka messages simulated successfully`,
        data: messages,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error simulating Kafka messages",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Simulate a single kafka message (admin only)
  app.post("/api/kafka/simulate", isAdmin, async (req, res) => {
    try {
      const { externalId, categories, labels, safe, sourceVerification } =
        req.body;

      if (!externalId) {
        return res.status(400).json({
          success: false,
          message: "Item ID is required",
        });
      }

      // Simulate sending content update to your Gorse service using Kafka
      log(`Sending update to Gorse service for item ${externalId}`, "kafka");
      log(
        `Data: categories=${categories}, labels=${labels}, safe=${safe}, sourceVerification=${sourceVerification || "unverified"}`,
        "kafka",
      );

      // Simulate Kafka message
      await simulateKafkaMessage(externalId);

      res.json({
        success: true,
        message: "Kafka message simulated successfully",
        data: { externalId, categories, labels, safe, sourceVerification },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error simulating Kafka message",
        error: error instanceof Error ? error.message : String(error),
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
        data: messages,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error simulating Kafka messages",
        error: error instanceof Error ? error.message : String(error),
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
      simulateMassMessages(messageCount)
        .then((messages) => {
          console.log(
            `Completed processing ${messages.length} messages in mass simulation`,
          );
        })
        .catch((err) => {
          console.error("Error in mass simulation:", err);
        });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error starting mass Kafka message simulation",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get assignable users (active editors) (admin only)
  app.get("/api/users/assignable", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Filter for active editors only
      const assignableUsers = users
        .filter((user) => user.role === "editor" && user.status === "active")
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
        .filter((user) => user.role === "editor" && user.status === "active")
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

      const content = await storage.assignContentToUser(
        contentId,
        Number(userId),
      );

      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      res.json({
        success: true,
        message: "Content assigned successfully",
        data: content,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error assigning content to user",
        error: error instanceof Error ? error.message : String(error),
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
        return res
          .status(400)
          .json({ message: "Processing result is required" });
      }

      // Get the content
      const content = await storage.getContent(contentId);

      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Check if content is assigned to the current user or if user is admin
      if (content.assigned_to_id !== user.id && user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "You can only complete content assigned to you" });
      } // Complete processing
      const completedContent = await storage.completeProcessing(
        contentId,
        result,
        user.id,
      );

      res.json({
        success: true,
        message: "Content processing completed successfully",
        data: completedContent,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error completing content processing",
        error: error instanceof Error ? error.message : String(error),
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
      const updated = await storage.updateContent(contentId, {
        comments: newCount,
      });

      if (!updated) {
        return res.status(404).json({ message: "Content update failed" });
      }

      res.json({
        success: true,
        message: "Comments count updated successfully",
        data: updated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating comments count",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // API để gửi comment đến API bên ngoài
  app.post(
    "/api/contents/:externalId/send-comment",
    isAuthenticated,
    async (req, res) => {
      try {
        const { externalId } = req.params;
        const { fakeUserId, comment } = req.body;

        if (!externalId) {
          return res
            .status(400)
            .json({ success: false, message: "External ID is required" });
        }

        if (!fakeUserId) {
          return res
            .status(400)
            .json({ success: false, message: "Fake user ID is required" });
        }

        if (!comment) {
          return res
            .status(400)
            .json({ success: false, message: "Comment content is required" });
        }

        // Lấy thông tin fake user
        const fakeUser = await storage.getFakeUser(Number(fakeUserId));
        if (!fakeUser) {
          return res
            .status(404)
            .json({ success: false, message: "Fake user not found" });
        }

        // Kiểm tra token của fake user
        if (!fakeUser.token) {
          return res.status(400).json({
            success: false,
            message: "Fake user does not have a valid token",
          });
        }

        // Tìm nội dung từ external ID
        const contents = await storage.getAllContents();
        const content = contents.find((c) => c.externalId === externalId);

        if (!content) {
          return res.status(404).json({
            success: false,
            message: "Content with this external ID not found",
          });
        }

        try {
          // Gửi comment đến API bên ngoài
          const response = await fetch(
            `https://prod-sn.emso.vn/api/v1/statuses/${externalId}/comments`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${fakeUser.token}`,
              },
              body: JSON.stringify({
                status: comment,
              }),
            },
          );

          // Kiểm tra kết quả từ API
          console.log(`[${externalId}] API Response Status: ${response.status}`);

          if (response.ok) {
            const apiResponse = await response.json();
            console.log(`[${externalId}] ✅ External API SUCCESS:`, {
              fakeUserId,
              comment: comment.substring(0, 50) + '...',
              apiResponse
            });

            // Tăng số lượng comment trong database
            const currentCount = content.comments || 0;
            const updated = await storage.updateContent(content.id, {
              comments: currentCount + 1,
            });

            console.log(`[${externalId}] Database updated: comments ${currentCount} -> ${currentCount + 1}`);

            return res.json({
              success: true,
              message: "Comment sent successfully",
              data: {
                externalId,
                contentId: content.id,
                fakeUserId,
                comment,
                apiResponse,
                timestamp: new Date().toISOString(),
              },
            });
          } else {
            const errorData = await response.json();
            console.error(`[${externalId}] ❌ External API FAILED:`, {
              status: response.status,
              fakeUserId,
              comment: comment.substring(0, 50) + '...',
              errorData
            });

            return res.status(response.status).json({
              success: false,
              message: "Failed to send comment to external API",
              error: errorData,
            });
          }
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: "Error sending comment to external API",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error processing request",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // API để tăng số lượng reactions
  app.patch(
    "/api/contents/:id/reactions",
    isAuthenticated,
    async (req, res) => {
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
        const updated = await storage.updateContent(contentId, {
          reactions: newCount,
        });

        if (!updated) {
          return res.status(404).json({ message: "Content update failed" });
        }

        res.json({
          success: true,
          message: "Reactions count updated successfully",
          data: updated,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Error updating reactions count",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // ===== Categories and Labels API =====

  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const allCategories = await storage.getAllCategories();
      res.json(allCategories);
    } catch (error) {
      res.status(500).json({
        message: "Error fetching categories",
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
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
          errors: error.errors,
        });
      }
      res.status(500).json({
        message: "Error creating category",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update category (admin only)
  app.put("/api/categories/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const categoryId = Number(req.params.id);
      const existingCategory = await storage.getCategory(categoryId);

      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      const validatedData = insertCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateCategory(
        categoryId,
        validatedData,
      );

      res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating category:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      res.status(500).json({
        message: "Error updating category",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Delete category (admin only)
  app.delete("/api/categories/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const categoryId = Number(req.params.id);
      console.log(`Attempting to delete category ${categoryId}`);
      
      const existingCategory = await storage.getCategory(categoryId);

      if (!existingCategory) {
        console.log(`Category ${categoryId} not found`);
        return res.status(404).json({ message: "Category not found" });
      }

      console.log(`Found category: ${existingCategory.name}`);
      const deleted = await storage.deleteCategory(categoryId);

      if (deleted) {
        console.log(`Successfully deleted category ${categoryId}`);
        res.status(204).send();
      } else {
        console.log(`Failed to delete category ${categoryId}`);
        res.status(500).json({ message: "Error deleting category" });
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({
        message: "Error deleting category",
        error: error instanceof Error ? error.message : String(error),
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
      const search = (req.query.search as string) || "";

      console.log("Parsed parameters:", { page, pageSize, search });

      // Nếu không có phân trang (để compatibility với comment functionality)
      if (!req.query.page && !req.query.pageSize) {
        console.log("No pagination params - returning all fake users");
        const fakeUsers = await storage.getAllFakeUsers();
        return res.json(fakeUsers);
      }

      console.log("Using pagination - calling getFakeUsersWithPagination");
      const result = await storage.getFakeUsersWithPagination(
        page,
        pageSize,
        search,
      );
      console.log("Pagination result:", {
        total: result.total,
        usersCount: result.users.length,
        page: result.page,
        totalPages: result.totalPages,
      });

      // Set cache control headers to prevent caching issues
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      res.json(result);
    } catch (error) {
      console.error("Error in fake users API:", error);
      res.status(500).json({
        message: "Error fetching fake users",
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Real user name update route
  app.put(
    "/api/real-users/:id/name",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || name.trim() === "") {
          return res.status(400).json({
            message: "Name is required",
          });
        }

        const user = await db
          .select()
          .from(realUsers)
          .where(eq(realUsers.id, parseInt(id)))
          .limit(1);

        if (user.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        const currentFullName = user[0].fullName 
          ? (typeof user[0].fullName === 'string' ? JSON.parse(user[0].fullName) : user[0].fullName)
          : { id: user[0].id.toString(), name: '' };

        const updatedFullName = {
          ...currentFullName,
          name: name.trim()
        };

        const result = await db
          .update(realUsers)
          .set({
            fullName: updatedFullName,
            updatedAt: new Date(),
          })
          .where(eq(realUsers.id, parseInt(id)))
          .returning();

        res.json({ message: "User name updated successfully", user: result[0] });
      } catch (error) {
        console.error("Error updating user name:", error);
        res.status(500).json({
          message: "Error updating user name",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Real user assignment route
  app.put(
    "/api/real-users/:id/assign",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { assignedToId } = req.body;

        const result = await db
          .update(realUsers)
          .set({
            assignedToId: assignedToId || null,
            updatedAt: new Date(),
          })
          .where(eq(realUsers.id, parseInt(id)))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User assignment updated successfully", user: result[0] });
      } catch (error) {
        console.error("Error updating user assignment:", error);
        res.status(500).json({
          message: "Error updating user assignment",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Real user verification status route
  app.put(
    "/api/real-users/:id/verification",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { verified } = req.body;

        if (!["verified", "unverified"].includes(verified)) {
          return res.status(400).json({
            message: "Invalid verification status",
            validValues: ["verified", "unverified"],
          });
        }

        const result = await db
          .update(realUsers)
          .set({
            verified,
            updatedAt: new Date(),
          })
          .where(eq(realUsers.id, parseInt(id)))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User verification status updated successfully", user: result[0] });
      } catch (error) {
        console.error("Error updating verification status:", error);
        res.status(500).json({
          message: "Error updating verification status",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Real user classification route
  app.put(
    "/api/real-users/:id/classification",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { classification } = req.body;

        // Validate classification value
        if (!["new", "potential", "non_potential", "positive"].includes(classification)) {
          return res.status(400).json({
            message: "Invalid classification value",
            validValues: ["new", "potential", "non_potential", "positive"],
          });
        }

        const result = await db
          .update(realUsers)
          .set({
            classification,
            updatedAt: new Date(),
          })
          .where(eq(realUsers.id, parseInt(id)))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({
          message: "Classification updated successfully",
          user: result[0],
        });

        // Update source_classification in contents table for this real user
        try {
          const { contents } = await import("../shared/schema");
          
          // Get the user ID from fullName JSON
          const userIdFromFullName = result[0].fullName ? 
            (typeof result[0].fullName === 'string' ? 
              JSON.parse(result[0].fullName).id : 
              result[0].fullName.id) : 
            result[0].id.toString();
          
          console.log(`Updating source_classification for user ID: ${userIdFromFullName} to ${classification}`);
          
          const updateResult = await db
            .update(contents)
            .set({ source_classification: classification })
            .where(
              and(
                sql`LOWER(source::json->>'type') = 'account'`,
                sql`source::json->>'id' = ${userIdFromFullName}`
              )
            )
            .returning({ id: contents.id });
          
          console.log(`Updated ${updateResult.length} contents with source_classification: ${classification} for real user ID: ${userIdFromFullName}`);
        } catch (error) {
          console.error("Error updating source_classification for real user:", error);
        }

        // Broadcast badge update to all clients
        if ((global as any).broadcastBadgeUpdate) {
          (global as any).broadcastBadgeUpdate();
        }
      } catch (error) {
        console.error("Error updating classification:", error);
        res.status(500).json({
          message: "Error updating classification",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Send email to real user
  app.post(
    "/api/real-users/:id/send-email",
    isAuthenticated,
    upload.array("attachments", 10),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { to, subject, content, plain_content } = req.body;
        const user = req.user as Express.User;
        const attachments = (req.files as Express.Multer.File[]) || [];

        // Get real user
        const realUser = await db.query.realUsers.findFirst({
          where: eq(realUsers.id, parseInt(id)),
        });

        if (!realUser) {
          return res.status(404).json({ message: "Real user not found" });
        }

        // Process attachments for email
        const emailAttachments = attachments.map((file) => ({
          filename: file.originalname,
          path: file.path,
          contentType: file.mimetype,
        }));

        // Send email with attachments
        const emailSent = await emailService.sendDirectEmail({
          to,
          subject,
          content,
          attachments: emailAttachments,
          userInfo: {
            id: realUser.id,
            name: realUser.fullName
              ? (typeof realUser.fullName === "object"
                  ? realUser.fullName
                  : JSON.parse(realUser.fullName as string)
                )?.name || "Unknown"
              : "Unknown",
            email: realUser.email,
          },
        });

        if (emailSent) {
          // Clean up uploaded files after successful email send
          attachments.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
            } catch (error) {
              console.error(`Error deleting file ${file.path}:`, error);
            }
          });

          res.json({
            success: true,
            message: "Email sent successfully",
            recipient: {
              name: realUser.fullName
                ? (typeof realUser.fullName === "object"
                    ? realUser.fullName
                    : JSON.parse(realUser.fullName as string)
                  )?.name || "Unknown"
                : "Unknown",
              email: realUser.email,
            },
          });
        } else {
          // Clean up uploaded files if email send failed
          attachments.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
            } catch (error) {
              console.error(`Error deleting file ${file.path}:`, error);
            }
          });

          res.status(500).json({
            message: "Failed to send email. Please check SMTP configuration.",
          });
        }
      } catch (error) {
        console.error("Error sending email to real user:", error);
        res.status(500).json({
          message: "Error sending email",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Create fake user (admin only)
  app.post("/api/fake-users", isAdmin, async (req, res) => {
    try {
      // Validate with insertFakeUserSchema
      const validatedData = insertFakeUserSchema.parse({
        ...req.body,
        status: req.body.status || "active", // Default status is active
      });

      // Kiểm tra xem token đã tồn tại chưa
      const existingFakeUser = await storage.getFakeUserByToken(
        validatedData.token,
      );
      if (existingFakeUser) {
        return res.status(400).json({
          message: "Token đã tồn tại",
          error: "Token này đã được sử dụng bởi một người dùng ảo khác",
        });
      }

      const newFakeUser = await storage.createFakeUser(validatedData);
      res.status(201).json(newFakeUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      res.status(500).json({
        message: "Error creating fake user",
        error: error instanceof Error ? error.message : String(error),
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
          error: "Cần cung cấp danh sách người dùng ảo",
        });
      }

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const userData of users) {
        try {
          // Prepare data for validation
          const dataToValidate: any = {
            name: userData.name,
            token: userData.token,
            status: "active",
          };

          // Add email if provided
          if (userData.email && userData.email.trim()) {
            dataToValidate.email = userData.email.trim();
          }

          // Add password if provided
          if (userData.password && userData.password.trim()) {
            dataToValidate.password = userData.password.trim();
          }

          // Validate data
          const validatedData = insertFakeUserSchema.parse(dataToValidate);

          // Kiểm tra token đã tồn tại chưa
          const existingFakeUser = await storage.getFakeUserByToken(
            validatedData.token,
          );

          if (existingFakeUser) {
            // Nếu user đã tồn tại, kiểm tra xem có thông tin mới để cập nhật không
            const updateData: any = {};
            let hasNewData = false;

            // Kiểm tra email mới
            if (validatedData.email && (!existingFakeUser.email || existingFakeUser.email !== validatedData.email)) {
              updateData.email = validatedData.email;
              hasNewData = true;
            }

            // Kiểm tra password mới
            if (validatedData.password && (!existingFakeUser.password || existingFakeUser.password !== validatedData.password)) {
              updateData.password = validatedData.password;
              hasNewData = true;
            }

            // Kiểm tra name mới (trường hợp name khác)
            if (validatedData.name && existingFakeUser.name !== validatedData.name) {
              updateData.name = validatedData.name;
              hasNewData = true;
            }

            if (hasNewData) {
              // Cập nhật thông tin mới
              await storage.updateFakeUser(existingFakeUser.id, updateData);
              successCount++;
              console.log(`✅ Updated existing fake user: ${validatedData.name} (token: ${validatedData.token}) with new data:`, updateData);
            } else {
              // Không có thông tin mới để cập nhật
              errors.push(`Token "${validatedData.token}" đã tồn tại và không có thông tin mới để cập nhật`);
              failedCount++;
            }
            continue;
          }

          // Tạo người dùng ảo mới
          await storage.createFakeUser(validatedData);
          successCount++;

          console.log(`✅ Created fake user: ${validatedData.name} with email: ${validatedData.email || 'N/A'}`);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errors.push(`Lỗi với "${userData.name}": ${errorMsg}`);
          failedCount++;
          console.error(`❌ Failed to create fake user ${userData.name}:`, errorMsg);
        }
      }

      console.log(`Bulk upload completed: ${successCount} success, ${failedCount} failed`);

      res.json({
        success: successCount,
        failed: failedCount,
        errors: errors,
      });
    } catch (error) {
      console.error("Error in bulk upload:", error);
      res.status(500).json({
        message: "Error bulk uploading fake users",
        error: error instanceof Error ? error.message : String(error),
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
      if (
        validatedData.token &&
        validatedData.token !== existingFakeUser.token
      ) {
        const duplicateUser = await storage.getFakeUserByToken(
          validatedData.token,
        );
        if (duplicateUser && duplicateUser.id !== fakeUserId) {
          return res.status(400).json({
            message: "Token đã tồn tại",
            error: "Token này đã được sử dụng bởi một người dùng ảo khác",
          });
        }
      }

      const updatedFakeUser = await storage.updateFakeUser(
        fakeUserId,
        validatedData,
      );
      res.json(updatedFakeUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      res.status(500).json({
        message: "Error updating fake user",
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Email Templates API endpoints
  // Get all email templates
  app.get("/api/email-templates", isAuthenticated, async (req, res) => {
    try {
      const { emailTemplates } = await import("../shared/schema.js");

      const templates = await db
        .select()
        .from(emailTemplates)
        .orderBy(desc(emailTemplates.createdAt));

      // Parse variables JSON string back to array
      const templatesWithParsedVariables = templates.map(template => ({
        ...template,
        variables: JSON.parse(template.variables || '[]')
      }));

      res.json(templatesWithParsedVariables);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({
        message: "Error fetching email templates",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get single email template
  app.get("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const { emailTemplates } = await import("../shared/schema.js");

      const [template] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, templateId))
        .limit(1);

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Parse variables JSON string back to array
      const templateWithParsedVariables = {
        ...template,
        variables: JSON.parse(template.variables || '[]')
      };

      res.json(templateWithParsedVariables);
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({
        message: "Error fetching email template",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Create new email template (admin only)
  app.post("/api/email-templates", isAdmin, async (req, res) => {
    try {
      const { name, type, subject, htmlContent, variables, description, isActive } = req.body;
      const { emailTemplates } = await import("../shared/schema.js");

      // Validate required fields
      if (!name || !type || !subject || !htmlContent) {
        return res.status(400).json({
          message: "Name, type, subject, and htmlContent are required"
        });
      }

      // Convert variables array to JSON string
      const variablesJson = JSON.stringify(variables || []);

      const [newTemplate] = await db
        .insert(emailTemplates)
        .values({
          name,
          type,
          subject,
          htmlContent,
          variables: variablesJson,
          description: description || null,
          isActive: isActive !== undefined ? isActive : true,
        })
        .returning();

      // Parse variables back to array for response
      const templateWithParsedVariables = {
        ...newTemplate,
        variables: JSON.parse(newTemplate.variables || '[]')
      };

      res.status(201).json(templateWithParsedVariables);
    } catch (error) {
      console.error("Error creating email template:", error);
      res.status(500).json({
        message: "Error creating email template",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update email template (admin only)
  app.put("/api/email-templates/:id", isAdmin, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const { name, type, subject, htmlContent, variables, description, isActive } = req.body;
      const { emailTemplates } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");

      console.log("Updating template:", templateId, req.body);

      // Check if template exists
      const [existingTemplate] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, templateId))
        .limit(1);

      if (!existingTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Convertt variabvariables array to JSON string
      const variablesJson = JSON.stringify(variables || []);

      const [updatedTemplate] = await db
        .update(emailTemplates)
        .set({
          name,
          type,
          subject,
          htmlContent,
          variables: variablesJson,
          description: description || null,
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.id, templateId))
        .returning();

      // Parse variables back to array for response
      const templateWithParsedVariables = {
        ...updatedTemplate,
        variables: JSON.parse(updatedTemplate.variables || '[]')
      };

      console.log("Template updated successfully:", templateWithParsedVariables);
      res.json(templateWithParsedVariables);
    } catch (error) {
      console.error("Error updating email template:", error);
      res.status(500).json({
        message: "Error updating email template",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Delete email template (admin only)
  app.delete("/api/email-templates/:id", isAdmin, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const { emailTemplates } = await import("../shared/schema.js");

      // Check if template exists
      const [existingTemplate] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, templateId))
        .limit(1);

      if (!existingTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      await db
        .delete(emailTemplates)
        .where(eq(emailTemplates.id, templateId));

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting email template:", error);
      res.status(500).json({
        message: "Error deleting email template",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Comment Queue routes
  const commentQueueRouter = (await import("./routes/comment-queue.router")).default;
  app.use("/api/comment-queues", commentQueueRouter);

  // Support routes
  const supportRouterModule = (await import("./routes/support.router")).default;
  const { SupportController } = await import(
    "./controllers/support.controller"
  );
  const supportController = new SupportController();

  // Verification routes
  const { verificationRouter } = await import("./routes/verification.router");

  app.use("/api/support-requests", supportRouterModule);
  app.use("/api", supportRouterModule);
  app.use("/api", feedbackRouter);
  app.use("/api", verificationRouter);

  // Infringing content routes
  app.use("/api/infringing-content", infringingContentRouter);

  // Report management routes - with authentication middleware
  app.use("/api/report-management", isAuthenticated, reportManagementRouter);

  // Saved reports routes
  app.use("/api/saved-reports", savedReportsRouter);

  // Import and mount tick router
  const { tickRouter } = await import("./routes/tick.router");
  app.use("/api", tickRouter);

  // Import and mount notifications router
  const { notificationsRouter } = await import("./routes/notifications.router");
  app.use("/api", notificationsRouter);

  // Support requests routes
  app.get(
    "/api/support-requests",
    isAuthenticated,
    supportController.getAllSupportRequests,
  );
  app.put(
    "/api/support-requests/:id",
    isAuthenticated,
    supportController.updateSupportRequest,
  );
  app.put(
    "/api/support-requests/:id/assign",
    isAuthenticated,
    supportController.assignSupportRequest,
  );
  app.post(
    "/api/support-requests/:id/reply",
    isAuthenticated,
    upload.array("attachments", 10),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { to, subject, content, response_content } = req.body;
        const user = req.user as Express.User;
        const attachments = (req.files as Express.Multer.File[]) || [];

        // Get support request
        const supportRequest = await db.query.supportRequests.findFirst({
          where: eq(supportRequests.id, parseInt(id)),
        });

        if (!supportRequest) {
          return res.status(404).json({ message: "Support request not found" });
        }

        if (
          user.role !== "admin" &&
          supportRequest.assigned_to_id !== user.id
        ) {
          return res
            .status(403)
            .json({ message: "Not authorized to reply to this request" });
        }

        // Process attachments for email
        const emailAttachments = attachments.map((file) => ({
          filename: file.originalname,
          path: file.path,
          contentType: file.mimetype,
        }));

        // Send email with attachments
        const emailSent = await emailService.sendReplyEmailWithAttachments({
          to,
          subject,
          content,
          attachments: emailAttachments,
          originalRequest: {
            id: supportRequest.id,
            full_name: supportRequest.full_name,
            subject: supportRequest.subject,
            content: supportRequest.content,
          },
        });

        // Clean up temporary files after sending email
        if (emailSent) {
          // Delete uploaded files after successful email send
          attachments.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
              console.log(`Deleted temporary file: ${file.path}`);
            } catch (error) {
              console.error(`Failed to delete file ${file.path}:`, error);
            }
          });
        }

        if (!emailSent) {
          // Also clean up files even if email failed to prevent accumulation
          attachments.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
              console.log(
                `Deleted temporary file after email failure: ${file.path}`,
              );
            } catch (error) {
              console.error(`Failed to delete file ${file.path}:`, error);
            }
          });
          return res.status(500).json({
            message:
              "Không thể gửi email phản hồi. Vui lòng kiểm tra cấu hình SMTP.",
            details: "Email configuration or authentication failed",
          });
        }

        // Update support request status
        const result = await db
          .update(supportRequests)
          .set({
            status: "completed" as any,
            response_content,
            responder_id: user.id,
            response_time: new Date(),
            updated_at: new Date(),
          })
          .where(eq(supportRequests.id, parseInt(id)))
          .returning();

        return res.json({
          message: "Reply sent successfully",
          supportRequest: result[0],
        });
      } catch (error) {
        console.error("Error sending reply:", error);
        return res.status(500).json({
          message: "Error sending reply",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Pages API endpoints
  // Get all pages
  app.get("/api/pages", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;
      const pageType = req.query.pageType as string;
      const search = req.query.search as string;
      const activeTab = req.query.activeTab as
        | "all"
        | "processed"
        | "unprocessed";
      const assignedToId = req.query.assignedToId
        ? parseInt(req.query.assignedToId as string)
        : undefined;
      const classification = req.query.classification as string;

      console.log("Pages API called with params:", {
        page,
        limit,
        offset,
        startDate,
        endDate,
        pageType,
        search,
        activeTab,
        assignedToId,
        classification,
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
            lte(pagesTable.createdAt, endDate),
          ),
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
            sql`LOWER(${pagesTable.phoneNumber}) LIKE ${searchPattern}`,
            sql`${pagesTable.pageName}::jsonb->>'id' LIKE ${searchPattern}`,
          ),
        );
      }

      const whereConditions = conditions;
      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pagesTable)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);
      // Update pages API to return manager data from managerId column
      const { users } = await import("../shared/schema");
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
          processorUsername: users.username,
        })
        .from(pagesTable)
        .leftJoin(users, eq(pagesTable.assignedToId, users.id))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(pagesTable.createdAt))
        .limit(limit)
        .offset(offset);

      // Transform the data to match expected format
      const transformedPages = pagesData.map((page) => ({
        ...page,
        classification: page.classification || "new",
        processor: page.processorId
          ? {
              id: page.processorId,
              name: page.processorName,
              username: page.processorUsername,
            }
          : null,
      }));

      console.log(`Found ${transformedPages.length} pages for page ${page}`);

      res.json({
        data: transformedPages,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      console.error("Error fetching pages:", error);
      res.status(500).json({
        message: "Error fetching pages",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update page name
  app.put(
    "/api/pages/:id/name",
    isAuthenticated,
    async (req, res) => {
      try {
        const pageId = parseInt(req.params.id);
        const { name } = req.body;

        if (!name || name.trim() === "") {
          return res.status(400).json({
            message: "Name is required",
          });
        }

        // Import pages from schema
        const { pages } = await import("../shared/schema");

        // Get current page data
        const page = await db
          .select()
          .from(pages)
          .where(eq(pages.id, pageId))
          .limit(1);

        if (page.length === 0) {
          return res.status(404).json({ message: "Page not found" });
        }

        const currentPageName = page[0].pageName 
          ? (typeof page[0].pageName === 'string' ? JSON.parse(page[0].pageName) : page[0].pageName)
          : { id: page[0].id.toString(), page_name: '', name: '' };

        const updatedPageName = {
          ...currentPageName,
          page_name: name.trim(),
          name: name.trim()
        };

        const result = await db
          .update(pages)
          .set({
            pageName: updatedPageName,
            updatedAt: new Date(),
          })
          .where(eq(pages.id, pageId))
          .returning();

        res.json({ message: "Page name updated successfully", page: result[0] });
      } catch (error) {
        console.error("Error updating page name:", error);
        res.status(500).json({
          message: "Error updating page name",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Update page assignment
  app.put(
    "/api/pages/:id/assign",
    isAuthenticated,
    async (req, res) => {
      try {
        const pageId = parseInt(req.params.id);
        const { assignedToId } = req.body;

        // Import pages from schema
        const { pages } = await import("../shared/schema");

        const result = await db
          .update(pages)
          .set({
            assignedToId: assignedToId || null,
            updatedAt: new Date(),
          })
          .where(eq(pages.id, pageId))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "Page not found" });
        }

        res.json({ message: "Page assignment updated successfully", page: result[0] });
      } catch (error) {
        console.error("Error updating page assignment:", error);
        res.status(500).json({
          message: "Error updating page assignment",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Update page info (phone number and monetization)
  app.put(
    "/api/pages/:id/info",
    isAuthenticated,
    async (req, res) => {
      try {
        const pageId = parseInt(req.params.id);
        const { phoneNumber, monetizationEnabled } = req.body;

        // Import pages from schema
        const { pages } = await import("../shared/schema");

        const result = await db
          .update(pages)
          .set({
            phoneNumber: phoneNumber || null,
            monetizationEnabled: monetizationEnabled || false,
            updatedAt: new Date(),
          })
          .where(eq(pages.id, pageId))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "Page not found" });
        }

        res.json({ message: "Page info updated successfully", page: result[0] });
      } catch (error) {
        console.error("Error updating page info:", error);
        res.status(500).json({
          message: "Error updating page info",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Update page classification
  app.put(
    "/api/pages/:id/classification",
    isAuthenticated,
    async (req, res) => {
      try {
        const pageId = parseInt(req.params.id);
        const { classification } = req.body;

        // Validate classification value
        const validClassifications = ["new", "potential", "non_potential", "positive"];
        if (!validClassifications.includes(classification)) {
          return res.status(400).json({
            message: "Invalid classification value",
            validValues: validClassifications,
          });
        }

        // Import pages from schema
        const { pages } = await import("../shared/schema");

        // Update the page classification
        const updatedPage = await db
          .update(pages)
          .set({
            classification,
            updatedAt: new Date(),
          })
          .where(eq(pages.id, pageId))
          .returning();

        if (!updatedPage.length) {
          return res.status(404).json({ message: "Page not found" });
        }

        res.json({
          success: true,
          message: "Classification updated successfully",
          data: updatedPage[0],
        });

        // Update source_classification in contents table for this page
        try {
          const { contents } = await import("../shared/schema");
          
          await db
            .update(contents)
            .set({ source_classification: classification })
            .where(
              and(
                sql`source::json->>'type' = 'page'`,
                sql`source::json->>'id' = ${updatedPage[0].pageName ? JSON.parse(updatedPage[0].pageName as string).id : pageId.toString()}`
              )
            );
          
          console.log(`Updated source_classification to ${classification} for page contents`);
        } catch (error) {
          console.error("Error updating source_classification for page:", error);
        }

        // Broadcast badge update to all clients
        if ((global as any).broadcastBadgeUpdate) {
          (global as any).broadcastBadgeUpdate();
        }
      } catch (error) {
        console.error("Error updating page classification:", error);
        res.status(500).json({
          message: "Error updating page classification",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Groups API endpoints
  // Get all groups
  app.get("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;
      const groupType = req.query.groupType as string;
      const search = req.query.search as string;
      const activeTab = req.query.activeTab as
        | "all"
        | "processed"
        | "unprocessed";
      const assignedToId = req.query.assignedToId
        ? parseInt(req.query.assignedToId as string)
        : undefined;
      const classification = req.query.classification as string;

      console.log("Groups API called with params:", {
        page,
        limit,
        offset,
        startDate,
        endDate,
        groupType,
        search,
        activeTab,
        assignedToId,
        classification,
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
            lte(groupsTable.createdAt, endDate),
          ),
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

      // Search filter - search in group name, ID, phone number, and categories
      if (search && search.trim()) {
        const searchPattern = `%${search.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${groupsTable.groupName}::jsonb->>'group_name') LIKE ${searchPattern}`,
            sql`LOWER(${groupsTable.groupName}::jsonb->>'name') LIKE ${searchPattern}`,
            sql`${groupsTable.groupName}::jsonb->>'id' LIKE ${`%${search}%`}`,
            sql`LOWER(${groupsTable.phoneNumber}) LIKE ${searchPattern}`,
            sql`LOWER(${groupsTable.categories}) LIKE ${searchPattern}`,
          ),
        );
      }

      const whereConditions = conditions;
      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

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
          processorUsername: users.username,
        })
        .from(groupsTable)
        .leftJoin(users, eq(groupsTable.assignedToId, users.id))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(groupsTable.createdAt))
        .limit(limit)
        .offset(offset);

      // Transform the data to match expected format
      const transformedGroups = groupsData.map((group) => ({
        ...group,
        classification: group.classification || "new",
        processor: group.processorId
          ? {
              id: group.processorId,
              name: group.processorName,
              username: group.processorUsername,
            }
          : null,
      }));

      console.log(`Found ${transformedGroups.length} groups for page ${page}`);

      res.json({
        data: transformedGroups,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({
        message: "Error fetching groups",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update group name
  app.put(
    "/api/groups/:id/name",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.id);
        const { name } = req.body;

        if (!name || name.trim() === "") {
          return res.status(400).json({
            message: "Name is required",
          });
        }

        // Import groups from schema
        const { groups } = await import("../shared/schema");

        // Get current group data
        const group = await db
          .select()
          .from(groups)
          .where(eq(groups.id, groupId))
          .limit(1);

        if (group.length === 0) {
          return res.status(404).json({ message: "Group not found" });
        }

        const currentGroupName = group[0].groupName 
          ? (typeof group[0].groupName === 'string' ? JSON.parse(group[0].groupName) : group[0].groupName)
          : { id: group[0].id.toString(), group_name: '', name: '' };

        const updatedGroupName = {
          ...currentGroupName,
          group_name: name.trim(),
          name: name.trim()
        };

        const result = await db
          .update(groups)
          .set({
            groupName: updatedGroupName,
            updatedAt: new Date(),
          })
          .where(eq(groups.id, groupId))
          .returning();

        res.json({ message: "Group name updated successfully", group: result[0] });
      } catch (error) {
        console.error("Error updating group name:", error);
        res.status(500).json({
          message: "Error updating group name",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Update group assignment
  app.put(
    "/api/groups/:id/assign",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.id);
        const { assignedToId } = req.body;

        // Import groups from schema
        const { groups } = await import("../shared/schema");

        const result = await db
          .update(groups)
          .set({
            assignedToId: assignedToId || null,
            updatedAt: new Date(),
          })
          .where(eq(groups.id, groupId))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "Group not found" });
        }

        res.json({ message: "Group assignment updated successfully", group: result[0] });
      } catch (error) {
        console.error("Error updating group assignment:", error);
        res.status(500).json({
          message: "Error updating group assignment",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Update group info (phone number and monetization)
  app.put(
    "/api/groups/:id/info",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.id);
        const { phoneNumber, monetizationEnabled } = req.body;

        // Import groups from schema
        const { groups } = await import("../shared/schema");

        const result = await db
          .update(groups)
          .set({
            phoneNumber: phoneNumber || null,
            monetizationEnabled: monetizationEnabled || false,
            updatedAt: new Date(),
          })
          .where(eq(groups.id, groupId))
          .returning();

        if (result.length === 0) {
          return res.status(404).json({ message: "Group not found" });
        }

        res.json({ message: "Group info updated successfully", group: result[0] });
      } catch (error) {
        console.error("Error updating group info:", error);
        res.status(500).json({
          message: "Error updating group info",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // Update group classification
  app.put(
    "/api/groups/:id/classification",
    isAuthenticated,
    async (req, res) => {
      try {
        const groupId = parseInt(req.params.id);
        const { classification } = req.body;

        // Validate classification value
        const validClassifications = ["new", "potential", "non_potential", "positive"];
        if (!validClassifications.includes(classification)) {
          return res.status(400).json({
            message: "Invalid classification value",
            validValues: validClassifications,
          });
        }

        // Import groups from schema
        const { groups } = await import("../shared/schema");

        // Update the group classification
        const updatedGroup = await db
          .update(groups)
          .set({
            classification,
            updatedAt: new Date(),
                    })
          .where(eq(groups.id, groupId))
          .returning();

        if (!updatedGroup.length) {
          return res.status(404).json({ message: "Group not found" });
        }

        res.json({
          success: true,
          message: "Classification updated successfully",
          data: updatedGroup[0],
        });

        // Update source_classification in contents table for this group
        try {
          const { contents } = await import("../shared/schema");
          
          await db
            .update(contents)
            .set({ source_classification: classification })
            .where(
              and(
                sql`source::json->>'type' = 'group'`,
                sql`source::json->>'id' = ${updatedGroup[0].groupName ? JSON.parse(updatedGroup[0].groupName as string).id : groupId.toString()}`
              )
            );
          
          console.log(`Updated source_classification to ${classification} for group contents`);
        } catch (error) {
          console.error("Error updating source_classification for group:", error);
        }

        // Broadcast badge update to all clients
        if ((global as any).broadcastBadgeUpdate) {
          (global as any).broadcastBadgeUpdate();
        }
      } catch (error) {
        console.error("Error updating group classification:", error);
        res.status(500).json({
          message: "Error updating group classification",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Get all real users
  app.get("/api/real-users", isAuthenticated, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;
      const verificationStatus = req.query.verificationStatus as
        | "verified"
        | "unverified"
        | undefined;
      const search = req.query.search as string;
      const activeTab = req.query.activeTab as
        | "all"
        | "processed"
        | "unprocessed";
      const assignedToId = req.query.assignedToId
        ? parseInt(req.query.assignedToId as string)
        : undefined;
      const classification = req.query.classification as string;

      console.log("Real users API called with params:", {
        page,
        limit,
        offset,
        startDate,
        endDate,
        verificationStatus,
        search,
        activeTab,
        assignedToId,
        classification,
      });

      // Build conditions
      const conditions = [];

      // Date range filter
      if (startDate && endDate) {
        conditions.push(
          and(
            gte(realUsers.createdAt, startDate),
            lte(realUsers.createdAt, endDate),
          ),
        );
      }

      // Verification status filter
      if (verificationStatus === "verified") {
        conditions.push(eq(realUsers.verified, "verified"));
      } else if (verificationStatus === "unverified") {
        conditions.push(eq(realUsers.verified, "unverified"));
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
            sql`LOWER(${realUsers.email}) LIKE ${searchPattern}`,
            sql`${realUsers.fullName}::jsonb->>'id' LIKE ${searchPattern}`,
          ),
        );
      }

      // Active tab filter (processed/unprocessed)
      // This is for future implementation when we add processing status

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

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
          processorUsername: users.username,
        })
        .from(realUsers)
        .leftJoin(users, eq(realUsers.assignedToId, users.id))
        .where(whereClause)
        .orderBy(desc(realUsers.createdAt))
        .limit(limit)
        .offset(offset);

      // Transform the data to match expected format
      const transformedUsers = realUsersData.map((user) => ({
        ...user,
        classification: user.classification || "new", // Use DB classification or default
        processor: user.processorId
          ? {
              id: user.processorId,
              name: user.processorName,
              username: user.processorUsername,
            }
          : null,
      }));

      console.log(
        `Found ${transformedUsers.length} real users for page ${page}`,
      );

      res.json({
        data: transformedUsers,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      console.error("Error fetching real users:", error);
      res.status(500).json({
        message: "Error fetching real users",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // EmailService is already initialized as singleton in email.ts

  // Check if user is authenticated middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Image proxy endpoint with improved error handling
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      console.log('Proxy image request for:', url);

      // Set timeout for fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/*,*/*',
            'Cache-Control': 'no-cache'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('Failed to fetch image:', response.status, response.statusText);
          return res.status(response.status).json({ 
            error: `Failed to fetch image: ${response.status} ${response.statusText}` 
          });
        }

        // Get content type
        const contentType = response.headers.get('content-type');
        console.log('Response content-type:', contentType, 'for URL:', url);

        // Check if URL suggests it's an image file
        const urlLower = url.toLowerCase();
        const isImageUrl = urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
                          urlLower.includes('.png') || urlLower.includes('.gif') || 
                          urlLower.includes('.webp') || urlLower.includes('.svg');

        // Accept if content-type is image/* OR if URL suggests it's an image
        const isValidImage = (contentType && contentType.startsWith('image/')) || isImageUrl;

        if (!isValidImage) {
          console.error('Response is not an image:', contentType, 'URL:', url);
          return res.status(400).json({ error: 'URL does not point to an image' });
        }

        // Determine the actual content type to send
        let responseContentType = contentType;
        if (!contentType || contentType === 'application/octet-stream') {
          // Guess content type from URL extension
          if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
            responseContentType = 'image/jpeg';
          } else if (urlLower.includes('.png')) {
            responseContentType = 'image/png';
          } else if (urlLower.includes('.gif')) {
            responseContentType = 'image/gif';
          } else if (urlLower.includes('.webp')) {
            responseContentType = 'image/webp';
          } else if (urlLower.includes('.svg')) {
            responseContentType = 'image/svg+xml';
          } else {
            responseContentType = 'image/jpeg'; // Default fallback
          }
          console.log('Corrected content-type to:', responseContentType);
        }

        // Set appropriate headers for image response
        res.set({
          'Content-Type': responseContentType,
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        });

        // Stream the image data
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

        console.log('Successfully proxied image:', url);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error('Image fetch timeout for:', url);
          return res.status(408).json({ error: 'Request timeout' });
        }
        
        console.error('Error fetching image:', fetchError.message);
        return res.status(500).json({ error: 'Failed to fetch image' });
      }
    } catch (error) {
      console.error('Proxy image error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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

      // Add no-cache headers to prevent caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

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

      const { host, port, secure, user, password, fromName, fromEmail } =
        req.body;

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
        fromEmail,
      };

      // Update email service configuration
      await emailService.updateConfig(smtpConfig);

      // Force reload config from database to ensure fresh data
      await emailService.loadConfigFromDB();

      res.json({
        message: "SMTP configuration updated successfully",
        config: smtpConfig,
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
      const targetEmail =
        testEmail || `${(req.user as Express.User).username}@test.com`;

      // Test SMTP connection first
      const connectionOk = await emailService.testConnection();
      if (!connectionOk) {
        return res.status(400).json({
          message: "SMTP connection failed. Please check configuration.",
        });
      }

      // Send test email
      const emailSent = await emailService.sendTestEmail(targetEmail);
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send test email" });
      }

      res.json({
        message: "SMTP test completed successfully",
        testEmail: targetEmail,
      });
    } catch (error) {
      console.error("Error testing SMTP:", error);
      res.status(500).json({ message: "SMTP test failed" });
    }
  });

  // Caching mechanism using Map
  const cache = new Map();

  // Content stats cache using Map
  let contentStatsCache = new Map();
  const CONTENT_CACHE_DURATION = 300000; // 5 minutes (300 seconds)

  // Get content stats
  app.get("/api/content-stats", requireAuth, async (req, res) => {
    try {
      console.log("Content stats requested");

      // Get cached data
      const cached = contentStatsCache.get("content-stats");
      if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_DURATION) {
        console.log("Returning cached content stats");
        return res.json(cached.data);
      }

      // Get total counts
      const { contents } = await import("../shared/schema");

      const [contentStats] = await Promise.all([
        db
          .select({
            total: sql<number>`count(*)`,
            pending: sql<number>`count(*) filter (where status = 'pending')`,
            completed: sql<number>`count(*) filter (where status = 'completed')`,
          })
          .from(contents),
      ]);

      const data = {
        total: contentStats?.total || 0,
        pending: contentStats?.pending || 0,
        completed: contentStats?.completed || 0,
      };

      // Cache for 5 minutes
      contentStatsCache.set(
        "content-stats",
        {
          data: data,
          timestamp: Date.now(),
        },
        300,
      );

      res.json(data);
    } catch (error) {
      console.error("Error fetching content stats:", error);
      res.status(500).json({ error: "Failed to fetch content stats" });
    }
  });

  // Support requests aggregation
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      console.log("Dashboard stats requested");

      // Check cache first
      const cached = cache.get("dashboard-stats");
      if (cached) {
        console.log("Returning cached dashboard stats");
        return res.json(cached);
      }

      // Real users và groups
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Real users stats với aggregation
      const { pages, groups, supportRequests } = await import(
        "../shared/schema"
      );
      const { users } = await import("../shared/schema");
      const { realUsers } = await import("../shared/schema");

      const [
        realUsersStats,
        pagesStats,
        groupsStats,
        supportRequestsStats,
        contentStats,
      ] = await Promise.all([
        // Real users aggregation
        db
          .select({
            total: sql<number>`count(distinct ${realUsers.id})`,
            new: sql<number>`count(distinct ${realUsers.id}) filter (where ${realUsers.createdAt} >= ${sevenDaysAgo})`,
          })
          .from(realUsers),

        // Pages aggregation
        db
          .select({
            total: sql<number>`count(*)`,
            new: sql<number>`count(*) filter (where ${pages.createdAt} >= ${sevenDaysAgo})`,
          })
          .from(pages),

        // Groups aggregation
        db
          .select({
            total: sql<number>`count(*)`,
            new: sql<number>`count(*) filter (where ${groups.createdAt} >= ${sevenDaysAgo})`,
          })
          .from(groups),

        // Support requests aggregation
        db
          .select({
            total: sql<number>`count(*)`,
            pending: sql<number>`count(*) filter (where status = 'pending')`,
            processing: sql<number>`count(*) filter (where status = 'processing')`,
            completed: sql<number>`count(*) filter (where status = 'completed')`,
          })
          .from(supportRequests),

        // Content stats aggregation
        db
          .select({
            total: sql<number>`count(*)`,
            pending: sql<number>`count(*) filter (where status = 'pending')`,
            completed: sql<number>`count(*) filter (where status = 'completed')`,
          })
          .from(contents),
      ]);

      const stats = {
        // Real users
        totalRealUsers: realUsersStats[0]?.total || 0,
        newRealUsers: realUsersStats[0]?.new || 0,

        // Pages
        totalPages: pagesStats[0]?.total || 0,
        newPages: pagesStats[0]?.new || 0,

        // Groups
        totalGroups: groupsStats[0]?.total || 0,
        newGroups: groupsStats[0]?.new || 0,

        // Support requests
        totalSupportRequests: supportRequestsStats[0]?.total || 0,
        pendingSupportRequests: supportRequestsStats[0]?.pending || 0,
        processingSupportRequests: supportRequestsStats[0]?.processing || 0,
        completedSupportRequests: supportRequestsStats[0]?.completed || 0,

        // Content stats với better aggregation
        totalContents: contentStats[0]?.total || 0,
        pendingContents: contentStats[0]?.pending || 0,
        completedContents: contentStats[0]?.completed || 0,
      };

      console.log("Dashboard stats calculated:", stats);

      // Cache for 5 minutes
      cache.set("dashboard-stats", stats, 300);

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Force refresh badge counts (admin only)
  app.post("/api/badge-counts/refresh", isAdmin, async (req, res) => {
    try {
      // Clear all caches
      cache.clear();
      statsCache.clear();
      
      // Force broadcast fresh badge counts
      await broadcastFeedbackBadgeUpdate();
      
      res.json({ message: "Badge counts refreshed successfully" });
    } catch (error) {
      console.error("Error refreshing badge counts:", error);
      res.status(500).json({ error: "Failed to refresh badge counts" });
    }
  });

  // Badge counts for sidebar
  app.get("/api/badge-counts", requireAuth, async (req, res) => {
    try {
      // Check cache first
      const cached = cache.get("badge-counts");
      if (cached) {
        return res.json(cached);
      }

      const { pages, groups, supportRequests } = await import(
        "../shared/schema"
      );
      const { users } = await import("../shared/schema");
      const { realUsers } = await import("../shared/schema");

      const [realUsersNewCount, pagesNewCount, groupsNewCount] =
        await Promise.all([
          // Real users with "new" classification
          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(realUsers)
            .where(eq(realUsers.classification, "new")),

          // Pages with "new" classification
          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(pages)
            .where(eq(pages.classification, "new")),

          // Groups with "new" classification
          db
            .select({
              count: sql<number>`count(*)`,
            })
            .from(groups)
            .where(eq(groups.classification, "new")),
        ]);

      // Đếm support requests có status = 'pending' và type = 'support' (hoặc không có type - backward compatibility)
      const pendingSupportRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.status, "pending"),
            or(
              eq(supportRequests.type, "support"),
              isNull(supportRequests.type),
            ),
          ),
        );

      // Đếm feedback requests có type = 'feedback' và status = 'pending'
      const pendingFeedbackRequests = await db
        .select({ count: sql`count(*)::int` })
        .from(supportRequests)
        .where(
          and(
            eq(supportRequests.type, "feedback"),
            eq(supportRequests.status, "pending"),
          ),
        );

      const pendingSupport = pendingSupportRequests[0]?.count || 0;
      const pendingFeedback = pendingFeedbackRequests[0]?.count || 0;

      const badgeCounts = {
        realUsers: realUsersNewCount[0]?.count || 0,
        pages: pagesNewCount[0]?.count || 0,
        groups: groupsNewCount[0]?.count || 0,
        supportRequests: pendingSupport,
        feedbackRequests: pendingFeedback,
      };

      // Chỉ trả về các badge có giá trị > 0
      const filteredBadgeCounts = {
        realUsers:
          badgeCounts.realUsers > 0 ? badgeCounts.realUsers : undefined,
        pages: badgeCounts.pages > 0 ? badgeCounts.pages : undefined,
        groups: badgeCounts.groups > 0 ? badgeCounts.groups : undefined,
        supportRequests:
          badgeCounts.supportRequests > 0
            ? badgeCounts.supportRequests
            : undefined,
        feedbackRequests:
          badgeCounts.feedbackRequests > 0
            ? badgeCounts.feedbackRequests
            : undefined,
      };

      // Cache for 5 minutes để giảm tải database
      cache.set("badge-counts", filteredBadgeCounts, 300);

      res.json(filteredBadgeCounts);
    } catch (error) {
      console.error("Error fetching badge counts:", error);
      res.status(500).json({ error: "Failed to fetch badge counts" });
    }
  });

  // Support routes
  app.use("/api/support-requests", supportRouterModule);

  // Support requests routes
  app.get(
    "/api/support-requests",
    isAuthenticated,
    supportController.getAllSupportRequests,
  );
  app.put(
    "/api/support-requests/:id",
    isAuthenticated,
    supportController.updateSupportRequest,
  );
  app.put(
    "/api/support-requests/:id/assign",
    isAuthenticated,
    supportController.assignSupportRequest,
  );
  return httpServer;
}

// Include adminData in pages API response and query.