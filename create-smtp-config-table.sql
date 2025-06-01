
-- Create SMTP configuration table
CREATE TABLE IF NOT EXISTS smtp_config (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
    port INTEGER NOT NULL DEFAULT 587,
    secure BOOLEAN NOT NULL DEFAULT false,
    "user" VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    from_name VARCHAR(255) NOT NULL DEFAULT 'EMSO System',
    from_email VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration if not exists
INSERT INTO smtp_config (host, port, secure, "user", password, from_name, from_email, is_active)
SELECT 'smtp.gmail.com', 587, false, '', '', 'EMSO System', '', true
WHERE NOT EXISTS (SELECT 1 FROM smtp_config WHERE is_active = true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_smtp_config_active ON smtp_config(is_active);

-- Add comment for documentation
COMMENT ON TABLE smtp_config IS 'SMTP email configuration settings';
