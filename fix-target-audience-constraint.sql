
-- Drop existing constraint
ALTER TABLE list_trends DROP CONSTRAINT IF EXISTS list_trends_target_audience_check;

-- Add new constraint with correct values
ALTER TABLE list_trends ADD CONSTRAINT list_trends_target_audience_check 
CHECK (target_audience IN ('all', 'new', 'potential', 'positive', 'negative', 'non_potential'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'list_trends'::regclass 
AND conname = 'list_trends_target_audience_check';
