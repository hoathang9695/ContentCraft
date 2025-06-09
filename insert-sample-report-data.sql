
-- Insert sample data for report_management table
INSERT INTO report_management (
  reported_id, 
  report_type, 
  reporter_name, 
  reporter_email, 
  reason, 
  detailed_reason, 
  status, 
  assigned_to_id, 
  assigned_to_name
) VALUES 
(
  'USER_123456', 
  'user', 
  'Nguyễn Văn A', 
  'reporter1@example.com', 
  'Spam', 
  'Người dùng này liên tục gửi tin nhắn spam và nội dung không phù hợp', 
  'pending', 
  NULL, 
  NULL
),
(
  'POST_789012', 
  'content', 
  'Trần Thị B', 
  'reporter2@example.com', 
  'Nội dung không phù hợp', 
  'Bài viết chứa hình ảnh và nội dung không phù hợp với cộng đồng', 
  'processing', 
  1, 
  'Administrator'
),
(
  'PAGE_345678', 
  'page', 
  'Lê Văn C', 
  'reporter3@example.com', 
  'Lừa đảo', 
  'Trang này đang lừa đảo người dùng bằng cách bán hàng giả', 
  'completed', 
  1, 
  'Administrator'
),
(
  'GROUP_901234', 
  'group', 
  'Phạm Thị D', 
  'reporter4@example.com', 
  'Nội dung độc hại', 
  'Nhóm chia sẻ nội dung bạo lực và độc hại', 
  'pending', 
  NULL, 
  NULL
),
(
  'USER_567890', 
  'user', 
  'Hoàng Văn E', 
  'reporter5@example.com', 
  'Quấy rối', 
  'Người dùng này liên tục quấy rối và đe dọa các thành viên khác', 
  'processing', 
  2, 
  'Nguyễn Thị Khuyên'
);
