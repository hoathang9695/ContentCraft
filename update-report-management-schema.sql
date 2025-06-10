
-- Update report_management table structure to use JSONB
-- First, add new JSONB columns
ALTER TABLE report_management 
ADD COLUMN reported_id_new JSONB,
ADD COLUMN reporter_name_new JSONB;

-- Update existing data to JSON format
-- For reported_id: convert string to JSON with id and target_id
UPDATE report_management 
SET reported_id_new = jsonb_build_object(
  'id', reported_id,
  'target_id', reported_id || '_target'
);

-- For reporter_name: convert string to JSON with id and name
UPDATE report_management 
SET reporter_name_new = jsonb_build_object(
  'id', 'user_' || id::text,
  'name', reporter_name
);

-- Drop old columns and rename new ones
ALTER TABLE report_management DROP COLUMN reported_id;
ALTER TABLE report_management DROP COLUMN reporter_name;

ALTER TABLE report_management RENAME COLUMN reported_id_new TO reported_id;
ALTER TABLE report_management RENAME COLUMN reporter_name_new TO reporter_name;

-- Add NOT NULL constraints
ALTER TABLE report_management ALTER COLUMN reported_id SET NOT NULL;
ALTER TABLE report_management ALTER COLUMN reporter_name SET NOT NULL;

-- Update comments
COMMENT ON COLUMN report_management.reported_id IS 'ID của đối tượng bị báo cáo (JSON format: {"id":"...", "target_id":"..."})';
COMMENT ON COLUMN report_management.reporter_name IS 'Tên người báo cáo (JSON format: {"id":"...", "name":"..."})';
