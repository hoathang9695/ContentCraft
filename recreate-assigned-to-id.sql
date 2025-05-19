
-- Drop existing column and index if they exist
DROP INDEX IF EXISTS idx_real_users_assigned_to;
ALTER TABLE real_users DROP COLUMN IF EXISTS assigned_to_id;

-- Add assigned_to_id column to real_users table
ALTER TABLE real_users 
ADD COLUMN assigned_to_id INTEGER REFERENCES users(id);

-- Create index for faster lookups
CREATE INDEX idx_real_users_assigned_to ON real_users(assigned_to_id);
