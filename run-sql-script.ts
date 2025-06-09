
import { pool } from './server/db.js';
import fs from 'fs';

async function runSQLScript() {
  try {
    console.log('Creating report_management table...');
    
    // Create the table directly with SQL
    const createTableSQL = `
      -- Create report_management table
      CREATE TABLE IF NOT EXISTS report_management (
        id SERIAL PRIMARY KEY,
        reported_id VARCHAR(255) NOT NULL,
        report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('user', 'content', 'page', 'group')),
        reporter_name VARCHAR(255) NOT NULL,
        reporter_email VARCHAR(255) NOT NULL,
        reason VARCHAR(500) NOT NULL,
        detailed_reason TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
        assigned_to_id INTEGER REFERENCES users(id),
        assigned_to_name VARCHAR(255),
        assigned_at TIMESTAMP,
        response_content TEXT,
        responder_id INTEGER REFERENCES users(id),
        response_time TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_report_management_status ON report_management(status);
      CREATE INDEX IF NOT EXISTS idx_report_management_report_type ON report_management(report_type);
      CREATE INDEX IF NOT EXISTS idx_report_management_assigned_to_id ON report_management(assigned_to_id);
      CREATE INDEX IF NOT EXISTS idx_report_management_created_at ON report_management(created_at);
      CREATE INDEX IF NOT EXISTS idx_report_management_reported_id ON report_management(reported_id);

      -- Add comments for documentation
      COMMENT ON TABLE report_management IS 'Bảng quản lý các báo cáo vi phạm từ người dùng';
      COMMENT ON COLUMN report_management.reported_id IS 'ID của đối tượng bị báo cáo (user, content, page, group)';
      COMMENT ON COLUMN report_management.report_type IS 'Loại báo cáo: user, content, page, group';
    `;

    console.log('Executing SQL script...');
    const result = await pool.query(createTableSQL);

    console.log('✅ SQL script executed successfully:', result);
    
    // Verify table creation
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'report_management'
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('🎉 Report management table created and verified successfully!');
    } else {
      console.log('❌ Table was not created');
    }

    // Show all tables
    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 All tables in database:', allTables.rows.map(row => row.table_name));

  } catch (error) {
    console.error('❌ Error executing SQL script:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runSQLScript();
