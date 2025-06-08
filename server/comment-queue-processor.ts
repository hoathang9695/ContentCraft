
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

      const comments = JSON.parse(queue.comments);
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
    // Get the base URL - use localhost for internal requests
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const apiUrl = `${baseUrl}/api/contents/${externalId}/send-comment`;
    
    console.log(`🔗 Sending comment to API: ${apiUrl}`);
    console.log(`📦 Payload:`, { fakeUserId, comment });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fakeUserId,
          comment
        })
      });

      console.log(`📡 API Response status: ${response.status}`);
      
      // Log response headers for debugging
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const responseText = await response.text();
        console.error(`❌ API Error Response:`, responseText);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${responseText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error(`❌ Expected JSON but got:`, contentType, responseText);
        throw new Error(`API returned non-JSON response: ${contentType}`);
      }

      const result = await response.json();
      console.log(`✅ API Response data:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ Error calling API:`, error);
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
}

// Export singleton instance
export const commentQueueProcessor = new CommentQueueProcessor();
