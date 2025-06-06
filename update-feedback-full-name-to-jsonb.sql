
-- Update support_requests table to use jsonb for full_name like real_users table
-- First, add a temporary column
ALTER TABLE support_requests ADD COLUMN full_name_jsonb jsonb;

-- Update the new column with proper JSON format for existing records
UPDATE support_requests 
SET full_name_jsonb = jsonb_build_object(
  'id', 'legacy_' || id::text,
  'name', full_name
) 
WHERE type = 'feedback';

-- For non-feedback records, keep simple format
UPDATE support_requests 
SET full_name_jsonb = jsonb_build_object(
  'name', full_name
) 
WHERE type != 'feedback' OR type IS NULL;

-- Drop the old column and rename the new one
ALTER TABLE support_requests DROP COLUMN full_name;
ALTER TABLE support_requests RENAME COLUMN full_name_jsonb TO full_name;

-- Add not null constraint
ALTER TABLE support_requests ALTER COLUMN full_name SET NOT NULL;
