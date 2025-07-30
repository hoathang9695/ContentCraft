
import { createClient } from 'redis';

interface RedisConfig {
  host: string;
  port: number;
  password: string;
}

class RedisService {
  private client: any;
  private config: RedisConfig;

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
      },
      password: this.config.password,
    });

    this.client.on('error', (err: any) => {
      console.error('❌ Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('✅ Redis Client Connected');
    });
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
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
      await this.connect();

      console.log('🚀 Pushing trend to Redis with data:', {
        ...trendData,
        target_users: `${trendData.target_users.length} users`
      });

      const results = [];

      // Push data for each target user
      for (const userId of trendData.target_users) {
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

        // Set data with TTL
        await this.client.hSet(redisKey, redisData);
        await this.client.expire(redisKey, trendData.ttl);

        results.push({
          userId,
          redisKey,
          success: true
        });
      }

      console.log(`✅ Successfully pushed trend to Redis for ${results.length} users`);
      return {
        success: true,
        results,
        total_users: trendData.target_users.length
      };

    } catch (error) {
      console.error('❌ Error pushing trend to Redis:', error);
      throw error;
    } finally {
      // Keep connection open for reuse
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
