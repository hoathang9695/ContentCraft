
-- Add unique constraint for support requests to prevent duplicates (content only)
ALTER TABLE support_requests 
ADD CONSTRAINT unique_support_request_content 
UNIQUE (content);

-- Add unique constraint for real users
ALTER TABLE real_users 
ADD CONSTRAINT unique_real_user_email 
UNIQUE (email);
