
-- Check production database schema
-- Kiểm tra cấu trúc bảng report_management

-- Kiểm tra các columns hiện có
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'report_management' 
ORDER BY ordinal_position;

-- Kiểm tra dữ liệu mẫu
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN reporter_name IS NOT NULL THEN 1 END) as has_reporter_name,
  COUNT(CASE WHEN (reporter_name->>'reporterEmail') IS NOT NULL THEN 1 END) as has_email_in_jsonb
FROM report_management;

-- Kiểm tra 5 records gần nhất
SELECT 
  id,
  report_type,
  reporter_name,
  reason,
  status,
  created_at
FROM report_management 
ORDER BY created_at DESC 
LIMIT 5;
