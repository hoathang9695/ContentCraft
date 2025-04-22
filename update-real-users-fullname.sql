
-- Drop NOT NULL constraint
ALTER TABLE real_users 
ALTER COLUMN full_name DROP NOT NULL;

-- Change column type to JSONB and update existing data
UPDATE real_users
SET full_name = jsonb_build_object(
  'id', id::text,
  'name', full_name::text
);

ALTER TABLE real_users 
ALTER COLUMN full_name TYPE JSONB;

-- Add NOT NULL constraint back
ALTER TABLE real_users 
ALTER COLUMN full_name SET NOT NULL;
