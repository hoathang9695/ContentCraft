
-- Add custom_id column to real_users table
ALTER TABLE real_users 
ADD COLUMN custom_id BIGINT;

-- Create index for faster lookups
CREATE INDEX idx_real_users_custom_id ON real_users(custom_id);

-- Update existing records with their custom IDs
UPDATE real_users 
SET custom_id = 113728049762216423 
WHERE id = 2;

UPDATE real_users 
SET custom_id = 113728049762216424 
WHERE id = 3;
