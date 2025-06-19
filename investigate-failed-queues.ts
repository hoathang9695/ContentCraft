
import { pool } from './server/db';

async function investigateFailedQueues() {
  const queueIds = [
    'queue_1750220140949_acwaym22y',
    'queue_1750216913254_930sn4fao', 
    'queue_1750221579816_6i7l5n774',
    'queue_1750233701191_tqhw86lef',
    'queue_1750236079256_9pdfoxq40',
    'queue_1750236464377_3j2laamks',
    'queue_1750235716714_oh6tipo3p'
  ];

  console.log('🔍 Khảo sát chi tiết các queue thất bại...\n');

  const results = [];

  for (const sessionId of queueIds) {
    try {
      console.log(`📋 Phân tích Queue: ${sessionId}`);
      console.log('='.repeat(60));

      // Lấy thông tin chi tiết queue
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
          END as actual_comments_count,
          EXTRACT(EPOCH FROM (started_at - created_at))/60 as wait_time_minutes,
          CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (completed_at - started_at))/60
            ELSE NULL
          END as processing_time_minutes,
          EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as age_hours
        FROM comment_queues 
        WHERE session_id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        console.log(`❌ Queue ${sessionId} không tìm thấy\n`);
        results.push({ sessionId, status: 'NOT_FOUND', issue: 'Queue không tồn tại' });
        continue;
      }

      const queue = result.rows[0];
      const totalProcessed = (queue.success_count || 0) + (queue.failure_count || 0);
      
      // Thông tin cơ bản
      console.log(`📊 Thông tin cơ bản:`);
      console.log(`   External ID: ${queue.external_id}`);
      console.log(`   Status: ${queue.status}`);
      console.log(`   Gender Filter: ${queue.selected_gender}`);
      console.log(`   Created: ${queue.created_at}`);
      console.log(`   Started: ${queue.started_at || 'Chưa bắt đầu'}`);
      console.log(`   Completed: ${queue.completed_at || 'Chưa hoàn thành'}`);
      console.log(`   Age: ${Math.round(queue.age_hours * 10) / 10} hours`);

      // Thông tin xử lý
      console.log(`\n📈 Thông tin xử lý:`);
      console.log(`   Total Comments: ${queue.total_comments} (Actual: ${queue.actual_comments_count})`);
      console.log(`   Processed: ${queue.processed_count || 0} (Success: ${queue.success_count || 0}, Failed: ${queue.failure_count || 0})`);
      console.log(`   Current Index: ${queue.current_comment_index || 0}`);
      console.log(`   Total Processed (calculated): ${totalProcessed}`);

      // Thời gian xử lý
      if (queue.wait_time_minutes !== null) {
        console.log(`\n⏱️ Thời gian:`);
        console.log(`   Wait Time: ${Math.round(queue.wait_time_minutes * 10) / 10} minutes`);
        if (queue.processing_time_minutes !== null) {
          console.log(`   Processing Time: ${Math.round(queue.processing_time_minutes * 10) / 10} minutes`);
        }
      }

      // Error analysis
      console.log(`\n❌ Error Analysis:`);
      if (queue.error_info) {
        console.log(`   Error Info: ${queue.error_info}`);
        
        // Phân loại lỗi
        const errorLower = queue.error_info.toLowerCase();
        let errorCategory = 'OTHER';
        let errorDescription = '';
        
        if (errorLower.includes('timeout')) {
          errorCategory = 'TIMEOUT';
          errorDescription = 'Queue bị timeout trong quá trình xử lý';
        } else if (errorLower.includes('rate limit')) {
          errorCategory = 'RATE_LIMIT';
          errorDescription = 'Bị giới hạn tốc độ từ API external';
        } else if (errorLower.includes('authentication') || errorLower.includes('auth')) {
          errorCategory = 'AUTH_ERROR';
          errorDescription = 'Lỗi xác thực API';
        } else if (errorLower.includes('server error')) {
          errorCategory = 'SERVER_ERROR';
          errorDescription = 'Lỗi từ phía server external';
        } else if (errorLower.includes('inconsistent')) {
          errorCategory = 'INCONSISTENT_STATE';
          errorDescription = 'Trạng thái queue không nhất quán';
        } else if (errorLower.includes('processing incomplete')) {
          errorCategory = 'INCOMPLETE_PROCESSING';
          errorDescription = 'Xử lý không hoàn thành';
        }
        
        console.log(`   Error Category: ${errorCategory}`);
        console.log(`   Description: ${errorDescription}`);
      } else {
        console.log(`   Error Info: Không có thông tin lỗi cụ thể`);
      }

      // Issues detection
      console.log(`\n🔍 Issues Detected:`);
      const issues = [];
      
      if (queue.total_comments !== queue.actual_comments_count) {
        issues.push(`Comments count mismatch: declared ${queue.total_comments} vs actual ${queue.actual_comments_count}`);
      }
      
      if (totalProcessed !== (queue.processed_count || 0)) {
        issues.push(`Processed count inconsistent: ${queue.processed_count} vs calculated ${totalProcessed}`);
      }
      
      if (queue.status === 'failed' && totalProcessed === queue.total_comments && (queue.failure_count || 0) === 0) {
        issues.push(`Should be completed: all comments processed successfully but marked as failed`);
      }
      
      if (queue.status === 'processing' && queue.age_hours > 1) {
        issues.push(`Stuck in processing state for ${Math.round(queue.age_hours * 10) / 10} hours`);
      }
      
      if (issues.length === 0) {
        console.log(`   ✅ No data inconsistencies detected`);
      } else {
        issues.forEach(issue => console.log(`   ⚠️ ${issue}`));
      }

      // Recommendations
      console.log(`\n💡 Recommendations:`);
      if (queue.status === 'failed' && totalProcessed === queue.total_comments && (queue.failure_count || 0) === 0) {
        console.log(`   ✅ Should fix status to 'completed' - all comments successfully processed`);
      } else if (queue.status === 'processing' && queue.age_hours > 1) {
        console.log(`   🔧 Should reset to 'pending' - stuck in processing state`);
      } else if (queue.status === 'failed' && (queue.success_count || 0) > 0 && (queue.failure_count || 0) > 0) {
        console.log(`   🔄 Partial success - consider retry for failed comments only`);
      } else if (queue.status === 'failed' && (queue.success_count || 0) === 0) {
        console.log(`   🚨 Complete failure - check fake user tokens and external API connectivity`);
      }

      // Lưu kết quả
      results.push({
        sessionId,
        status: queue.status,
        errorCategory: queue.error_info ? 'HAS_ERROR' : 'NO_ERROR_INFO',
        totalComments: queue.total_comments,
        processed: totalProcessed,
        successRate: queue.total_comments > 0 ? Math.round((queue.success_count || 0) / queue.total_comments * 100) : 0,
        issue: issues.length > 0 ? issues[0] : 'No issues detected',
        ageHours: Math.round(queue.age_hours * 10) / 10
      });

      console.log('\n');
    } catch (error) {
      console.error(`❌ Error analyzing queue ${sessionId}:`, error);
      results.push({ sessionId, status: 'ERROR', issue: `Analysis error: ${error}` });
    }
  }

  // Summary report
  console.log('\n📊 SUMMARY REPORT');
  console.log('='.repeat(60));
  
  const statusCounts = {};
  const errorCategories = {};
  let totalQueues = results.length;
  let avgSuccessRate = 0;
  
  results.forEach(result => {
    statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
    errorCategories[result.errorCategory] = (errorCategories[result.errorCategory] || 0) + 1;
    if (result.successRate !== undefined) {
      avgSuccessRate += result.successRate;
    }
  });
  
  avgSuccessRate = Math.round(avgSuccessRate / totalQueues);
  
  console.log(`Total Queues Analyzed: ${totalQueues}`);
  console.log(`Average Success Rate: ${avgSuccessRate}%`);
  console.log('\nStatus Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} queues`);
  });
  
  console.log('\nError Categories:');
  Object.entries(errorCategories).forEach(([category, count]) => {
    console.log(`   ${category}: ${count} queues`);
  });

  // Detailed results table
  console.log('\n📋 DETAILED RESULTS');
  console.log('='.repeat(60));
  console.log('Queue ID'.padEnd(35) + 'Status'.padEnd(12) + 'Success%'.padEnd(10) + 'Age(h)'.padEnd(8) + 'Main Issue');
  console.log('-'.repeat(100));
  
  results.forEach(result => {
    const queueIdShort = result.sessionId.substring(0, 30) + '...';
    const successRate = result.successRate !== undefined ? `${result.successRate}%` : 'N/A';
    const ageHours = result.ageHours !== undefined ? `${result.ageHours}h` : 'N/A';
    
    console.log(
      queueIdShort.padEnd(35) + 
      result.status.padEnd(12) + 
      successRate.padEnd(10) + 
      ageHours.padEnd(8) + 
      result.issue.substring(0, 40)
    );
  });

  console.log('\n✅ Investigation completed!');
  await pool.end();
}

investigateFailedQueues().catch(console.error);
