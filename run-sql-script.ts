` tags.

```typescript
import { pool } from './server/db.js';
import fs from 'fs';

async function runSQLScript() {
  try {
    console.log('Updating report_management table schema...');

    // Read and execute the schema update script
    const updateSchemaSQL = fs.readFileSync('./update-report-management-schema.sql', 'utf8');

    console.log('Executing schema update...');
    await pool.query(updateSchemaSQL);
    console.log('✅ Schema updated successfully');

    // Read and execute the sample data insert script
    const insertDataSQL = fs.readFileSync('./insert-sample-report-data.sql', 'utf8');

    console.log('Inserting sample data...');
    await pool.query(insertDataSQL);
    console.log('✅ Sample data inserted successfully');

    // Verify the changes
    const checkData = await pool.query(`
      SELECT id, reported_id, reporter_name, report_type, reason, status
      FROM report_management 
      ORDER BY created_at DESC 
      LIMIT 3
    `);

    console.log('✅ Verification - Sample data from updated table:');
    checkData.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id}`);
      console.log(`   Reported ID: ${JSON.stringify(row.reported_id)}`);
      console.log(`   Reporter: ${JSON.stringify(row.reporter_name)}`);
      console.log(`   Type: ${row.report_type}`);
      console.log(`   Reason: ${row.reason}`);
      console.log(`   Status: ${row.status}`);
      console.log('---');
    });

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
    console.log('🎉 All operations completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });