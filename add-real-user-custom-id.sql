
-- Drop existing column and index if they exist
DROP INDEX IF EXISTS idx_real_users_custom_id;
ALTER TABLE real_users DROP COLUMN IF EXISTS custom_id;
ALTER TABLE real_users DROP COLUMN IF EXISTS verified;

-- Add custom_id column to real_users table
ALTER TABLE real_users 
ADD COLUMN custom_id INTEGER;

-- Add verified column with boolean type
ALTER TABLE real_users
ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster lookups 
CREATE INDEX idx_real_users_custom_id ON real_users(custom_id);
