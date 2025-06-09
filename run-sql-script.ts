import { pool } from './server/db.js';
import fs from 'fs';

async function runSQLScript() {
  try {
    console.log('Reading SQL script...');
    const sqlScript = fs.readFileSync('./create-report-management-table.sql', 'utf8');

    console.log('Executing SQL script...');
    const result = await pool.query(sqlScript);

    console.log('✅ SQL script executed successfully:', result);
    console.log('🎉 Report management table created successfully!');

  } catch (error) {
    console.error('❌ Error executing SQL script:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runSQLScript();