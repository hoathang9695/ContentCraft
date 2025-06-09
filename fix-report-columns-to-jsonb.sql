
-- Fix report_management table columns to use JSONB type
-- First, backup the current data
CREATE TABLE IF NOT EXISTS report_management_backup AS SELECT * FROM report_management;

-- Drop existing data (we'll restore it properly)
DELETE FROM report_management;

-- Change column types to JSONB
ALTER TABLE report_management 
ALTER COLUMN reported_id TYPE JSONB USING reported_id::JSONB,
ALTER COLUMN reporter_name TYPE JSONB USING reporter_name::JSONB;

-- Add NOT NULL constraints
ALTER TABLE report_management 
ALTER COLUMN reported_id SET NOT NULL,
ALTER COLUMN reporter_name SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN report_management.reported_id IS 'ID của đối tượng bị báo cáo (JSON format: {"id":"...", "target_id":"..."})';
COMMENT ON COLUMN report_management.reporter_name IS 'Tên người báo cáo (JSON format: {"id":"...", "name":"..."})';

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'report_management' 
AND column_name IN ('reported_id', 'reporter_name')
ORDER BY column_name;
