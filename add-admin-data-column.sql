
-- Add admin_data column to pages table
ALTER TABLE pages ADD COLUMN admin_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN pages.admin_data IS 'Admin information in JSON format: {"id": "...", "page_name": "..."}';
