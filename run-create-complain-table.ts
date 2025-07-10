
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  host: process.env.DB_HOST || '42.96.40.138',
  database: process.env.DB_NAME || 'content',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'LJhZWd2UQGhXrr3r',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runCreateComplainTable() {
  try {
    console.log('🚀 Connecting to database...');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'create-complain-management-table.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📄 SQL Content:');
    console.log(sqlContent);
    
    // Execute the SQL
    const result = await pool.query(sqlContent);
    
    console.log('✅ Successfully created complain_management table!');
    console.log('Result:', result);
    
    // Verify table was created
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'complain_management'
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('✅ Table complain_management verified in database');
    } else {
      console.log('❌ Table complain_management not found after creation');
    }
    
    // Show table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'complain_management'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table structure:');
    console.table(tableInfo.rows);
    
  } catch (error) {
    console.error('❌ Error creating complain_management table:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
runCreateComplainTable();
