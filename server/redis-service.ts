
import { createClient } from 'redis';

interface RedisConfig {
  host: string;
  port: number;
  password: string;
}

class RedisService {
  private client: any;
  private config: RedisConfig;
  private isConnecting: boolean = false;

  constructor() {
    this.config = {
      host: process.env.REDISEARCH_HOST || '172.16.0.61',
      port: parseInt(process.env.REDISEARCH_PORT || '6380'),
      password: process.env.REDISEARCH_PASSWORD || '7qJmoeDPhvEgksz'
    };

    this.client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
        connectTimeout: 10000, // 10 seconds
        commandTimeout: 5000,  // 5 seconds
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('❌ Redis max retries reached, giving up');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      },
      password: this.config.password,
    });

    this.client.on('error', (err: any) => {
      console.error('❌ Redis Client Error:', err);
      this.isConnecting = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis Client Connected');
      this.isConnecting = false;
    });

    this.client.on('disconnect', () => {
      console.log('⚠️ Redis Client Disconnected');
      this.isConnecting = false;
    });
  }

  async connect() {
    if (this.client.isOpen) {
      return;
    }
    
    if (this.isConnecting) {
      console.log('⏳ Redis connection already in progress, waiting...');
      return;
    }

    try {
      this.isConnecting = true;
      await this.client.connect();
    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  async pushTrendToRedis(trendData: {
    trend_id: number;
    redis_id: string;
    s: string;
    a: string;
    g: string;
    k: string;
    l: string;
    r: string;
    target_users: string[];
    ttl: number;
    title: string;
    content: string;
  }) {
    try {
      console.log('🚀 Attempting to push trend to Redis with data:', {
        ...trendData,
        target_users: `${trendData.target_users.length} users`
      });

      // Try to connect with timeout
      const connectPromise = this.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout after 15s')), 15000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);

      if (!this.client.isOpen) {
        throw new Error('Redis client is not connected');
      }

      const results = [];
      const errors = [];

      // Push data for each target user with individual error handling
      for (const userId of trendData.target_users) {
        try {
          const redisKey = `feed-${userId}:${trendData.redis_id}`;
          
          // Prepare data fields
          const redisData: any = {};
          
          if (trendData.s) redisData.s = trendData.s;
          if (trendData.a) redisData.a = trendData.a;
          if (trendData.g) redisData.g = trendData.g;
          if (trendData.k) redisData.k = trendData.k;
          if (trendData.l) redisData.l = trendData.l;
          if (trendData.r) redisData.r = trendData.r;

          console.log(`📤 Setting Redis key: ${redisKey} with data:`, redisData, `TTL: ${trendData.ttl}s`);

          // Set data with TTL using pipeline for better performance
          const pipeline = this.client.multi();
          pipeline.hSet(redisKey, redisData);
          pipeline.expire(redisKey, trendData.ttl);
          await pipeline.exec();

          results.push({
            userId,
            redisKey,
            success: true
          });
        } catch (userError) {
          console.error(`❌ Failed to set Redis key for user ${userId}:`, userError);
          errors.push({
            userId,
            error: userError.message
          });
        }
      }

      console.log(`✅ Successfully pushed trend to Redis for ${results.length}/${trendData.target_users.length} users`);
      
      if (errors.length > 0) {
        console.log(`⚠️ Failed for ${errors.length} users:`, errors);
      }

      return {
        success: true,
        results,
        errors,
        total_users: trendData.target_users.length,
        successful_users: results.length,
        failed_users: errors.length
      };

    } catch (error) {
      console.error('❌ Error pushing trend to Redis:', error);
      return {
        success: false,
        error: error.message,
        results: [],
        errors: [],
        total_users: trendData.target_users.length,
        successful_users: 0,
        failed_users: trendData.target_users.length
      };
    }
  }

  async getTrendFromRedis(userId: string, trendId: string) {
    try {
      await this.connect();
      const redisKey = `feed-${userId}:${trendId}`;
      const data = await this.client.hGetAll(redisKey);
      return data;
    } catch (error) {
      console.error('❌ Error getting trend from Redis:', error);
      throw error;
    }
  }

  async deleteTrendFromRedis(userId: string, trendId: string) {
    try {
      await this.connect();
      const redisKey = `feed-${userId}:${trendId}`;
      await this.client.del(redisKey);
      console.log(`🗑️ Deleted Redis key: ${redisKey}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting trend from Redis:', error);
      throw error;
    }
  }

  // Get all trend keys for debugging
  async getAllTrendKeys(pattern: string = 'feed-*') {
    try {
      await this.connect();
      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      console.error('❌ Error getting Redis keys:', error);
      throw error;
    }
  }
}

export const redisService = new RedisService();
export default RedisService;
