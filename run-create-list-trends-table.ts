
import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const { Pool } = pg;

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'chiakhoathanhcong',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'content',
  port: parseInt(process.env.PGPORT || '5432'),
});

async function createListTrendsTable() {
  try {
    console.log('🔧 Creating list_trends table...');
    
    const sqlPath = path.join(__dirname, 'create-list-trends-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ list_trends table created successfully!');
    
    // Verify table creation
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'list_trends' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table structure:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ Error creating list_trends table:', error);
  } finally {
    await pool.end();
  }
}

createListTrendsTable();
