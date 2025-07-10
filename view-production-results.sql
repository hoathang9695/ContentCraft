
-- View production database check results
-- This script will show the actual output

-- 1. Check table structure
SELECT 
  'Table Structure Check' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'report_management' 
ORDER BY ordinal_position;

-- 2. Check data statistics
SELECT 
  'Data Statistics' as section,
  COUNT(*) as total_records,
  COUNT(CASE WHEN reporter_name IS NOT NULL THEN 1 END) as has_reporter_name,
  COUNT(CASE WHEN (reporter_name->>'reporterEmail') IS NOT NULL THEN 1 END) as has_email_in_jsonb;

-- Add FROM clause for the statistics query
SELECT 
  'Data Statistics' as section,
  COUNT(*) as total_records,
  COUNT(CASE WHEN reporter_name IS NOT NULL THEN 1 END) as has_reporter_name,
  COUNT(CASE WHEN (reporter_name->>'reporterEmail') IS NOT NULL THEN 1 END) as has_email_in_jsonb
FROM report_management;

-- 3. Sample data
SELECT 
  'Sample Data' as section,
  id,
  report_type,
  reporter_name,
  reason,
  status,
  created_at
FROM report_management 
ORDER BY created_at DESC 
LIMIT 3;
