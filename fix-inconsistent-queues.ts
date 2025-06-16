
import { pool } from './server/db';

async function fixInconsistentQueues() {
  const queueIds = [
    'queue_1750067617061_38ejk0bm4',
    'queue_1750066723037_n8uqlygpv', 
    'queue_1750066473565_qaiwvmfvd',
    'queue_1750064122424_kpoifyfma',
    'queue_1750048924131_3g8yhqq1q'
  ];

  console.log('🔧 Fixing inconsistent failed queues...\n');

  for (const sessionId of queueIds) {
    try {
      // Get current queue state
      const result = await pool.query(`
        SELECT 
          session_id,
          external_id,
          total_comments,
          processed_count,
          success_count,
          failure_count,
          status,
          error_info,
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
      const totalProcessed = (queue.success_count || 0) + (queue.failure_count || 0);
      
      console.log(`📋 Analyzing Queue: ${sessionId}`);
      console.log(`   Current Status: ${queue.status}`);
      console.log(`   Total Comments: ${queue.total_comments}`);
      console.log(`   Success: ${queue.success_count || 0}, Failure: ${queue.failure_count || 0}`);
      console.log(`   Total Processed: ${totalProcessed}`);
      console.log(`   Processed Count: ${queue.processed_count || 0}`);
      
      // Check if this queue should actually be marked as completed
      const shouldBeCompleted = (
        totalProcessed === queue.total_comments && 
        queue.success_count > 0 && 
        queue.failure_count === 0 &&
        queue.error_info?.includes('Inconsistent queue state detected')
      );
      
      if (shouldBeCompleted) {
        console.log(`   ✅ This queue should be marked as COMPLETED`);
        
        // Fix the queue status
        const updateResult = await pool.query(`
          UPDATE comment_queues 
          SET 
            status = 'completed',
            processed_count = $2,
            error_info = CONCAT(COALESCE(error_info, ''), '; Status corrected from failed to completed on ', NOW()),
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
          WHERE session_id = $1
          RETURNING *
        `, [sessionId, totalProcessed]);
        
        if (updateResult.rows.length > 0) {
          console.log(`   🎉 Successfully fixed queue ${sessionId} - marked as completed`);
        } else {
          console.log(`   ❌ Failed to update queue ${sessionId}`);
        }
      } else {
        console.log(`   ⚠️ Queue ${sessionId} has genuine issues and should remain failed`);
        console.log(`     Reason: processed=${totalProcessed}, expected=${queue.total_comments}, failures=${queue.failure_count}`);
      }
      
      console.log(''); // Empty line
    } catch (error) {
      console.error(`❌ Error fixing queue ${sessionId}:`, error);
    }
  }

  // Summary of all queue statuses after fix
  console.log('\n📊 Summary after fixes:');
  try {
    const summaryResult = await pool.query(`
      SELECT 
        session_id,
        status,
        total_comments,
        success_count + failure_count as actual_processed,
        success_count,
        failure_count,
        CASE 
          WHEN status = 'completed' AND (success_count + failure_count) = total_comments THEN '✅ CORRECT'
          WHEN status = 'failed' AND (success_count + failure_count) < total_comments THEN '❌ LEGITIMATE FAIL'
          WHEN status = 'failed' AND (success_count + failure_count) = total_comments THEN '⚠️ SHOULD BE COMPLETED'
          ELSE '❓ UNKNOWN'
        END as analysis
      FROM comment_queues 
      WHERE session_id = ANY($1)
      ORDER BY created_at DESC
    `, [queueIds]);

    summaryResult.rows.forEach(row => {
      console.log(`   ${row.session_id}: ${row.status} (${row.actual_processed}/${row.total_comments}) ${row.analysis}`);
    });
  } catch (error) {
    console.error('❌ Error getting summary:', error);
  }

  await pool.end();
}

fixInconsistentQueues().catch(console.error);
