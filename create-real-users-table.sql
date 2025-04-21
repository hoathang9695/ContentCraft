
-- Drop existing table if exists
DROP TABLE IF EXISTS real_users CASCADE;

-- Create real_users table with standardized fields
CREATE TABLE real_users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL, -- Giới hạn độ dài tên thực tế
  email VARCHAR(255) NOT NULL UNIQUE, -- Giới hạn độ dài email theo chuẩn RFC 5321
  verified BOOLEAN NOT NULL DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE, -- Thêm timezone để lưu thời gian chính xác
  assigned_to_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_real_users_email ON real_users(email);
CREATE INDEX idx_real_users_verified ON real_users(verified);
CREATE INDEX idx_real_users_assigned_to ON real_users(assigned_to_id);

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_real_users_updated_at
    BEFORE UPDATE ON real_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
