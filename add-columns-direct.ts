
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function addVerificationColumns() {
  try {
    console.log('Adding verification columns...');
    
    // Add columns directly using raw SQL
    await db.execute(sql`
      ALTER TABLE support_requests 
      ADD COLUMN IF NOT EXISTS verification_name text,
      ADD COLUMN IF NOT EXISTS phone_number text;
    `);
    
    console.log('✅ Verification columns added successfully!');
    
    // Verify columns exist
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'support_requests' 
      AND column_name IN ('verification_name', 'phone_number');
    `);
    
    console.log('Verification - columns found:', result);
    
  } catch (error) {
    console.error('❌ Error adding columns:', error);
  } finally {
    process.exit(0);
  }
}

addVerificationColumns();
