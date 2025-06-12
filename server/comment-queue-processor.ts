
import { storage } from './storage';

interface FakeUser {
  id: number;
  name: string;
  token: string;
  gender: string;
}

interface ProcessingQueue {
  sessionId: string;
  startTime: number;
}

export class CommentQueueProcessor {
  private processingQueues = new Map<string, ProcessingQueue>(); // Track multiple processing queues
  private processingInterval: NodeJS.Timeout | null = null;
  private maxConcurrentQueues = 3; // Maximum concurrent queue processing
  private processingDelay = 10000; // 10 seconds between queue checks

  constructor() {
    console.log('🚀 CommentQueueProcessor constructor called (Multi-threaded)');
    try {
      this.startProcessor();
      console.log('✅ CommentQueueProcessor started successfully (Multi-threaded mode)');
    } catch (error) {
      console.error('❌ Error starting CommentQueueProcessor:', error);
    }
  }

  startProcessor() {
    if (this.processingInterval) return;
    
    console.log(`🚀 Comment Queue Processor started (Max ${this.maxConcurrentQueues} concurrent queues)`);
    
    // Check every 10 seconds for new queues
    this.processingInterval = setInterval(async () => {
      await this.checkStuckQueues();
      await this.processAvailableQueues();
    }, this.processingDelay);

    // Run cleanup once daily at startup and then every 24 hours
    this.scheduleCleanup();

    // Process immediately on start
    this.processAvailableQueues();
  }

  private scheduleCleanup() {
    console.log('🗓️ Setting up cleanup schedule...');
    
    // Run cleanup immediately on start
    setTimeout(async () => {
      console.log('🧹 Running initial cleanup on startup...');
      await this.cleanupCompletedQueues();
    }, 5000); // Wait 5 seconds after startup
    
    // Then run every 24 hours (86400000 ms)
    setInterval(async () => {
      console.log('🧹 Running scheduled daily cleanup...');
      await this.cleanupCompletedQueues();
    }, 24 * 60 * 60 * 1000);
    
    console.log('🗓️ Cleanup scheduled: Initial cleanup in 5s, then every 24 hours');
  }

