
import { storage } from './storage';

interface FakeUser {
  id: number;
  name: string;
  token: string;
  gender: string;
}

export class CommentQueueProcessor {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🚀 CommentQueueProcessor constructor called');
    try {
      this.startProcessor();
      console.log('✅ CommentQueueProcessor started successfully');
    } catch (error) {
      console.error('❌ Error starting CommentQueueProcessor:', error);
    }
  }

  startProcessor() {
    if (this.processingInterval) return;
    
    console.log('🚀 Comment Queue Processor started');
    
    // Check every 30 seconds for new queues
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextQueue();
        await this.cleanupCompletedQueues();
      }
    }, 30000);

    // Process immediately on start
    this.processNextQueue();
  }

  stopProcessor() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('⏹️ Comment Queue Processor stopped');
    }
  }

  async processNextQueue() {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      
      const pendingQueues = await storage.getPendingCommentQueues();
      
      if (pendingQueues.length === 0) {
        return;
      }

      const queue = pendingQueues[0];
      console.log(`📝 Processing queue: ${queue.session_id} (${queue.total_comments} comments)`);

      await this.processQueue(queue);
      
    } catch (error) {
      console.error('❌ Error in queue processor:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processQueue(queue: any) {
    try {
      // Mark as processing
      await storage.updateCommentQueueProgress(queue.session_id, {
        status: 'processing',
        currentCommentIndex: queue.processed_count || 0
      });

      // Comments are already parsed from DB (PostgreSQL JSONB automatically parses)
      const comments = Array.isArray(queue.comments) ? queue.comments : JSON.parse(queue.comments);
      const startIndex = queue.processed_count || 0;

      // Get fake users for the selected gender
      const allFakeUsers = await storage.getAllFakeUsers();
      const fakeUsers = queue.selected_gender === 'all' 
        ? allFakeUsers 
        : allFakeUsers.filter((user: FakeUser) => user.gender === queue.selected_gender);

      if (fakeUsers.length === 0) {
        throw new Error(`No fake users available for gender: ${queue.selected_gender}`);
      }

      const usedUserIds = new Set<number>();

      // Process remaining comments
      for (let index = startIndex; index < comments.length; index++) {
        const comment = comments[index];
        
        // Add delay between comments (except for first)
        if (index > startIndex) {
          const delayMs = this.getAdaptiveDelay(index);
          console.log(`⏳ Waiting ${Math.ceil(delayMs / 60000)} minutes before comment ${index + 1}/${comments.length}...`);
          await this.delay(delayMs);
        }

        // Update current progress
        await storage.updateCommentQueueProgress(queue.session_id, {
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

            console.log(`📤 Sending comment ${index + 1}/${comments.length} from user: ${fakeUser.name}`);

            // Send comment to external API
            await this.sendCommentToAPI(queue.external_id, fakeUser.id, comment);
            
            success = true;
            await storage.updateCommentQueueProgress(queue.session_id, {
              processedCount: index + 1,
              successCount: (queue.success_count || 0) + 1
            });

            console.log(`✅ Comment ${index + 1} sent successfully`);

          } catch (error) {
            retryCount++;
            console.error(`❌ Attempt ${retryCount}/${maxRetries} failed for comment ${index + 1}:`, error);

            if (retryCount < maxRetries) {
              const retryDelay = this.getRetryDelay(retryCount);
              console.log(`⏳ Retrying in ${retryDelay}ms...`);
              await this.delay(retryDelay);
            } else {
              // Final failure
              await storage.updateCommentQueueProgress(queue.session_id, {
                processedCount: index + 1,
                failureCount: (queue.failure_count || 0) + 1,
                errorInfo: error instanceof Error ? error.message : 'Unknown error'
              });
              console.error(`❌ Comment ${index + 1} failed permanently`);
            }
          }
        }
      }

      // Mark as completed
      await storage.updateCommentQueueProgress(queue.session_id, {
        status: 'completed'
      });

      console.log(`🎉 Queue ${queue.session_id} completed successfully`);

    } catch (error) {
      console.error(`❌ Queue ${queue.session_id} failed:`, error);
      
      await storage.updateCommentQueueProgress(queue.session_id, {
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
    console.log(`📦 Payload:`, { 
      fakeUser: { id: fakeUser.id, name: fakeUser.name, token: fakeUser.token },
      comment: comment.substring(0, 100) + '...'
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fakeUser.token}`,
          'User-Agent': 'Content-Queue-Processor/1.0'
        },
        body: JSON.stringify({
          status: comment
        })
      });

      console.log(`📡 External API Response status: ${response.status}`);
      
      // Log response headers for debugging
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

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
    const baseMs = 2 * 60000; // 2 minutes base
    const maxMs = 5 * 60000; // 5 minutes max
    const randomFactor = 0.5 + Math.random(); // 0.5 - 1.5
    return Math.min(baseMs * randomFactor, maxMs);
  }

  private getRetryDelay(retryCount: number): number {
    return Math.min(2000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanupCompletedQueues() {
    try {
      // Xóa các queues đã completed/failed cách đây hơn 24 giờ
      const cleanupResult = await storage.cleanupOldQueues(24); // 24 hours
      
      if (cleanupResult > 0) {
        console.log(`🧹 Cleaned up ${cleanupResult} old completed queues`);
      }
    } catch (error) {
      console.error('❌ Error during queue cleanup:', error);
    }
  }
}

// Export singleton instance
export const commentQueueProcessor = new CommentQueueProcessor();
