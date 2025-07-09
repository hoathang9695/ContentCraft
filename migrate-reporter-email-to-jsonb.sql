
-- Migrate reporter_email into reporterName JSONB object
-- Step 1: Update existing data to include email in reporterName
UPDATE report_management 
SET reporter_name = jsonb_set(
  reporter_name, 
  '{reporterEmail}', 
  to_jsonb(reporter_email)
)
WHERE reporter_email IS NOT NULL;

-- Step 2: Verify the migration
SELECT 
  id, 
  reporter_name, 
  reporter_email,
  report_type,
  reason
FROM report_management 
ORDER BY created_at DESC 
LIMIT 5;

-- Step 3: After verification, drop the old reporter_email column
-- ALTER TABLE report_management DROP COLUMN reporter_email;

-- Show updated structure
\d+ report_management;
