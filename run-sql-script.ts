import { pool } from './server/db.js';
import fs from 'fs';

async function runSQLScript() {
  try {
    // Get the SQL file from command line arguments
    const sqlFile = process.argv[2];

    if (!sqlFile) {
      console.error('❌ Please provide a SQL file name as argument');
      console.log('Usage: npx tsx run-sql-script.ts <sql-file>');
      process.exit(1);
    }

    if (!fs.existsSync(sqlFile)) {
      console.error(`❌ SQL file '${sqlFile}' not found`);
      process.exit(1);
    }

    console.log(`Running SQL script: ${sqlFile}`);

    // Read and execute the SQL script
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('Executing SQL...');
    await pool.query(sqlContent);
    console.log('✅ SQL script executed successfully');

  } catch (error) {
    console.error('❌ Error running SQL script:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the script
runSQLScript()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });