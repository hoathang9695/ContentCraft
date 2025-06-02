
-- Add email permission column to users table
ALTER TABLE users ADD COLUMN can_send_email BOOLEAN DEFAULT false;

-- Set admin users to have email permission by default
UPDATE users SET can_send_email = true WHERE role = 'admin';

-- You can manually set email permission for specific users
-- UPDATE users SET can_send_email = true WHERE id = 1;
