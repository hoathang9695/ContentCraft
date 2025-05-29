
-- Drop managerId column from pages table
ALTER TABLE pages DROP COLUMN IF EXISTS manager_id;

-- Verify the column has been dropped
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pages' 
ORDER BY ordinal_position;
