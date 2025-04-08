const { Client } = require('pg');

async function generateContent() {
  // Kết nối đến cơ sở dữ liệu
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  
  try {
    // Lấy danh sách ID người dùng
    const userRes = await client.query(`
      SELECT id FROM users WHERE username IN ('hoanganh', 'ngocanh', 'minhanh')
    `);
    
    const userIds = userRes.rows.map(row => row.id);
    
    // Các nguồn nội dung
    const sources = ['Facebook', 'Twitter', 'LinkedIn', 'Instagram', 'YouTube', 'TikTok', 'Blog', 'Email', 'Website'];
    
    // Các danh mục
    const categories = ['Tin tức', 'Sự kiện', 'Khuyến mãi', 'Sản phẩm mới', 'Hướng dẫn', 'Đánh giá', 'Nghiên cứu', 'Truyền thông', 'Phỏng vấn'];
    
    // Các nhãn
    const labels = ['Quan trọng', 'Khẩn cấp', 'Trending', 'Phổ biến', 'Mùa hè', 'Mùa thu', 'Mùa đông', 'Mùa xuân', 'Ngày lễ', 'Cuối tuần', 'Kỹ thuật số', 'Công nghệ'];
    
    // Trạng thái
    const statuses = ['draft', 'review', 'published'];
    
    // Tạo 99 bản ghi nội dung
    const totalRecords = 99;
    const recordsPerUser = Math.floor(totalRecords / userIds.length);
    let insertedCount = 0;
    
    for (const userId of userIds) {
      // Số lượng bản ghi cho mỗi người dùng
      let recordsForThisUser = recordsPerUser;
      
      // Nếu là người dùng cuối, thêm các bản ghi còn dư
      if (userId === userIds[userIds.length - 1]) {
        recordsForThisUser += totalRecords % userIds.length;
      }
      
      for (let i = 0; i < recordsForThisUser; i++) {
        // Tạo nội dung ngẫu nhiên
        const source = sources[Math.floor(Math.random() * sources.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        
        // Chọn một số nhãn ngẫu nhiên (1-3 nhãn)
        const numLabels = Math.floor(Math.random() * 3) + 1;
        const selectedLabels = [];
        for (let j = 0; j < numLabels; j++) {
          const label = labels[Math.floor(Math.random() * labels.length)];
          if (!selectedLabels.includes(label)) {
            selectedLabels.push(label);
          }
        }
        
        // Chọn trạng thái ngẫu nhiên
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        // Xác định người duyệt ngẫu nhiên (chỉ cho các bản ghi đã xuất bản)
        let approverId = null;
        let approveTime = null;
        
        if (status === 'published') {
          // Chọn một người dùng khác làm người duyệt
          const potentialApprovers = userIds.filter(id => id !== userId);
          approverId = potentialApprovers[Math.floor(Math.random() * potentialApprovers.length)];
          approveTime = new Date().toISOString();
        }
        
        // Số bình luận và phản ứng ngẫu nhiên
        const comments = Math.floor(Math.random() * 50);
        const reactions = Math.floor(Math.random() * 100);
        
        // Chèn bản ghi vào cơ sở dữ liệu
        await client.query(`
          INSERT INTO contents (
            source, categories, labels, status, 
            approver_id, approve_time, comments, 
            reactions, author_id, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, 
            NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days', 
            NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days'
          )
        `, [
          source,
          category,
          selectedLabels.join(', '),
          status,
          approverId,
          approveTime,
          comments,
          reactions,
          userId
        ]);
        
        insertedCount++;
        console.log(`Đã tạo ${insertedCount}/${totalRecords} bản ghi nội dung.`);
      }
    }
    
    console.log(`Đã hoàn thành việc tạo ${insertedCount} bản ghi nội dung.`);
  } finally {
    await client.end();
  }
}

generateContent().catch(err => {
  console.error('Lỗi khi tạo nội dung:', err);
  process.exit(1);
});