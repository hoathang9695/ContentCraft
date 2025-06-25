
-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_audience VARCHAR(100) NOT NULL DEFAULT 'all', -- 'all', 'new', 'potential', 'positive', 'non_potential'
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'sent'
  created_by INTEGER NOT NULL REFERENCES users(id), -- Người tạo thông báo
  approved_by INTEGER REFERENCES users(id), -- Người phê duyệt (chỉ Admin)
  sent_by INTEGER REFERENCES users(id), -- Người gửi thông báo (chỉ Admin)
  sent_at TIMESTAMP, -- Thời gian gửi
  approved_at TIMESTAMP, -- Thời gian phê duyệt
  recipient_count INTEGER DEFAULT 0, -- Số lượng người nhận
  success_count INTEGER DEFAULT 0, -- Số lượng gửi thành công
  failure_count INTEGER DEFAULT 0, -- Số lượng gửi thất bại
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_target_audience ON notifications(target_audience);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Bảng quản lý thông báo gửi đến người dùng';
COMMENT ON COLUMN notifications.title IS 'Tiêu đề thông báo';
COMMENT ON COLUMN notifications.content IS 'Nội dung thông báo';
COMMENT ON COLUMN notifications.target_audience IS 'Đối tượng nhận: all, new, potential, positive, non_potential';
COMMENT ON COLUMN notifications.status IS 'Trạng thái: draft (nháp), approved (đã duyệt), sent (đã gửi)';
COMMENT ON COLUMN notifications.created_by IS 'ID người tạo thông báo';
COMMENT ON COLUMN notifications.approved_by IS 'ID người phê duyệt (chỉ Admin)';
COMMENT ON COLUMN notifications.sent_by IS 'ID người gửi thông báo (chỉ Admin)';
COMMENT ON COLUMN notifications.recipient_count IS 'Tổng số người nhận';
COMMENT ON COLUMN notifications.success_count IS 'Số lượng gửi thành công';
COMMENT ON COLUMN notifications.failure_count IS 'Số lượng gửi thất bại';

-- Insert sample data for testing
INSERT INTO notifications (title, content, target_audience, status, created_by, created_at) VALUES
(
  'Thông báo bảo trì hệ thống',
  'Hệ thống sẽ được bảo trì vào ngày 26/06/2025 từ 2:00 - 4:00 sáng. Vui lòng sắp xếp công việc phù hợp.',
  'all',
  'draft',
  1,
  NOW() - INTERVAL '2 hours'
),
(
  'Chào mừng thành viên mới',
  'Chào mừng các thành viên mới gia nhập cộng đồng! Hãy khám phá các tính năng mới và tham gia tích cực.',
  'new',
  'approved',
  1,
  NOW() - INTERVAL '1 day'
),
(
  'Cập nhật tính năng mới',
  'Chúng tôi đã phát hành nhiều tính năng mới thú vị. Hãy cập nhật ứng dụng để trải nghiệm!',
  'positive',
  'sent',
  1,
  NOW() - INTERVAL '3 days'
);
