
import { db } from './server/db';
import { supportRequests } from './shared/schema';
import { sql } from 'drizzle-orm';

async function cleanupDuplicateSupportRequests() {
  try {
    console.log('🧹 Starting cleanup of duplicate support requests...');

    // Find and delete duplicates, keeping only the first occurrence
    const result = await db.execute(sql`
      DELETE FROM ${supportRequests} 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM ${supportRequests} 
        GROUP BY email, subject, content, full_name
      )
    `);

    console.log(`✅ Cleaned up duplicate support requests. Rows affected: ${result.rowCount}`);

    // Show remaining count
    const remaining = await db.select({ count: sql`count(*)` }).from(supportRequests);
    console.log(`📊 Remaining support requests: ${remaining[0].count}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupDuplicateSupportRequests()
  .then(() => {
    console.log('🎉 Cleanup completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Cleanup failed:', err);
    process.exit(1);
  });
