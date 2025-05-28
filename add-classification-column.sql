
-- Add classification column to real_users table if it doesn't exist
ALTER TABLE real_users 
ADD COLUMN IF NOT EXISTS classification VARCHAR(50) DEFAULT 'new';

-- Update existing records to have default classification
UPDATE real_users 
SET classification = 'new' 
WHERE classification IS NULL;
