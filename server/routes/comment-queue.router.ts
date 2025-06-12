import express from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../middleware/auth";
import { pool } from "../db";

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
  console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
  console.log("📝 User authenticated:", req.user);

  // Set response headers early
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

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
      console.log('📝 Found existing queue for external ID:', externalId);
      console.log('📝 Adding', comments.length, 'new comments to existing queue');

      // Add comments to existing queue
      const updatedQueue = await storage.addCommentsToQueue(existingQueue.session_id, comments);

      console.log("✅ Comments added to existing queue:", updatedQueue.session_id);

      const successResponse = {
        success: true,
        message: `Đã thêm ${comments.length} comments vào queue hiện tại. Tổng cộng ${updatedQueue.total_comments} comments.`,
        sessionId: updatedQueue.session_id,
        totalComments: updatedQueue.total_comments,
        isExistingQueue: true
      };

      console.log("📝 SENDING SUCCESS RESPONSE (EXISTING QUEUE):", JSON.stringify(successResponse, null, 2));
      return res.status(200).json(successResponse);
    }

    console.log("✅ Creating new queue...");

    // Create new queue
    const queue = await storage.createCommentQueue({
      externalId,
      comments,
      selectedGender: selectedGender || 'all',
      userId: user.id
    });

    console.log("✅ Queue created successfully:", queue.session_id);

    const successResponse = {
      success: true,
      message: `Đã tạo queue với ${comments.length} comments`,
      sessionId: queue.session_id,
      totalComments: queue.total_comments,
      isExistingQueue: false
    };

    console.log("📝 SENDING SUCCESS RESPONSE:", JSON.stringify(successResponse, null, 2));

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
    const result = await pool.query(`
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
    console.error("❌ Error getting user queues:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user queues"
    });
  }
});

// Get processor status (Admin only)
router.get('/status', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem trạng thái processor'
      });
    }

    const { CommentQueueProcessor } = await import('../comment-queue-processor');
    
    // Get current processor instance status
    const processorInstance = CommentQueueProcessor.getInstance();
    const status = {
      currentProcessingCount: processorInstance.processingQueues?.size || 0,
      maxConcurrentQueues: processorInstance.maxConcurrentQueues || 10,
      processingQueues: Array.from(processorInstance.processingQueues?.entries() || []).map(([sessionId, queue]) => ({
        sessionId,
        startTime: queue.startTime || Date.now()
      }))
    };

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('❌ Error getting processor status:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy trạng thái processor'
    });
  }
});

// Force cleanup stuck queues (Admin only)
router.post('/force-cleanup', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể force cleanup'
      });
    }

    const { commentQueueProcessor } = await import('../comment-queue-processor');
    const status = await commentQueueProcessor.forceCleanupStuckQueues();

    res.json({
      success: true,
      status,
      message: 'Đã force cleanup stuck queues'
    });

  } catch (error) {
    console.error('❌ Error forcing cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi force cleanup'
    });
  }
});

// Manual cleanup for admin
router.delete("/cleanup", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;

    // Only allow admin to cleanup
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only admin can perform cleanup"
      });
    }

    const { hoursOld = 24 } = req.body;
    const deletedCount = await storage.cleanupOldQueues(hoursOld);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old queues`,
      deletedCount
    });

  } catch (error) {
    console.error("Error during manual cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup old queues"
    });
  }
});

