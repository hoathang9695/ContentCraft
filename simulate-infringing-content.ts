
import { db } from './server/db.js';
import { infringingContents, users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function simulateInfringingContent() {
  console.log('🚀 Tạo dữ liệu mẫu cho nội dung vi phạm...');

  try {
    // Lấy danh sách người dùng
    const activeUsers = await db
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (activeUsers.length === 0) {
      throw new Error("Không tìm thấy người dùng active");
    }

    console.log(`📝 Tìm thấy ${activeUsers.length} người dùng active`);

    // Dữ liệu mẫu cho nội dung vi phạm
    const sampleData = [
      {
        externalId: "114629837455014358",
        violation_description: "Nội dung chứa ngôn từ độc hại và kích động bạo lực",
        status: "pending"
      },
      {
        externalId: "114630047869243404",
        violation_description: "Đăng tải hình ảnh không phù hợp với tiêu chuẩn cộng đồng",
        status: "processing"
      },
      {
        externalId: "114631258147395627",
        violation_description: "Spam và quảng cáo trái phép",
        status: "completed"
      },
      {
        externalId: "114632469258741036",
        violation_description: "Chia sẻ thông tin sai lệch và tin giả",
        status: "pending"
      },
      {
        externalId: "114633680369852147",
        violation_description: "Xâm phạm bản quyền nội dung",
        status: "processing"
      },
      {
        externalId: "114634891470963258",
        violation_description: "Nội dung khiêu dâm và không phù hợp",
        status: "completed"
      },
      {
        externalId: "114636102581074369",
        violation_description: "Đe dọa và quấy rối người dùng khác",
        status: "pending"
      },
      {
        externalId: "114637313692185470",
        violation_description: "Đăng tải nội dung vi phạm pháp luật",
        status: "processing"
      }
    ];

    // Phân công theo round-robin
    let userIndex = 0;
    const currentDate = new Date();

    for (const [index, item] of sampleData.entries()) {
      const assignedUser = activeUsers[userIndex];
      
      const insertData = {
        externalId: item.externalId,
        assigned_to_id: assignedUser.id,
        violation_description: item.violation_description,
        status: item.status,
        processing_time: item.status === "completed" ? 
          new Date(currentDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000) : // Random trong 7 ngày qua
          null,
        created_at: new Date(currentDate.getTime() - (index + 1) * 24 * 60 * 60 * 1000), // Mỗi ngày một record
        updated_at: new Date()
      };

      try {
        const result = await db
          .insert(infringingContents)
          .values(insertData)
          .returning();

        console.log(`✅ Tạo thành công nội dung vi phạm ${result[0].id} - ${item.externalId}`);
        console.log(`👤 Phân công cho: ${assignedUser.name} (${assignedUser.username})`);
        console.log(`📋 Trạng thái: ${item.status}`);
        console.log(`📝 Mô tả: ${item.violation_description}`);
        console.log('---');
      } catch (error) {
        console.error(`❌ Lỗi tạo nội dung vi phạm ${item.externalId}:`, error);
      }

      // Chuyển sang người dùng tiếp theo (round-robin)
      userIndex = (userIndex + 1) % activeUsers.length;
    }

    console.log('🎉 Hoàn tất tạo dữ liệu mẫu cho nội dung vi phạm!');

  } catch (error) {
    console.error('❌ Lỗi khi tạo dữ liệu mẫu:', error);
    throw error;
  }
}

// Chạy script
simulateInfringingContent()
  .then(() => {
    console.log('✅ Script hoàn tất thành công');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script thất bại:', error);
    process.exit(1);
  });
