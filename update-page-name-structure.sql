
-- Update page_name column structure to JSON format
-- First, backup existing data if needed
CREATE TABLE IF NOT EXISTS pages_backup AS SELECT * FROM pages;

-- Update existing pages to use JSON format for page_name
UPDATE pages 
SET page_name = jsonb_build_object(
    'id', COALESCE(id::text, ''), 
    'page_name', COALESCE(page_name, '')
) 
WHERE page_name IS NOT NULL AND page_name != '';

-- For any remaining NULL or empty page_name, set a default structure
UPDATE pages 
SET page_name = jsonb_build_object(
    'id', id::text, 
    'page_name', 'Trang không tên'
) 
WHERE page_name IS NULL OR page_name = '';

-- Verify the update
SELECT id, page_name FROM pages LIMIT 5;
