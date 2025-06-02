
-- Add new columns to support_requests table for feedback functionality
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'support',
ADD COLUMN IF NOT EXISTS feedback_type text,
ADD COLUMN IF NOT EXISTS feature_type text,
ADD COLUMN IF NOT EXISTS detailed_description text,
ADD COLUMN IF NOT EXISTS attachment_url text;

-- Update existing records to have type 'support'
UPDATE support_requests SET type = 'support' WHERE type IS NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN support_requests.type IS 'Type of request: support or feedback';
COMMENT ON COLUMN support_requests.feedback_type IS 'Type of feedback: bug_report, feature_request, complaint, suggestion, other';
COMMENT ON COLUMN support_requests.feature_type IS 'Feature type description';
COMMENT ON COLUMN support_requests.detailed_description IS 'Detailed description of the issue/request';
COMMENT ON COLUMN support_requests.attachment_url IS 'URL to attached file for complaints';
