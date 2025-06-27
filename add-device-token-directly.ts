
import { pool } from "./server/db";

async function addDeviceTokenColumn() {
  try {
    console.log("🔧 Adding device_token column to real_users table...");
    
    // Add device_token column
    await pool.query(`
      ALTER TABLE real_users 
      ADD COLUMN IF NOT EXISTS device_token VARCHAR(500);
    `);
    
    // Add comment for documentation
    await pool.query(`
      COMMENT ON COLUMN real_users.device_token IS 'Firebase FCM device token để gửi push notification';
    `);
    
    // Create index for device_token for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_real_users_device_token ON real_users(device_token);
    `);
    
    console.log("✅ Successfully added device_token column to real_users table");
    
    // Verify the column was added
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'real_users' AND column_name = 'device_token';
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Column verification:", result.rows[0]);
    } else {
      console.log("❌ Column not found after creation");
    }
    
  } catch (error) {
    console.error("❌ Error adding device_token column:", error);
  } finally {
    process.exit(0);
  }
}

addDeviceTokenColumn();
