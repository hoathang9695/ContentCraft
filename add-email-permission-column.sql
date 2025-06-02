
-- Add email permission column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_send_email BOOLEAN DEFAULT false;

-- Set admin users to have email permission by default
UPDATE users SET can_send_email = true WHERE role = 'admin';

-- Set other users to false explicitly
UPDATE users SET can_send_email = false WHERE role != 'admin';
