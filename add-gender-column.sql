
-- Add gender column to fake_users table
ALTER TABLE fake_users 
ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'male';

-- Add check constraint for valid gender values
ALTER TABLE fake_users 
ADD CONSTRAINT check_gender_valid 
CHECK (gender IN ('male', 'female', 'other'));

-- Update existing records to have default gender if needed
UPDATE fake_users 
SET gender = 'male' 
WHERE gender IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN fake_users.gender IS 'Gender of fake user: male, female, or other';
