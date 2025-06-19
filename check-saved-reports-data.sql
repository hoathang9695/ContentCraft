
-- Check saved_reports table structure
\d saved_reports;

-- Check data in saved_reports table with details
SELECT 
    id,
    title,
    report_type,
    start_date,
    end_date,
    created_by,
    created_at,
    updated_at,
    jsonb_pretty(report_data) as formatted_report_data
FROM saved_reports 
ORDER BY created_at DESC 
LIMIT 5;

-- Count total reports
SELECT COUNT(*) as total_reports FROM saved_reports;

-- Check reports by user
SELECT 
    created_by,
    COUNT(*) as report_count,
    MAX(created_at) as latest_report
FROM saved_reports 
GROUP BY created_by;

-- Check if there are any null values
SELECT 
    COUNT(CASE WHEN title IS NULL THEN 1 END) as null_titles,
    COUNT(CASE WHEN report_data IS NULL THEN 1 END) as null_report_data,
    COUNT(CASE WHEN created_by IS NULL THEN 1 END) as null_created_by,
    COUNT(CASE WHEN created_at IS NULL THEN 1 END) as null_created_at
FROM saved_reports;
