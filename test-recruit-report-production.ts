
import { Client } from 'pg';

async function testRecruitReportProduction() {
  const client = new Client({
    host: '42.96.40.138',
    database: 'content',
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    port: 5432,
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database');

    // Test inserting recruit report
    const testData = {
      reported_id: JSON.stringify({
        id: "TEST_RECRUIT_2025",
        name: "Test Recruit Post",
        email: "test@recruit.com"
      }),
      report_type: "recruit",
      reporter_name: JSON.stringify({
        id: "test_reporter",
        name: "Test Reporter",
        reporterEmail: "reporter@test.com"
      }),
      reason: "Test recruit report type",
      detailed_reason: "Testing if recruit type works",
      status: "pending"
    };

    const insertQuery = `
      INSERT INTO report_management (
        reported_id, report_type, reporter_name, reason, detailed_reason, status
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
    `;

    const result = await client.query(insertQuery, [
      testData.reported_id,
      testData.report_type,
      testData.reporter_name,
      testData.reason,
      testData.detailed_reason,
      testData.status
    ]);

    console.log('✅ Successfully inserted recruit report with ID:', result.rows[0].id);
    
    // Clean up test data
    await client.query('DELETE FROM report_management WHERE id = $1', [result.rows[0].id]);
    console.log('🧹 Cleaned up test data');

  } catch (error) {
    console.error('❌ Error testing recruit report:', error);
  } finally {
    await client.end();
  }
}

testRecruitReportProduction();
