
-- Create real_users table
CREATE TABLE IF NOT EXISTS real_users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  verified BOOLEAN NOT NULL DEFAULT false,
  last_login TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_real_users_email ON real_users(email);

-- Create index on verified status for filtering
CREATE INDEX IF NOT EXISTS idx_real_users_verified ON real_users(verified);
