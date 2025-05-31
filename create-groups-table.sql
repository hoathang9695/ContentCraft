
-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    group_name JSONB NOT NULL,
    group_type VARCHAR(100) NOT NULL,
    classification VARCHAR(50) DEFAULT 'new',
    admin_data JSONB,
    phone_number VARCHAR(20),
    monetization_enabled BOOLEAN DEFAULT false,
    assigned_to_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_group_type ON groups(group_type);
CREATE INDEX IF NOT EXISTS idx_groups_classification ON groups(classification);
CREATE INDEX IF NOT EXISTS idx_groups_assigned_to_id ON groups(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON groups(created_at);
