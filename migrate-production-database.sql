
-- Migration script for Production Database
-- Hoàn tất đồng bộ schema giữa Replit và Production

-- Bước 1: Kiểm tra tình trạng hiện tại
SELECT 
  'Current report_management structure' as info;

\d+ report_management;

-- Bước 2: Kiểm tra dữ liệu hiện tại
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN reporter_email IS NOT NULL THEN 1 END) as has_old_email,
  COUNT(CASE WHEN (reporter_name->>'reporterEmail') IS NOT NULL THEN 1 END) as has_new_email
FROM report_management;

-- Bước 3: Migrate data từ reporter_email vào reporterName JSONB
UPDATE report_management 
SET reporter_name = jsonb_set(
  COALESCE(reporter_name, '{}'::jsonb), 
  '{reporterEmail}', 
  to_jsonb(reporter_email)
)
WHERE reporter_email IS NOT NULL 
AND (reporter_name IS NULL OR (reporter_name->>'reporterEmail') IS NULL);

-- Bước 4: Xác nhận migration thành công
SELECT 
  'Migration verification' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN reporter_email IS NOT NULL THEN 1 END) as old_email_count,
  COUNT(CASE WHEN (reporter_name->>'reporterEmail') IS NOT NULL THEN 1 END) as new_email_count
FROM report_management;

-- Bước 5: Sample data để kiểm tra
SELECT 
  id,
  report_type,
  reporter_name,
  reporter_email,
  created_at
FROM report_management 
ORDER BY created_at DESC 
LIMIT 5;

-- Bước 6: Drop column cũ (nếu migration thành công)
-- Uncomment dòng này khi đã chắc chắn migration OK
-- ALTER TABLE report_management DROP COLUMN IF EXISTS reporter_email;

-- Bước 7: Verify final structure
SELECT 'Final structure check' as info;
\d+ report_management;
