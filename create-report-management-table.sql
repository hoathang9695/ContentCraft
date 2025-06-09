
-- Create report_management table
CREATE TABLE IF NOT EXISTS report_management (
  id SERIAL PRIMARY KEY,
  reported_id VARCHAR(255) NOT NULL, -- ID của đối tượng bị báo cáo
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('user', 'content', 'page', 'group')), -- Loại báo cáo
  reporter_name VARCHAR(255) NOT NULL, -- Tên người báo cáo
  reporter_email VARCHAR(255) NOT NULL, -- Email người báo cáo
  reason VARCHAR(500) NOT NULL, -- Lý do báo cáo
  detailed_reason TEXT, -- Mô tả chi tiết
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')), -- Trạng thái xử lý
  assigned_to_id INTEGER REFERENCES users(id), -- Người được phân công xử lý
  assigned_to_name VARCHAR(255), -- Tên người được phân công (có thể lưu cache)
  assigned_at TIMESTAMP, -- Thời điểm phân công
  response_content TEXT, -- Nội dung phản hồi
  responder_id INTEGER REFERENCES users(id), -- Người phản hồi
  response_time TIMESTAMP, -- Thời gian phản hồi
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- Thời gian tạo
  updated_at TIMESTAMP NOT NULL DEFAULT NOW() -- Thời gian cập nhật
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_report_management_status ON report_management(status);
CREATE INDEX IF NOT EXISTS idx_report_management_report_type ON report_management(report_type);
CREATE INDEX IF NOT EXISTS idx_report_management_assigned_to_id ON report_management(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_report_management_created_at ON report_management(created_at);
CREATE INDEX IF NOT EXISTS idx_report_management_reported_id ON report_management(reported_id);

-- Add comments for documentation
COMMENT ON TABLE report_management IS 'Bảng quản lý các báo cáo vi phạm từ người dùng';
COMMENT ON COLUMN report_management.reported_id IS 'ID của đối tượng bị báo cáo (user, content, page, group)';
COMMENT ON COLUMN report_management.report_type IS 'Loại báo cáo: user, content, page, group';
COMMENT ON COLUMN report_management.reporter_name IS 'Tên người báo cáo';
COMMENT ON COLUMN report_management.reporter_email IS 'Email người báo cáo';
COMMENT ON COLUMN report_management.reason IS 'Lý do báo cáo ngắn gọn';
COMMENT ON COLUMN report_management.detailed_reason IS 'Mô tả chi tiết về vi phạm';
COMMENT ON COLUMN report_management.status IS 'Trạng thái xử lý: pending, processing, completed';
COMMENT ON COLUMN report_management.assigned_to_id IS 'ID người được phân công xử lý';
COMMENT ON COLUMN report_management.response_content IS 'Nội dung phản hồi cho người báo cáo';
