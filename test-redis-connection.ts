
import dotenv from 'dotenv';
import Redis from 'ioredis';

// Load environment variables from .env file
dotenv.config();

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...');
  
  // Load environment variables
  const redisHost = process.env.REDISEARCH_HOST;
  const redisPort = process.env.REDISEARCH_PORT;
  const redisPassword = process.env.REDISEARCH_PASSWORD;
  
  if (!redisHost || !redisPort || !redisPassword) {
    console.error('❌ Redis configuration not found in environment variables');
    console.log('Required variables:');
    console.log('- REDISEARCH_HOST:', redisHost || 'NOT FOUND');
    console.log('- REDISEARCH_PORT:', redisPort || 'NOT FOUND');
    console.log('- REDISEARCH_PASSWORD:', redisPassword ? '***HIDDEN***' : 'NOT FOUND');
    return;
  }
  
  console.log(`🔗 Connecting to Redis: ${redisHost}:${redisPort}`);
  
  try {
    const redis = new Redis({
      host: redisHost,
      port: parseInt(redisPort),
      password: redisPassword,
      connectTimeout: 5000, // 5 seconds timeout
      lazyConnect: true, // Don't connect immediately
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1
    });
    
    // Test connection with timeout
    console.log('⏱️ Attempting to connect...');
    await redis.connect();
    console.log('🔌 Connected successfully, testing ping...');
    await redis.ping();
    console.log('✅ Redis connection successful');
    
    // Test search for keys
    const testPattern = '*114630*';
    console.log(`🔍 Searching for keys with pattern: ${testPattern}`);
    
    const keys = await redis.keys(testPattern);
    console.log(`📝 Found ${keys.length} keys:`);
    
    if (keys.length > 0) {
      // Show first few keys
      const sampleKeys = keys.slice(0, 5);
      sampleKeys.forEach((key, index) => {
        console.log(`  ${index + 1}. ${key}`);
      });
      
      if (keys.length > 5) {
        console.log(`  ... and ${keys.length - 5} more keys`);
      }
    }
    
    await redis.disconnect();
    console.log('🔌 Redis connection closed');
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
  }
}

testRedisConnection()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
