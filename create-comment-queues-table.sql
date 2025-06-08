
CREATE TABLE IF NOT EXISTS comment_queues (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  comments JSONB NOT NULL,
  selected_gender VARCHAR(50) DEFAULT 'all',
  user_id INTEGER REFERENCES users(id),
  total_comments INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  current_comment_index INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, paused
  error_info TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comment_queues_status ON comment_queues(status);
CREATE INDEX IF NOT EXISTS idx_comment_queues_external_id ON comment_queues(external_id);
CREATE INDEX IF NOT EXISTS idx_comment_queues_user_id ON comment_queues(user_id);
