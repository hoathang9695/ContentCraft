
-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    page_name VARCHAR(255) NOT NULL,
    page_type VARCHAR(100) NOT NULL,
    classification VARCHAR(50) DEFAULT 'new',
    manager_id INTEGER REFERENCES users(id),
    phone_number VARCHAR(20),
    monetization_enabled BOOLEAN DEFAULT false,
    assigned_to_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pages_page_type ON pages(page_type);
CREATE INDEX IF NOT EXISTS idx_pages_classification ON pages(classification);
CREATE INDEX IF NOT EXISTS idx_pages_assigned_to_id ON pages(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_pages_created_at ON pages(created_at);

-- Insert some sample data
INSERT INTO pages (page_name, page_type, classification, phone_number, monetization_enabled, assigned_to_id) VALUES
('Trang Cá Nhân A', 'personal', 'new', '0901234567', false, 1),
('Doanh Nghiệp ABC', 'business', 'potential', '0987654321', true, 2),
('Cộng Đồng XYZ', 'community', 'new', '0912345678', false, 3),
('Trang Kinh Doanh 123', 'business', 'potential', '0923456789', true, 1),
('Nhóm Học Tập', 'community', 'non_potential', '0934567890', false, 2);
