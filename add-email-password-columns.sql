
-- Add email and password columns to fake_users table
ALTER TABLE fake_users 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;

-- Add comment for documentation
COMMENT ON COLUMN fake_users.email IS 'Email của người dùng ảo';
COMMENT ON COLUMN fake_users.password IS 'Password của người dùng ảo';