  stopProcessor() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('⏹️ Comment Queue Processor stopped');
    }
  }

  async processAvailableQueues() {
    try {
      // Check how many queues are currently processing
      const currentProcessingCount = this.processingQueues.size;
      
      if (currentProcessingCount >= this.maxConcurrentQueues) {
        console.log(`⏸️ Max concurrent queues reached (${currentProcessingCount}/${this.maxConcurrentQueues})`);
        return;
      }

      // Get pending queues with database lock to prevent race conditions
      const { pool } = await import('./db');
      const lockResult = await pool.query(`
        UPDATE comment_queues 
        SET status = 'processing', started_at = NOW()
        WHERE session_id IN (
          SELECT session_id FROM comment_queues 
          WHERE status = 'pending' 
          ORDER BY created_at ASC 
          LIMIT $1
        )
        RETURNING *
      `, [this.maxConcurrentQueues - currentProcessingCount]);

      const pendingQueues = lockResult.rows;
      
      if (pendingQueues.length === 0) {
        if (currentProcessingCount === 0) {
          // console.log('📋 No pending queues to process');
        }
        return;
      }

      // Start processing available queues (up to max concurrent limit)
      const availableSlots = this.maxConcurrentQueues - currentProcessingCount;
      const queuesToProcess = pendingQueues.slice(0, availableSlots);

      console.log(`🔄 Starting ${queuesToProcess.length} new queue(s) (${currentProcessingCount + queuesToProcess.length}/${this.maxConcurrentQueues} total)`);

      // Process queues in parallel
      const processingPromises = queuesToProcess.map(queue => 
        this.processQueueAsync(queue)
      );

      // Don't wait for completion here - let them run in background
      Promise.allSettled(processingPromises).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`📊 Batch completed: ${successful} successful, ${failed} failed`);
      });

    } catch (error) {
      console.error('❌ Error in processAvailableQueues:', error);
    }
  }

  async processQueueAsync(queue: any) {
    const sessionId = queue.session_id;
    
    // Mark as processing
    this.processingQueues.set(sessionId, {
      sessionId,
      startTime: Date.now()
    });

    console.log(`📝 [${sessionId}] Starting queue processing (${queue.total_comments} comments)`);

    try {
      await this.processQueue(queue);
      console.log(`✅ [${sessionId}] Queue completed successfully`);
    } catch (error) {
      console.error(`❌ [${sessionId}] Queue failed:`, error);
      
      // Mark queue as failed in database
      try {
        await storage.updateCommentQueueProgress(sessionId, {
          status: 'failed',
          errorInfo: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (updateError) {
        console.error(`❌ [${sessionId}] Failed to update queue status:`, updateError);
      }
    } finally {
      // Remove from processing map
      this.processingQueues.delete(sessionId);
      console.log(`🏁 [${sessionId}] Queue processing finished`);
    }
  }

  async processQueue(queue: any) {
    const startTime = Date.now();
    const maxProcessingTime = 25 * 60 * 1000; // 25 minutes max
    const sessionId = queue.session_id;
    
    try {
      // Mark as processing with started_at timestamp
      await storage.updateCommentQueueProgress(sessionId, {
        status: 'processing',
        currentCommentIndex: queue.processed_count || 0
      });

      // Comments are already parsed from DB (PostgreSQL JSONB automatically parses)
      const comments = Array.isArray(queue.comments) ? queue.comments : JSON.parse(queue.comments);
      const startIndex = queue.processed_count || 0;

      console.log(`📋 [${sessionId}] Processing queue: ${comments.length} total comments, starting from index ${startIndex}`);

      // Get fake users for the selected gender
      const allFakeUsers = await storage.getAllFakeUsers();
      const fakeUsers = queue.selected_gender === 'all' 
        ? allFakeUsers 
        : allFakeUsers.filter((user: FakeUser) => user.gender === queue.selected_gender);

      if (fakeUsers.length === 0) {
        throw new Error(`No fake users available for gender: ${queue.selected_gender}`);
      }

      const usedUserIds = new Set<number>();
      let currentSuccessCount = queue.success_count || 0;
      let currentFailureCount = queue.failure_count || 0;

      // Process remaining comments
      for (let index = startIndex; index < comments.length; index++) {
        // Check timeout
        if (Date.now() - startTime > maxProcessingTime) {
          console.log(`⏰ [${sessionId}] Timeout after ${maxProcessingTime/60000} minutes at comment ${index + 1}/${comments.length}`);
          
          // Update progress before timeout
          await storage.updateCommentQueueProgress(sessionId, {
            status: 'failed',
            processedCount: index, // Current index, not +1 since this comment wasn't processed
            errorInfo: `Processing timeout after ${maxProcessingTime/60000} minutes at comment ${index + 1}/${comments.length}`
          });
          
          throw new Error('Processing timeout - queue took too long to process');
        }

        const comment = comments[index];
        
        // Add delay between comments (except for first)
        if (index > startIndex) {
          const delayMs = this.getAdaptiveDelay(index);
          console.log(`⏳ [${sessionId}] Waiting ${Math.ceil(delayMs / 60000)} minutes before comment ${index + 1}/${comments.length}...`);
          await this.delay(delayMs);
        }

        // Update current progress (current comment being processed)
        await storage.updateCommentQueueProgress(sessionId, {
          currentCommentIndex: index
        });

        let success = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!success && retryCount < maxRetries) {
          try {
            // Get random fake user
            const fakeUser = this.getRandomFakeUser(fakeUsers, usedUserIds);
            if (!fakeUser) {
              throw new Error('No fake user available');
            }

            console.log(`📤 [${sessionId}] Sending comment ${index + 1}/${comments.length} from user: ${fakeUser.name}`);

            // Send comment to external API
            await this.sendCommentToAPI(queue.external_id, fakeUser.id, comment);
            
            success = true;
            currentSuccessCount++;
            
            // Update progress after successful send
            await storage.updateCommentQueueProgress(sessionId, {
              processedCount: index + 1, // This comment is now successfully processed
              successCount: currentSuccessCount
            });

            console.log(`✅ [${sessionId}] Comment ${index + 1}/${comments.length} sent successfully (Total success: ${currentSuccessCount})`);

          } catch (error) {
            retryCount++;
            console.error(`❌ [${sessionId}] Attempt ${retryCount}/${maxRetries} failed for comment ${index + 1}:`, error);

            if (retryCount < maxRetries) {
              const retryDelay = this.getRetryDelay(retryCount);
              console.log(`⏳ [${sessionId}] Retrying in ${retryDelay}ms...`);
              await this.delay(retryDelay);
            } else {
              // Final failure - this comment failed permanently
              currentFailureCount++;
              
              await storage.updateCommentQueueProgress(sessionId, {
                processedCount: index + 1, // This comment is processed (but failed)
                failureCount: currentFailureCount,
                errorInfo: error instanceof Error ? error.message : 'Unknown error'
              });
              console.error(`❌ [${sessionId}] Comment ${index + 1}/${comments.length} failed permanently (Total failures: ${currentFailureCount})`);
              success = true; // Exit retry loop, move to next comment
            }
          }
        }
      }

      // All comments processed - check if we should mark as completed
      const totalProcessed = currentSuccessCount + currentFailureCount;
      console.log(`📊 [${sessionId}] Processing finished: ${totalProcessed}/${comments.length} comments processed (${currentSuccessCount} success, ${currentFailureCount} failed)`);

      if (totalProcessed === comments.length) {
        // Mark as completed only if all comments were processed
        await storage.updateCommentQueueProgress(sessionId, {
          status: 'completed',
          processedCount: comments.length
        });
        console.log(`🎉 [${sessionId}] Queue completed successfully - all ${comments.length} comments processed`);
      } else {
        // This shouldn't happen, but just in case
        await storage.updateCommentQueueProgress(sessionId, {
          status: 'failed',
          errorInfo: `Processing incomplete: ${totalProcessed}/${comments.length} comments processed`
        });
        console.error(`❌ [${sessionId}] Queue marked as failed - incomplete processing: ${totalProcessed}/${comments.length}`);
      }

    } catch (error) {
      console.error(`❌ [${sessionId}] Queue failed:`, error);
      
      await storage.updateCommentQueueProgress(sessionId, {
        status: 'failed',
        errorInfo: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendCommentToAPI(externalId: string, fakeUserId: number, comment: string) {
    // Get fake user info for sending to external API
    const fakeUser = await storage.getFakeUser(fakeUserId);
    if (!fakeUser) {
      throw new Error(`Fake user not found: ${fakeUserId}`);
    }

    // Send directly to emso.vn API
    const apiUrl = `https://prod-sn.emso.vn/api/v1/statuses/${externalId}/comments`;
    
    console.log(`🔗 Sending comment to external API: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fakeUser.token}`,
          'User-Agent': 'Content-Queue-Processor/2.0-MultiThread'
        },
        body: JSON.stringify({
          status: comment
        })
      });

      console.log(`📡 External API Response status: ${response.status}`);

      if (!response.ok) {
        const responseText = await response.text();
        console.error(`❌ External API Error Response:`, responseText);
        throw new Error(`External API request failed: ${response.status} ${response.statusText} - ${responseText}`);
      }

      // Some APIs might return different content types
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = { success: true, text: await response.text() };
      }

      console.log(`✅ External API Response data:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ Error calling external API:`, error);
      throw error;
    }
  }

  private getRandomFakeUser(fakeUsers: FakeUser[], usedUserIds: Set<number>): FakeUser | null {
    if (fakeUsers.length === 0) return null;

    const availableUsers = fakeUsers.filter(user => !usedUserIds.has(user.id));

    if (availableUsers.length === 0) {
      console.log('All users used, resetting cycle...');
      usedUserIds.clear();
      const randomIndex = Math.floor(Math.random() * fakeUsers.length);
      const selectedUser = fakeUsers[randomIndex];
      usedUserIds.add(selectedUser.id);
      return selectedUser;
    }

    const randomIndex = Math.floor(Math.random() * availableUsers.length);
    const selectedUser = availableUsers[randomIndex];
    usedUserIds.add(selectedUser.id);
    return selectedUser;
  }

  private getAdaptiveDelay(attemptNumber: number): number {
    const baseMs = 1 * 60000; // 1 minute base (reduced for multi-thread)
    const maxMs = 3 * 60000; // 3 minutes max (reduced for multi-thread)
    const randomFactor = 0.5 + Math.random(); // 0.5 - 1.5
    return Math.min(baseMs * randomFactor, maxMs);
  }

  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 15000); // Exponential backoff, max 15s
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkStuckQueues() {
    try {
      // Import pool directly from db module to avoid storage dependency issues
      const { pool } = await import('./db');
      
      // Reset queues that have been processing for more than 30 minutes
      const stuckThreshold = new Date();
      stuckThreshold.setMinutes(stuckThreshold.getMinutes() - 30);
      
      console.log(`🔍 Checking for stuck queues before: ${stuckThreshold.toISOString()}`);

      const result = await pool.query(`
        UPDATE comment_queues 
        SET status = 'pending', 
            started_at = NULL,
            error_info = CONCAT(COALESCE(error_info, ''), '; Reset from stuck state at ', NOW())
        WHERE status = 'processing' 
        AND started_at < $1
        RETURNING session_id, external_id
      `, [stuckThreshold.toISOString()]);

      if (result.rows.length > 0) {
        console.log(`🔧 Reset ${result.rows.length} stuck queues:`, 
          result.rows.map(row => row.session_id)
        );
        
        // Remove stuck queues from our local processing map
        result.rows.forEach(row => {
          this.processingQueues.delete(row.session_id);
        });
      }

      // Also check for locally tracked queues that might be stuck
      const now = Date.now();
      const localStuckThreshold = 30 * 60 * 1000; // 30 minutes
      
      for (const [sessionId, processInfo] of this.processingQueues.entries()) {
        if (now - processInfo.startTime > localStuckThreshold) {
          console.log(`🔧 Removing locally stuck queue: ${sessionId}`);
          this.processingQueues.delete(sessionId);
        }
      }

    } catch (error) {
      console.error('❌ Error checking stuck queues:', error);
    }
  }

  async cleanupCompletedQueues() {
    try {
      console.log('🧹 Starting automatic cleanup of old completed queues...');
      
      // Get queue count before cleanup
      const beforeCount = await storage.getQueueCount();
      
      // Xóa các queues đã completed/failed cách đây hơn 24 giờ
      const cleanupResult = await storage.cleanupOldQueues(24); // 24 hours
      
      // Get queue count after cleanup
      const afterCount = await storage.getQueueCount();
      
      if (cleanupResult > 0) {
        console.log(`🧹✅ Automatic cleanup completed: ${cleanupResult} old queues deleted`);
        console.log(`📊 Queue count: ${beforeCount} → ${afterCount}`);
      } else {
        console.log(`🧹 Automatic cleanup completed: No old queues found to delete`);
        console.log(`📊 Current queue count: ${afterCount}`);
      }
    } catch (error) {
      console.error('❌ Error during automatic queue cleanup:', error);
      console.error('❌ Cleanup error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  // Public method to get current processing status
  getProcessingStatus() {
    return {
      currentProcessingCount: this.processingQueues.size,
      maxConcurrentQueues: this.maxConcurrentQueues,
      processingQueues: Array.from(this.processingQueues.values())
    };
  }

  // Public method to adjust concurrent limit
  setMaxConcurrentQueues(limit: number) {
    if (limit > 0 && limit <= 10) {
      this.maxConcurrentQueues = limit;
      console.log(`⚙️ Max concurrent queues updated to: ${limit}`);
    } else {
      console.error('❌ Invalid concurrent limit. Must be between 1 and 10');
    }
  }
}

// Export singleton instance
export const commentQueueProcessor = new CommentQueueProcessor();
