
-- Tạo bảng notifications với error handling
DO $$
BEGIN
    -- Drop table if exists to ensure clean state
    DROP TABLE IF EXISTS notifications CASCADE;
    
    -- Create notifications table
    CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        target_audience VARCHAR(100) NOT NULL DEFAULT 'all',
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        created_by INTEGER NOT NULL,
        approved_by INTEGER,
        sent_by INTEGER,
        sent_at TIMESTAMP,
        approved_at TIMESTAMP,
        recipient_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Add foreign key constraints if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by) REFERENCES users(id);
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_approved_by FOREIGN KEY (approved_by) REFERENCES users(id);
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_sent_by FOREIGN KEY (sent_by) REFERENCES users(id);
    END IF;

    -- Create indexes
    CREATE INDEX idx_notifications_status ON notifications(status);
    CREATE INDEX idx_notifications_target_audience ON notifications(target_audience);
    CREATE INDEX idx_notifications_created_by ON notifications(created_by);
    CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);
    CREATE INDEX idx_notifications_created_at ON notifications(created_at);

    -- Insert sample data
    INSERT INTO notifications (title, content, target_audience, status, created_by, created_at) VALUES
    ('Thông báo bảo trì hệ thống', 'Hệ thống sẽ được bảo trì vào ngày 26/06/2025 từ 2:00 - 4:00 sáng. Vui lòng sắp xếp công việc phù hợp.', 'all', 'draft', 1, NOW() - INTERVAL '2 hours'),
    ('Chào mừng thành viên mới', 'Chào mừng các thành viên mới gia nhập cộng đồng! Hãy khám phá các tính năng mới và tham gia tích cực.', 'new', 'approved', 1, NOW() - INTERVAL '1 day'),
    ('Cập nhật tính năng mới', 'Chúng tôi đã phát hành nhiều tính năng mới thú vị. Hãy cập nhật ứng dụng để trải nghiệm!', 'positive', 'sent', 1, NOW() - INTERVAL '3 days');

    RAISE NOTICE 'Notifications table created successfully with sample data!';
END
$$;
