
import { pool } from './server/db';

async function checkFailedQueues() {
  const queueIds = [
    'queue_1750067617061_38ejk0bm4',
    'queue_1750066723037_n8uqlygpv', 
    'queue_1750066473565_qaiwvmfvd',
    'queue_1750064122424_kpoifyfma',
    'queue_1750048924131_3g8yhqq1q'
  ];

  console.log('🔍 Checking failed queues...\n');

  for (const sessionId of queueIds) {
    try {
      const result = await pool.query(`
        SELECT 
          session_id,
          external_id,
          status,
          total_comments,
          processed_count,
          success_count,
          failure_count,
          current_comment_index,
          error_info,
          selected_gender,
          created_at,
          started_at,
          completed_at,
          updated_at,
          CASE 
            WHEN comments IS NOT NULL THEN jsonb_array_length(comments::jsonb)
            ELSE 0 
          END as actual_comments_count
        FROM comment_queues 
        WHERE session_id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        console.log(`❌ Queue ${sessionId} not found\n`);
        continue;
      }

      const queue = result.rows[0];
      console.log(`📋 Queue: ${sessionId}`);
      console.log(`   External ID: ${queue.external_id}`);
      console.log(`   Status: ${queue.status}`);
      console.log(`   Total Comments: ${queue.total_comments} (Actual: ${queue.actual_comments_count})`);
      console.log(`   Processed: ${queue.processed_count || 0}`);
      console.log(`   Success: ${queue.success_count || 0}`);
      console.log(`   Failure: ${queue.failure_count || 0}`);
      console.log(`   Current Index: ${queue.current_comment_index || 0}`);
      console.log(`   Selected Gender: ${queue.selected_gender}`);
      console.log(`   Created: ${queue.created_at}`);
      console.log(`   Started: ${queue.started_at || 'Not started'}`);
      console.log(`   Completed: ${queue.completed_at || 'Not completed'}`);
      console.log(`   Updated: ${queue.updated_at}`);
      
      if (queue.error_info) {
        console.log(`   ❌ Error Info:`);
        console.log(`      ${queue.error_info}`);
      }

      // Calculate processing time if started
      if (queue.started_at && queue.completed_at) {
        const startTime = new Date(queue.started_at);
        const endTime = new Date(queue.completed_at);
        const processingMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        console.log(`   ⏱️ Processing Time: ${processingMinutes} minutes`);
      }

      // Check for inconsistencies
      const issues = [];
      if (queue.total_comments !== queue.actual_comments_count) {
        issues.push(`Total comments mismatch: ${queue.total_comments} vs ${queue.actual_comments_count}`);
      }
      if ((queue.success_count || 0) + (queue.failure_count || 0) !== (queue.processed_count || 0)) {
        issues.push(`Processed count mismatch: ${queue.processed_count} vs ${(queue.success_count || 0) + (queue.failure_count || 0)}`);
      }
      if (queue.status === 'failed' && queue.processed_count === queue.total_comments) {
        issues.push(`Marked as failed but all comments processed`);
      }
      
      if (issues.length > 0) {
        console.log(`   ⚠️ Issues Found:`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      }

      console.log(''); // Empty line for readability
    } catch (error) {
      console.error(`❌ Error checking queue ${sessionId}:`, error);
    }
  }

  // Get summary of all failed queues
  console.log('\n📊 Summary of all failed queues:');
  try {
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(*) as total_failed,
        COUNT(CASE WHEN error_info LIKE '%timeout%' THEN 1 END) as timeout_failures,
        COUNT(CASE WHEN error_info LIKE '%Rate limited%' THEN 1 END) as rate_limit_failures,
        COUNT(CASE WHEN error_info LIKE '%Authentication error%' THEN 1 END) as auth_failures,
        COUNT(CASE WHEN error_info LIKE '%Server error%' THEN 1 END) as server_failures,
        COUNT(CASE WHEN error_info LIKE '%Processing incomplete%' THEN 1 END) as incomplete_failures,
        COUNT(CASE WHEN error_info IS NULL OR error_info = '' THEN 1 END) as no_error_info
      FROM comment_queues 
      WHERE status = 'failed'
    `);

    const summary = summaryResult.rows[0];
    console.log(`   Total failed queues: ${summary.total_failed}`);
    console.log(`   Timeout failures: ${summary.timeout_failures}`);
    console.log(`   Rate limit failures: ${summary.rate_limit_failures}`);
    console.log(`   Auth failures: ${summary.auth_failures}`);
    console.log(`   Server failures: ${summary.server_failures}`);
    console.log(`   Incomplete processing: ${summary.incomplete_failures}`);
    console.log(`   No error info: ${summary.no_error_info}`);
  } catch (error) {
    console.error('❌ Error getting summary:', error);
  }

  await pool.end();
}

checkFailedQueues().catch(console.error);
