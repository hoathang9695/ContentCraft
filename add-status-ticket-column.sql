
-- Add status_ticket column to support_requests table for verification functionality
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS status_ticket text;

-- Add comment to explain the column
COMMENT ON COLUMN support_requests.status_ticket IS 'Ticket status for verification requests: approved, rejected, null for non-verification requests';