// Manual cleanup endpoint (Admin only)
router.delete('/cleanup', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể thực hiện cleanup'
      });
    }
    const { hoursOld = 24 } = req.body;

    // Validate hoursOld parameter
    if (typeof hoursOld !== 'number' || hoursOld < 1 || hoursOld > 8760) { // Max 1 year
      return res.status(400).json({
        success: false,
        message: 'Invalid hoursOld parameter. Must be between 1 and 8760 hours.'
      });
    }

    console.log(`🧹 Manual cleanup requested by admin for queues older than ${hoursOld} hours`);

    const deletedCount = await storage.cleanupOldQueues(hoursOld);

    res.json({
      success: true,
      deletedCount,
      message: `Successfully cleaned up ${deletedCount} old queues`
    });
  } catch (error) {
    console.error('❌ Error in manual cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup queues',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get cleanup schedule status (Admin only)
router.get('/cleanup/status', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem trạng thái cleanup'
      });
    }

    // Get current queue statistics
    const totalCount = await storage.getQueueCount();

    // Check queues that would be cleaned up
    const previewResult = await pool.query(`
      SELECT COUNT(*) as cleanup_eligible_count
      FROM comment_queues 
      WHERE status IN ('completed', 'failed') 
      AND completed_at IS NOT NULL
      AND completed_at < NOW() - INTERVAL '24 hours'
    `);

    const cleanupEligibleCount = parseInt(previewResult.rows[0]?.cleanup_eligible_count || '0');

    res.json({
      success: true,
      status: {
        totalQueues: totalCount,
        cleanupEligibleQueues: cleanupEligibleCount,
        cleanupSchedule: 'Every 24 hours',
        lastCleanupTime: 'Check server logs for last cleanup time',
        nextCleanupTime: 'Within 24 hours of server start'
      }
    });
  } catch (error) {
    console.error('❌ Error getting cleanup status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cleanup status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check for inconsistent queue statuses (Admin only)
router.get('/check-inconsistent', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể kiểm tra queue không nhất quán'
      });
    }

    const result = await pool.query(`
      SELECT session_id, status, total_comments, processed_count, success_count, failure_count,
             (success_count + failure_count) as actual_processed,
             created_at, updated_at
      FROM comment_queues 
      WHERE 
        (status = 'completed' AND processed_count < total_comments) OR
        (status = 'completed' AND (success_count + failure_count) < total_comments) OR
        (processed_count > total_comments) OR
        (success_count + failure_count > total_comments)
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      inconsistentCount: result.rows.length,
      queues: result.rows.map(row => ({
        session_id: row.session_id,
        status: row.status,
        total_comments: row.total_comments,
        processed_count: row.processed_count,
        success_count: row.success_count,
        failure_count: row.failure_count,
        actual_processed: row.actual_processed,
        issue: row.status === 'completed' && row.processed_count < row.total_comments 
          ? 'Marked completed but not all processed'
          : row.processed_count > total_comments
          ? 'Processed count exceeds total'
          : 'Other inconsistency',
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    });
  } catch (error) {
    console.error('❌ Error checking inconsistent queues:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check inconsistent queues',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Fix inconsistent queue statuses (Admin only)
router.post('/fix-inconsistent', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể sửa queue không nhất quán'
      });
    }

    // Fix queues marked as completed but not fully processed
    const fixResult1 = await pool.query(`
      UPDATE comment_queues 
      SET status = 'failed',
          error_info = CONCAT(COALESCE(error_info, ''), '; Fixed inconsistent status - was marked completed but only ', processed_count, '/', total_comments, ' processed at ', NOW()),
          updated_at = NOW()
      WHERE status = 'completed' 
      AND processed_count < total_comments
      RETURNING session_id, total_comments, processed_count, success_count, failure_count
    `);

    // Fix queues where success+failure count doesn't match processed count
    const fixResult2 = await pool.query(`
      UPDATE comment_queues 
      SET processed_count = (success_count + failure_count),
          updated_at = NOW()
      WHERE (success_count + failure_count) != processed_count
      AND (success_count + failure_count) <= total_comments
      RETURNING session_id, total_comments, processed_count, success_count, failure_count
    `);

    // Reset stuck processing queues that haven't been updated in 1 hour
    const fixResult3 = await pool.query(`
      UPDATE comment_queues 
      SET status = 'pending',
          started_at = NULL,
          error_info = CONCAT(COALESCE(error_info, ''), '; Reset stuck processing queue at ', NOW()),
          updated_at = NOW()
      WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '1 hour'
      RETURNING session_id, total_comments, processed_count
    `);

    res.json({
      success: true,
      fixedStatusCount: fixResult1.rows.length,
      fixedCountCount: fixResult2.rows.length,
      resetStuckCount: fixResult3.rows.length,
      message: `Fixed ${fixResult1.rows.length} status inconsistencies, ${fixResult2.rows.length} count inconsistencies, and reset ${fixResult3.rows.length} stuck queues`,
      details: {
        statusFixes: fixResult1.rows,
        countFixes: fixResult2.rows,
        stuckResets: fixResult3.rows
      }
    });
  } catch (error) {
    console.error('❌ Error fixing inconsistent queues:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix inconsistent queues',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reset specific queue by session ID (Admin only)
router.post('/reset-queue/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể reset queue cụ thể'
      });
    }

    const { sessionId } = req.params;

    // Check if queue exists
    const queueResult = await pool.query(`
      SELECT session_id, status, started_at
      FROM comment_queues 
      WHERE session_id = $1
    `, [sessionId]);

    if (queueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Queue không tồn tại'
      });
    }

    const queue = queueResult.rows[0];

    // Reset the queue to pending
    const updateResult = await pool.query(`
      UPDATE comment_queues 
      SET status = 'pending',
          started_at = NULL,
          error_info = CONCAT(COALESCE(error_info, ''), '; Admin reset queue at ', NOW()),
          updated_at = NOW()
      WHERE session_id = $1
      RETURNING *
    `, [sessionId]);

    // Remove from local processing map if exists
    const { commentQueueProcessor } = await import('../comment-queue-processor');
    commentQueueProcessor.processingQueues.delete(sessionId);

    console.log(`🔧 Admin reset queue: ${sessionId} from status ${queue.status} to pending`);

    res.json({
      success: true,
      message: `Queue ${sessionId} đã được reset về pending`,
      before: {
        status: queue.status,
        started_at: queue.started_at
      },
      after: {
        status: updateResult.rows[0].status,
        started_at: updateResult.rows[0].started_at
      }
    });

  } catch (error) {
    console.error('❌ Error resetting specific queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Fix specific queue by session ID (Admin only)
router.post('/fix-queue/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể sửa queue cụ thể'
      });
    }

    const { sessionId } = req.params;

    // Get queue details first
    const queueResult = await pool.query(`
      SELECT session_id, status, total_comments, processed_count, success_count, failure_count, comments
      FROM comment_queues 
      WHERE session_id = $1
    `, [sessionId]);

    if (queueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Queue không tồn tại'
      });
    }

    const queue = queueResult.rows[0];
    const comments = Array.isArray(queue.comments) ? queue.comments : JSON.parse(queue.comments);
    const actualTotalComments = comments.length;
    const actualProcessed = (queue.success_count || 0) + (queue.failure_count || 0);

    // Determine correct status
    let newStatus = queue.status;
    let errorInfo = queue.error_info || '';

    if (queue.status === 'completed' && actualProcessed < actualTotalComments) {
      newStatus = 'failed';
      errorInfo += `; Fixed: was marked completed but only ${actualProcessed}/${actualTotalComments} processed at ${new Date().toISOString()}`;
    } else if (actualProcessed === actualTotalComments && queue.status !== 'completed') {
      newStatus = 'completed';
      errorInfo += `; Fixed: all comments processed, updated status to completed at ${new Date().toISOString()}`;
    }

    // Update the queue
    const updateResult = await pool.query(`
      UPDATE comment_queues 
      SET status = $1,
          total_comments = $2,
          processed_count = $3,
          error_info = $4,
          updated_at = NOW()
      WHERE session_id = $5
      RETURNING *
    `, [newStatus, actualTotalComments, actualProcessed, errorInfo, sessionId]);

    res.json({
      success: true,
      message: `Queue ${sessionId} đã được sửa`,
      before: {
        status: queue.status,
        total_comments: queue.total_comments,
        processed_count: queue.processed_count,
        actual_comments_count: actualTotalComments,
        actual_processed: actualProcessed
      },
      after: updateResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error fixing specific queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test cleanup endpoint to check what would be deleted (Admin only)
router.get('/cleanup/preview', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem preview cleanup'
      });
    }
    const hoursOld = parseInt(req.query.hoursOld as string) || 24;

    const result = await pool.query(`
      SELECT session_id, status, completed_at, 
             EXTRACT(EPOCH FROM (NOW() - completed_at))/3600 as hours_old
      FROM comment_queues 
      WHERE status IN ('completed', 'failed') 
      AND completed_at IS NOT NULL
      AND completed_at < NOW() - INTERVAL '${hoursOld} hours'
      ORDER BY completed_at DESC
      LIMIT 50
    `, [hoursOld]);

    res.json({
      success: true,
      previewCount: result.rows.length,
      hoursOld,
      queues: result.rows.map(row => ({
        session_id: row.session_id,
        status: row.status,
        completed_at: row.completed_at,
        hours_old: Math.round(row.hours_old * 10) / 10
      }))
    });
  } catch (error) {
    console.error('❌ Error in cleanup preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview cleanup',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



export default router;