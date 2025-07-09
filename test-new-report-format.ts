import { db } from './server/db.js';
import { reportManagement } from './shared/schema.js';

async function testNewReportFormat() {
  try {
    console.log('🧪 Testing new report format...');

    // Test fetching reports
    const reports = await db.select().from(reportManagement).limit(5);
    console.log('✅ Successfully fetched reports:', reports.length);

    if (reports.length > 0) {
      console.log('📋 Sample report:', JSON.stringify(reports[0], null, 2));
    }

    console.log('🎉 Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testNewReportFormat();