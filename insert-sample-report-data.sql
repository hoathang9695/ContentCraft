
-- Clear existing test data
DELETE FROM report_management;

-- Insert real report data
INSERT INTO report_management (
  reported_id, 
  report_type, 
  reporter_name, 
  reporter_email, 
  reason, 
  detailed_reason, 
  status, 
  assigned_to_id, 
  assigned_to_name,
  assigned_at,
  response_content,
  responder_id,
  response_time,
  created_at,
  updated_at
) VALUES 
-- Báo cáo người dùng spam
(
  '114652263781752445', 
  'user', 
  'Nguyễn Văn Hưng', 
  'hung.nguyen@gmail.com', 
  'Spam tin nhắn', 
  'Người dùng zcng7ztfsy liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác trong hệ thống. Nội dung tin nhắn không phù hợp và gây phiền toái.', 
  'processing', 
  1, 
  'Administrator',
  '2025-06-08T10:30:00.000Z',
  NULL,
  NULL,
  NULL,
  '2025-06-08T09:15:00.000Z',
  '2025-06-08T10:30:00.000Z'
),
-- Báo cáo trang vi phạm bản quyền
(
  'PAGE_123789456', 
  'page', 
  'Trần Thị Mai', 
  'mai.tran@company.vn', 
  'Vi phạm bản quyền', 
  'Trang này đăng tải nhiều hình ảnh và video có bản quyền mà không có sự cho phép của chủ sở hữu. Đây là vi phạm nghiêm trọng về bản quyền.', 
  'pending', 
  NULL, 
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2025-06-09T08:45:00.000Z',
  '2025-06-09T08:45:00.000Z'
),
-- Báo cáo nhóm chia sẻ nội dung độc hại
(
  'GROUP_987654321', 
  'group', 
  'Lê Minh Tuấn', 
  'tuan.le@edu.vn', 
  'Nội dung độc hại', 
  'Nhóm này thường xuyên chia sẻ các nội dung có tính chất bạo lực, kích động thù địch giữa các nhóm người. Rất có hại cho cộng đồng, đặc biệt là trẻ em.', 
  'completed', 
  2, 
  'Nguyễn Thị Khuyên',
  '2025-06-07T14:20:00.000Z',
  'Chúng tôi đã xem xét báo cáo của bạn về nhóm này. Sau khi kiểm tra, chúng tôi đã xóa các nội dung vi phạm và cảnh báo quản trị viên nhóm. Cảm ơn bạn đã báo cáo.',
  2,
  '2025-06-08T16:45:00.000Z',
  '2025-06-07T13:30:00.000Z',
  '2025-06-08T16:45:00.000Z'
),
-- Báo cáo bài viết lừa đảo
(
  'POST_456123789', 
  'content', 
  'Phạm Đức Anh', 
  'anh.pham@business.com', 
  'Lừa đảo tài chính', 
  'Bài viết này quảng cáo các gói đầu tư với lợi nhuận cao bất thường, có dấu hiệu lừa đảo. Nhiều người đã bị mất tiền sau khi tham gia theo hướng dẫn trong bài viết này.', 
  'processing', 
  1, 
  'Administrator',
  '2025-06-09T09:00:00.000Z',
  NULL,
  NULL,
  NULL,
  '2025-06-09T07:20:00.000Z',
  '2025-06-09T09:00:00.000Z'
),
-- Báo cáo người dùng quấy rối
(
  '114648410456841168', 
  'user', 
  'Hoàng Thị Lan', 
  'lan.hoang@office.vn', 
  'Quấy rối tình dục', 
  'Người dùng Le Ngoc liên tục gửi tin nhắn có nội dung quấy rối tình dục, gửi hình ảnh không phù hợp đến tôi và nhiều người dùng nữ khác. Hành vi này cần được xử lý nghiêm khắc.', 
  'pending', 
  NULL, 
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2025-06-09T11:15:00.000Z',
  '2025-06-09T11:15:00.000Z'
),
-- Báo cáo trang bán hàng giả
(
  'PAGE_789456123', 
  'page', 
  'Vũ Thành Long', 
  'long.vu@consumer.org', 
  'Bán hàng giả mạo', 
  'Trang này bán các sản phẩm điện tử với thương hiệu giả mạo, giá rẻ bất thường. Nhiều khách hàng đã mua hàng nhưng không nhận được sản phẩm hoặc nhận được hàng kém chất lượng.', 
  'completed', 
  1, 
  'Administrator',
  '2025-06-06T16:30:00.000Z',
  'Cảm ơn báo cáo của bạn. Chúng tôi đã xác minh thông tin và đã đình chỉ hoạt động của trang này. Các sản phẩm vi phạm đã được gỡ bỏ và tài khoản chủ trang đã bị khóa vĩnh viễn.',
  1,
  '2025-06-07T10:15:00.000Z',
  '2025-06-06T14:45:00.000Z',
  '2025-06-07T10:15:00.000Z'
),
-- Báo cáo nhóm spam
(
  'GROUP_321654987', 
  'group', 
  'Đỗ Văn Hải', 
  'hai.do@tech.vn', 
  'Spam quảng cáo', 
  'Nhóm này được tạo ra chỉ để spam các tin nhắn quảng cáo sản phẩm. Mỗi ngày có hàng trăm tin nhắn quảng cáo được gửi, gây phiền toái cho thành viên.', 
  'processing', 
  2, 
  'Nguyễn Thị Khuyên',
  '2025-06-08T15:45:00.000Z',
  NULL,
  NULL,
  NULL,
  '2025-06-08T14:20:00.000Z',
  '2025-06-08T15:45:00.000Z'
),
-- Báo cáo bài viết phát tán tin giả
(
  'POST_159753486', 
  'content', 
  'Bùi Thị Hương', 
  'huong.bui@health.gov.vn', 
  'Tin giả về sức khỏe', 
  'Bài viết này chia sẻ thông tin sai lệch về việc điều trị COVID-19 bằng các phương pháp dân gian không có cơ sở khoa học. Điều này có thể gây nguy hiểm cho sức khỏe cộng đồng.', 
  'pending', 
  NULL, 
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2025-06-09T10:30:00.000Z',
  '2025-06-09T10:30:00.000Z'
);
