
-- Create list_trends table for trend management feature
CREATE TABLE IF NOT EXISTS list_trends (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_audience VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'new', 'potential', 'positive', 'negative')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'completed', 'cancelled')),
    created_by INTEGER NOT NULL,
    sent_at TIMESTAMP,
    recipient_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Redis data fields
    redis_id VARCHAR(255),
    redis_s VARCHAR(255),
    redis_a VARCHAR(255),
    redis_g VARCHAR(255),
    redis_k VARCHAR(255),
    redis_l VARCHAR(255),
    redis_r VARCHAR(255)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_list_trends_status ON list_trends(status);
CREATE INDEX IF NOT EXISTS idx_list_trends_created_by ON list_trends(created_by);
CREATE INDEX IF NOT EXISTS idx_list_trends_created_at ON list_trends(created_at);

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_list_trends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_list_trends_updated_at
    BEFORE UPDATE ON list_trends
    FOR EACH ROW
    EXECUTE FUNCTION update_list_trends_updated_at();
