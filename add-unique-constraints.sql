
-- Add unique constraint for support requests to prevent duplicates
ALTER TABLE support_requests 
ADD CONSTRAINT unique_support_request 
UNIQUE (email, subject, content, full_name);

-- Add unique constraint for real users
ALTER TABLE real_users 
ADD CONSTRAINT unique_real_user_email 
UNIQUE (email);
