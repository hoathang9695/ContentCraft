
-- Tạo bảng infringing_contents
CREATE TABLE IF NOT EXISTS infringing_contents (
    id SERIAL PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    assigned_to_id INTEGER REFERENCES users(id),
    processing_time TIMESTAMP,
    violation_description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tạo chỉ mục để tăng tốc độ truy vấn
CREATE INDEX IF NOT EXISTS idx_infringing_contents_external_id ON infringing_contents(external_id);
CREATE INDEX IF NOT EXISTS idx_infringing_contents_assigned_to_id ON infringing_contents(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_infringing_contents_status ON infringing_contents(status);
CREATE INDEX IF NOT EXISTS idx_infringing_contents_created_at ON infringing_contents(created_at);

-- Thêm ràng buộc cho external_id
ALTER TABLE infringing_contents 
ADD CONSTRAINT unique_external_id UNIQUE (external_id);

COMMENT ON TABLE infringing_contents IS 'Bảng quản lý nội dung vi phạm quy định';
COMMENT ON COLUMN infringing_contents.external_id IS 'ID nội dung từ service bên ngoài';
COMMENT ON COLUMN infringing_contents.assigned_to_id IS 'ID người được phân công xử lý';
COMMENT ON COLUMN infringing_contents.processing_time IS 'Thời gian xử lý nội dung vi phạm';
COMMENT ON COLUMN infringing_contents.violation_description IS 'Mô tả chi tiết về vi phạm';
COMMENT ON COLUMN infringing_contents.status IS 'Trạng thái xử lý: pending, processing, completed';
