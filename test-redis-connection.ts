
import Redis from 'ioredis';

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...');
  
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_SEARCH_URL;
  
  if (!redisUrl) {
    console.error('❌ Redis URL not found in environment variables');
    console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('REDIS')));
    return;
  }
  
  console.log('🔗 Connecting to Redis:', redisUrl.replace(/\/\/.*@/, '//***:***@'));
  
  try {
    const redis = new Redis(redisUrl);
    
    // Test connection
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
