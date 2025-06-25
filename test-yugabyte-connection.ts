
import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables
dotenv.config();

const { Client } = pg;

async function testYugabyteConnection() {
  console.log('🔍 Testing Yugabyte database connection...');
  console.log('==========================================');
  
  const connectionString = 'postgres://yugabyte:yugabyte@42.96.41.89:5433/sn_production';
  
  console.log('📍 Connection details:');
  console.log('Host: 42.96.41.89');
  console.log('Port: 5433');
  console.log('Database: sn_production');
  console.log('User: yugabyte');
  console.log('==========================================');
  
  const client = new Client({
    connectionString: connectionString,
    connectTimeout: 10000, // 10 seconds timeout
  });
  
  try {
    console.log('⏱️  Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    console.log('🔍 Testing database query...');
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    console.log('✅ Query successful!');
    console.log('Current time:', result.rows[0].current_time);
    console.log('Database version:', result.rows[0].db_version);
    
    // Test basic table listing
    console.log('🔍 Checking available tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('📊 Available tables:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('📋 No tables found in public schema');
    }
    
    console.log('==========================================');
    console.log('🎉 Yugabyte database connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
    console.log('==========================================');
    console.log('💡 Troubleshooting tips:');
    console.log('1. Check if the server IP is correct: 42.96.41.89');
    console.log('2. Verify port 5433 is accessible');
    console.log('3. Confirm database name: sn_production');
    console.log('4. Check username/password: yugabyte/yugabyte');
    console.log('5. Ensure firewall allows connections from this IP');
  } finally {
    try {
      await client.end();
      console.log('🔌 Connection closed');
    } catch (closeError) {
      console.log('⚠️  Error closing connection:', closeError.message);
    }
  }
}

// Run the test
testYugabyteConnection()
  .then(() => {
    console.log('✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  });
