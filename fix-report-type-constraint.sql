
-- Fix report_type constraint to include 'recruit' type
-- Step 1: Drop existing constraint
ALTER TABLE report_management DROP CONSTRAINT IF EXISTS report_management_report_type_check;

-- Step 2: Add new constraint with 'recruit' included
ALTER TABLE report_management ADD CONSTRAINT report_management_report_type_check 
CHECK (report_type IN ('user', 'content', 'page', 'group', 'comment', 'course', 'project', 'video', 'song', 'event', 'recruit'));

-- Verify the constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE table_name = 'report_management' 
AND constraint_name LIKE '%report_type%';
