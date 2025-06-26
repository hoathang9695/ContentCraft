
-- Add device_token column to real_users table for Firebase FCM
ALTER TABLE real_users 
ADD COLUMN IF NOT EXISTS device_token VARCHAR(500);

-- Add comment for documentation
COMMENT ON COLUMN real_users.device_token IS 'Firebase FCM device token để gửi push notification';

-- Create index for device_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_real_users_device_token ON real_users(device_token);
