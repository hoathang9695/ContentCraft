
import { pool } from './server/db';

async function analyzeQueueStatus() {
  console.log('🔍 Analyzing comment queue status...\n');

  try {
    // 1. Overall queue statistics
    const overallStats = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM comment_queues 
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('📊 Overall Queue Statistics:');
    console.table(overallStats.rows);

    // 2. Processing queues that might be stuck
    const stuckProcessing = await pool.query(`
      SELECT 
        session_id,
        external_id,
        total_comments,
        processed_count,
        success_count,
        failure_count,
        created_at,
        started_at,
        updated_at,
        EXTRACT(EPOCH FROM (NOW() - started_at))/3600 as hours_since_started,
        EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_since_updated
      FROM comment_queues 
      WHERE status = 'processing'
      ORDER BY started_at ASC
      LIMIT 20
    `);

    console.log('\n🚨 Processing Queues (potentially stuck):');
    if (stuckProcessing.rows.length === 0) {
      console.log('✅ No processing queues found');
    } else {
      console.table(stuckProcessing.rows.map(row => ({
        session_id: row.session_id.substring(0, 20) + '...',
        external_id: row.external_id,
        total: row.total_comments,
        processed: row.processed_count || 0,
        success: row.success_count || 0,
        failure: row.failure_count || 0,
        hours_processing: Math.round(row.hours_since_started * 10) / 10,
        hours_no_update: Math.round(row.hours_since_updated * 10) / 10
      })));
    }

    // 3. Failed queues analysis
    const failedQueues = await pool.query(`
      SELECT 
        session_id,
        external_id,
        total_comments,
        processed_count,
        success_count,
        failure_count,
        error_info,
        created_at,
        completed_at,
        EXTRACT(EPOCH FROM (NOW() - completed_at))/3600 as hours_since_failed
      FROM comment_queues 
      WHERE status = 'failed'
      ORDER BY completed_at DESC
      LIMIT 10
    `);

    console.log('\n❌ Recent Failed Queues:');
    if (failedQueues.rows.length === 0) {
      console.log('✅ No failed queues found');
    } else {
      console.table(failedQueues.rows.map(row => ({
        session_id: row.session_id.substring(0, 20) + '...',
        external_id: row.external_id,
        total: row.total_comments,
        processed: row.processed_count || 0,
        success: row.success_count || 0,
        failure: row.failure_count || 0,
        hours_ago: Math.round(row.hours_since_failed * 10) / 10,
        error: row.error_info ? row.error_info.substring(0, 50) + '...' : 'No error info'
      })));
    }

    // 4. Inconsistent queues
    const inconsistentQueues = await pool.query(`
      SELECT 
        session_id,
        status,
        total_comments,
        processed_count,
        success_count,
        failure_count,
        (success_count + failure_count) as actual_processed,
        CASE 
          WHEN status = 'completed' AND processed_count < total_comments THEN 'Completed but not all processed'
          WHEN status = 'completed' AND (success_count + failure_count) < total_comments THEN 'Completed but success+failure < total'
          WHEN processed_count > total_comments THEN 'Processed > Total'
          WHEN (success_count + failure_count) > total_comments THEN 'Success+Failure > Total'
          WHEN processed_count != (success_count + failure_count) THEN 'Processed != Success+Failure'
          ELSE 'Other inconsistency'
        END as issue_type,
        created_at,
        updated_at
      FROM comment_queues 
      WHERE 
        (status = 'completed' AND processed_count < total_comments) OR
        (status = 'completed' AND (success_count + failure_count) < total_comments) OR
        (processed_count > total_comments) OR
        (success_count + failure_count > total_comments) OR
        (processed_count != (success_count + failure_count))
      ORDER BY created_at DESC
      LIMIT 15
    `);

    console.log('\n⚠️  Inconsistent Queues:');
    if (inconsistentQueues.rows.length === 0) {
      console.log('✅ No inconsistent queues found');
    } else {
      console.table(inconsistentQueues.rows.map(row => ({
        session_id: row.session_id.substring(0, 20) + '...',
        status: row.status,
        total: row.total_comments,
        processed: row.processed_count || 0,
        success: row.success_count || 0,
        failure: row.failure_count || 0,
        actual: row.actual_processed || 0,
        issue: row.issue_type
      })));
    }

    // 5. Pending queues
    const pendingQueues = await pool.query(`
      SELECT 
        session_id,
        external_id,
        total_comments,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_pending
      FROM comment_queues 
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
    `);

    console.log('\n⏳ Pending Queues:');
    if (pendingQueues.rows.length === 0) {
      console.log('✅ No pending queues found');
    } else {
      console.table(pendingQueues.rows.map(row => ({
        session_id: row.session_id.substring(0, 20) + '...',
        external_id: row.external_id,
        total_comments: row.total_comments,
        hours_pending: Math.round(row.hours_pending * 10) / 10
      })));
    }

    // 6. Summary recommendations
    console.log('\n📋 Summary & Recommendations:');
    
    const totalProcessing = stuckProcessing.rows.length;
    const totalFailed = failedQueues.rows.length;
    const totalInconsistent = inconsistentQueues.rows.length;
    const totalPending = pendingQueues.rows.length;

    if (totalProcessing > 0) {
      console.log(`🚨 ${totalProcessing} queues stuck in processing state`);
      console.log('   Recommendation: Run force cleanup to reset stuck queues');
    }

    if (totalInconsistent > 0) {
      console.log(`⚠️  ${totalInconsistent} queues have data inconsistencies`);
      console.log('   Recommendation: Run fix inconsistent queues');
    }

    if (totalFailed > 0) {
      console.log(`❌ ${totalFailed} recent failed queues found`);
      console.log('   Recommendation: Review error messages and consider retry');
    }

    if (totalPending > 0) {
      console.log(`⏳ ${totalPending} queues waiting to be processed`);
      console.log('   Info: These should be processed automatically');
    }

    console.log('\n🔧 Available Actions:');
    console.log('1. Force cleanup stuck queues: POST /api/comment-queues/force-cleanup');
    console.log('2. Fix inconsistent queues: POST /api/comment-queues/fix-inconsistent');
    console.log('3. Check processor status: GET /api/comment-queues/processor/status');
    console.log('4. Manual cleanup old queues: DELETE /api/comment-queues/cleanup');

  } catch (error) {
    console.error('❌ Error analyzing queue status:', error);
  } finally {
    await pool.end();
  }
}

analyzeQueueStatus();
