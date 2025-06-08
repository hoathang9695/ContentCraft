import express from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../middleware/auth";
import { pool } from "../db"; // Import pool
import { sql } from 'drizzle-orm';

const router = express.Router();

// Create new comment queue
router.post("/", isAuthenticated, async (req, res) => {
  console.log("=== COMMENT QUEUE CREATION START ===");
  console.log("Request body:", req.body);
  console.log("Request headers:", req.headers);
  console.log("User:", req.user);

  try {
    const user = req.user as Express.User;
    const { externalId, comments, selectedGender } = req.body;

    console.log("Parsed data:", { externalId, comments, selectedGender, userId: user.id });

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

    // Check database connection
    console.log("🔍 Testing database connection...");
    await pool.query("SELECT 1"); // Simple query to test connection
    console.log("✅ Database connection successful");

    // Create new queue
    const queue = await storage.createCommentQueue({
      externalId,
      comments,
      selectedGender: selectedGender || 'all',
      userId: user.id
    });

    console.log("✅ Queue created successfully:", queue.session_id);

    return res.json({
      success: true,
      message: `Created queue with ${comments.length} comments`,
      sessionId: queue.session_id,
      totalComments: queue.total_comments
    });

  } catch (error) {
    console.error("❌ Error creating comment queue:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      // code: error.code, //Commented out to avoid type error, since error.code might not exist
      // detail: error.detail,  //Commented out to avoid type error, since error.detail might not exist
      // constraint: error.constraint  //Commented out to avoid type error, since error.constraint might not exist
    });

    return res.status(500).json({
      success: false,
      message: "Failed to create comment queue",
      error: error instanceof Error ? error.message : "Unknown error",
      // code: error.code //Commented out to avoid type error, since error.code might not exist
    });
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

export default router;