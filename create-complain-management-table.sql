
-- Create complain_management table
CREATE TABLE IF NOT EXISTS complain_management (
  id SERIAL PRIMARY KEY,
  complainer_info JSONB NOT NULL, -- Thông tin người khiếu nại {id, name, email}
  activity_id VARCHAR(255) NOT NULL, -- ID của đối tượng bị khiếu nại
  activity_class_name VARCHAR(100) NOT NULL, -- Loại đối tượng (Account, etc.)
  complain_type VARCHAR(50) NOT NULL, -- user_complain, page_complain, post_complain, group_complain, event_complain, song_complain, product_complain, project_complain, recruit_complain
  reason VARCHAR(500), -- Lý do khiếu nại (có thể null)
  descriptions TEXT, -- Mô tả chi tiết
  media_attachment JSONB, -- File đính kèm (array of links)
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')), -- Trạng thái xử lý
  assigned_to_id INTEGER REFERENCES users(id), -- Người được phân công xử lý
  assigned_to_name VARCHAR(255), -- Tên người được phân công
  assigned_at TIMESTAMP, -- Thời điểm phân công
  response_content TEXT, -- Nội dung phản hồi
  responder_id INTEGER REFERENCES users(id), -- Người phản hồi
  response_time TIMESTAMP, -- Thời gian phản hồi
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_complain_management_status ON complain_management(status);
CREATE INDEX IF NOT EXISTS idx_complain_management_assigned_to ON complain_management(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_complain_management_created_at ON complain_management(created_at);
CREATE INDEX IF NOT EXISTS idx_complain_management_activity_id ON complain_management(activity_id);
CREATE INDEX IF NOT EXISTS idx_complain_management_complain_type ON complain_management(complain_type);
