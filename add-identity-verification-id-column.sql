
-- Add identity_verification_id column to support_requests table
ALTER TABLE support_requests 
ADD COLUMN identity_verification_id INTEGER;

-- Add comment for the new column
COMMENT ON COLUMN support_requests.identity_verification_id IS 'ID xác minh danh tính từ hệ thống bên ngoài';
