
-- Add TTL column to list_trends table
ALTER TABLE list_trends 
ADD COLUMN ttl INTEGER DEFAULT 3600 CHECK (ttl > 0);

-- Add comment for the column
COMMENT ON COLUMN list_trends.ttl IS 'Time to live in seconds for Redis cache (default: 3600 = 1 hour)';

-- Create index for TTL column if needed for queries
CREATE INDEX IF NOT EXISTS idx_list_trends_ttl ON list_trends(ttl);
