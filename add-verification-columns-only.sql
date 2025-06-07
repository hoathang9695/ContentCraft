
-- Simple script to add verification columns only
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS verification_name text,
ADD COLUMN IF NOT EXISTS phone_number text;
