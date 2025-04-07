import fs from 'fs';
import { db } from './server/db';
import { contents } from './shared/schema';

async function importContents() {
  try {
    console.log('Kết nối đến cơ sở dữ liệu...');
    
    // Xóa dữ liệu cũ
    console.log('Xóa dữ liệu nội dung cũ...');
    await db.delete(contents);
    
    // Đọc dữ liệu từ file
    console.log('Đọc dữ liệu từ file...');
    const contentsData = JSON.parse(fs.readFileSync('./attached_assets/contents.json', 'utf8'));
    
    // Import nội dung
    console.log(`Bắt đầu import ${contentsData.length} nội dung...`);
    let countSuccess = 0;
    
    for (const content of contentsData) {
      try {
        await db.insert(contents).values({
          id: content.id,
          externalId: content.external_id,
          source: content.source,
          categories: content.categories,
          labels: content.labels,
          status: content.status,
          sourceVerification: content.source_verification,
          assigned_to_id: content.assigned_to_id,
          assignedAt: content.assigned_at ? new Date(content.assigned_at) : null,
          approver_id: content.approver_id,
          approveTime: content.approve_time ? new Date(content.approve_time) : null,
          comments: content.comments,
          reactions: content.reactions,
          processingResult: content.processing_result,
          safe: content.safe,
          createdAt: new Date(content.created_at),
          updatedAt: new Date(content.updated_at)
        });
        
        countSuccess++;
        if (countSuccess % 10 === 0) {
          console.log(`Đã import ${countSuccess}/${contentsData.length} nội dung`);
        }
      } catch (err) {
        console.error(`Lỗi khi import nội dung ID ${content.id}:`, err);
      }
    }
    
    console.log(`Import thành công ${countSuccess}/${contentsData.length} nội dung`);
  } catch (error) {
    console.error('Lỗi khi import dữ liệu:', error);
  }
}

importContents().then(() => process.exit(0));