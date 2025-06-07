
-- Add new columns to support_requests table for verification functionality
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS verification_name text,
ADD COLUMN IF NOT EXISTS phone_number text;

-- Add comment to explain the columns
COMMENT ON COLUMN support_requests.verification_name IS 'Name to be verified for verification requests';
COMMENT ON COLUMN support_requests.phone_number IS 'Phone number for verification requests';
