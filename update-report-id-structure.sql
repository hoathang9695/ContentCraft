
-- Update report_management table to store only ID in reported_id
-- Remove target_id field and keep only id

-- Update existing data to extract only the id field
UPDATE report_management 
SET reported_id = jsonb_build_object('id', reported_id->>'id')
WHERE reported_id ? 'target_id';

-- Verify the changes
SELECT 
  id, 
  reported_id, 
  report_type, 
  reason,
  status
FROM report_management 
ORDER BY created_at DESC 
LIMIT 5;

-- Show the updated structure
\d+ report_management;
