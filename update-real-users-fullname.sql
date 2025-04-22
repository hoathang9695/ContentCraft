
-- Drop NOT NULL constraint
ALTER TABLE real_users 
ALTER COLUMN full_name DROP NOT NULL;

-- Change column type to JSONB
ALTER TABLE real_users 
ALTER COLUMN full_name TYPE JSONB USING jsonb_build_object(
  'id', '0',
  'name', COALESCE(full_name::text, '')
);

-- Add NOT NULL constraint back
ALTER TABLE real_users 
ALTER COLUMN full_name SET NOT NULL;
