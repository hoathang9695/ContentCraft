
-- Check actual production database structure
-- Kiểm tra cấu trúc thực tế của production database

-- 1. Kiểm tra xem table report_management có tồn tại không
SELECT 
  'Table existence check' as info,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'report_management'
  ) as table_exists;

-- 2. Nếu table tồn tại, xem tất cả columns
SELECT 
  'Column list' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'report_management' 
ORDER BY ordinal_position;

-- 3. Đếm số records nếu table tồn tại
SELECT 
  'Record count' as info,
  COUNT(*) as total_records
FROM report_management;

-- 4. Xem 3 records đầu tiên để hiểu cấu trúc data
SELECT 
  'Sample data' as info,
  *
FROM report_management 
LIMIT 3;
