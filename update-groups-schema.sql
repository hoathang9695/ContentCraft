
-- Add categories column
ALTER TABLE groups ADD COLUMN IF NOT EXISTS categories VARCHAR(100);

-- Migrate existing data: move current group_type to categories
UPDATE groups SET categories = group_type;

-- Update group_type to be either 'public' or 'private'
-- Assuming all current groups are 'public' by default
UPDATE groups SET group_type = 'public';

-- Add comment for documentation
COMMENT ON COLUMN groups.categories IS 'Group categories: business, community, education, finance, family, gaming, etc.';
COMMENT ON COLUMN groups.group_type IS 'Group visibility: public or private';
