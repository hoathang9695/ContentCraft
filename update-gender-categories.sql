
-- Update gender categories for fake users
-- First, update existing records to new format
UPDATE fake_users 
SET gender = CASE 
  WHEN gender = 'male' THEN 'male_adult'
  WHEN gender = 'female' THEN 'female_adult'
  WHEN gender = 'other' THEN 'other'
  ELSE 'male_adult'
END;

-- Drop existing constraint if it exists
ALTER TABLE fake_users 
DROP CONSTRAINT IF EXISTS check_gender_valid;

-- Add new check constraint for valid gender values
ALTER TABLE fake_users 
ADD CONSTRAINT check_gender_valid 
CHECK (gender IN ('male_adult', 'male_young', 'male_teen', 'female_adult', 'female_young', 'female_teen', 'other'));

-- Update column comment
COMMENT ON COLUMN fake_users.gender IS 'Gender and age category of fake user: male_adult (Nam trung niên), male_young (Nam thanh niên), male_teen (Nam thiếu niên), female_adult (Nữ trung niên), female_young (Nữ thanh niên), female_teen (Nữ thiếu niên), other (Khác)';
