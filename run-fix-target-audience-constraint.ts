
import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'chiakhoathanhcong',
  host: process.env.PGHOST || '42.96.40.138',
  database: process.env.PGDATABASE || 'content',
  port: parseInt(process.env.PGPORT || '5432'),
});

async function fixTargetAudienceConstraint() {
  try {
    console.log('🔧 Fixing target_audience constraint...');
    
    const sqlPath = path.join(__dirname, 'fix-target-audience-constraint.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Target audience constraint fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
  } finally {
    await pool.end();
  }
}

fixTargetAudienceConstraint();
