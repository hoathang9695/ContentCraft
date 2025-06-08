import express from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../middleware/auth";
import { pool } from "../db"; // Import pool
import { sql } from 'drizzle-orm';

const router = express.Router();

// Middleware to ensure JSON responses
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Create new comment queue
router.post("/", isAuthenticated, async (req, res) => {
  console.log("📝 COMMENT QUEUE REQUEST START");
  console.log("📝 Request URL:", req.originalUrl);
  console.log("📝 Request method:", req.method);
  console.log("📝 Request headers:", req.headers);
  console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
  console.log("📝 User authenticated:", req.user);

  // Set response headers early
  res.setHeader('Content-Type', 'application/json');

  try {
    const user = req.user as Express.User;
    const { externalId, comments, selectedGender } = req.body;

    console.log("📝 Extracted data:", { externalId, commentsLength: comments?.length, selectedGender });

    // Validate request data
    if (!externalId) {
      console.error("❌ Validation failed: External ID is missing");
      return res.status(400).json({
        success: false,
        message: "External ID is required"
      });
    }

    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      console.error("❌ Validation failed: Comments array is missing or empty");
      return res.status(400).json({
        success: false,
        message: "Comments array is required and must not be empty"
      });
    }

    // Check if there's already an active queue for this external ID
    const existingQueue = await storage.getActiveCommentQueueForExternal(externalId);

    if (existingQueue) {
      console.log("Found existing queue:", existingQueue.session_id);

      // Add comments to existing queue
      const existingComments = JSON.parse(existingQueue.comments);
      const updatedComments = [...existingComments, ...comments];

      await storage.updateCommentQueueProgress(existingQueue.session_id, {
        totalComments: updatedComments.length
      });

      // Update comments in database
      await pool.query(
        'UPDATE comment_queues SET comments = $1, updated_at = NOW() WHERE session_id = $2',
        [JSON.stringify(updatedComments), existingQueue.session_id]
      );

      return res.json({
        success: true,
        message: `Added ${comments.length} comments to existing queue`,
        sessionId: existingQueue.session_id,
        totalComments: updatedComments.length
      });
    }

    console.log("✅ Creating new queue...");

    // Check database connection with timeout
    console.log("🔍 Testing database connection...");
    try {
      const connectionTest = await Promise.race([
        pool.query("SELECT NOW() as current_time"),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timeout')), 5000)
        )
      ]);
      console.log("✅ Database connection successful:", connectionTest);
    } catch (dbError) {
      console.error("❌ Database connection failed:", dbError);
      throw new Error(`Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`);
    }

    // Create new queue
    const queue = await storage.createCommentQueue({
      externalId,
      comments,
      selectedGender: selectedGender || 'all',
      userId: user.id
    });

    console.log("✅ Queue created successfully:", queue.session_id);
    console.log("✅ Queue details:", JSON.stringify(queue, null, 2));

    // Verify queue was inserted into database
    const verifyQueue = await storage.getCommentQueue(queue.session_id);
    console.log("🔍 Queue verification:", verifyQueue ? "Found in DB" : "NOT FOUND in DB");

    const successResponse = {
      success: true,
      message: `Đã tạo queue với ${comments.length} comments`,
      sessionId: queue.session_id,
      totalComments: queue.total_comments
    };

    console.log("📝 SENDING SUCCESS RESPONSE:", JSON.stringify(successResponse, null, 2));
    
    // Ensure headers are set correctly
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.status(200).json(successResponse);

  } catch (error) {
    console.error("❌ Error creating comment queue:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : 'No stack trace');

    // More detailed error information
    if (error && typeof error === 'object') {
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        name: error instanceof Error ? error.name : undefined,
        code: (error as any).code || undefined,
        detail: (error as any).detail || undefined,
        constraint: (error as any).constraint || undefined,
        table: (error as any).table || undefined,
        column: (error as any).column || undefined
      });
    }

    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    const errorResponse = {
      success: false,
      message: "Lỗi tạo comment queue", 
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    };

    console.log("📝 SENDING ERROR RESPONSE:", JSON.stringify(errorResponse, null, 2));
    return res.status(500).json(errorResponse);
  }
});

// Get queue status
router.get("/:sessionId", isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const queue = await storage.getCommentQueue(sessionId);

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: "Queue not found"
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: queue.session_id,
        externalId: queue.external_id,
        totalComments: queue.total_comments,
        processedCount: queue.processed_count || 0,
        successCount: queue.success_count || 0,
        failureCount: queue.failure_count || 0,
        status: queue.status,
        createdAt: queue.created_at,
        updatedAt: queue.updated_at
      }
    });

  } catch (error) {
    console.error("Error getting queue status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get queue status"
    });
  }
});

// Get all queues for user
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const result = await storage.db.query(`
      SELECT session_id, external_id, total_comments, processed_count, 
             success_count, failure_count, status, created_at, updated_at
      FROM comment_queues 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [user.id]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error("Error getting user queues:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user queues"
    });
  }
});

// Test endpoint to manually trigger processor
router.post("/test-processor", isAuthenticated, async (req, res) => {
  try {
    console.log("🧪 Manual processor test triggered");
    
    // Import and trigger processor
    const { commentQueueProcessor } = await import('../comment-queue-processor');
    await commentQueueProcessor.processNextQueue();
    
    res.json({
      success: true,
      message: "Processor test triggered"
    });
  } catch (error) {
    console.error("❌ Processor test failed:", error);
    res.status(500).json({
      success: false,
      message: "Processor test failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;