
import { db } from "./server/db";
import { groups, users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function createSampleGroups() {
  console.log("Creating sample groups data...");

  try {
    // Get active users for assignment
    const activeUsers = await db
      .select()
      .from(users)
      .where(eq(users.status, "active"));

    if (activeUsers.length === 0) {
      console.error("No active users found for assignment");
      return;
    }

    console.log(`Found ${activeUsers.length} active users for assignment`);

    const sampleGroups = [
      {
        groupName: {
          id: "114501234567890001",
          group_name: "Nhóm Kinh Doanh Online"
        },
        groupType: "public", // Công khai hoặc Riêng tư
        categories: "business", // Danh mục
        classification: "potential",
        adminData: {
          id: "114550257830462970",
          admin_name: "Trần Văn Kinh"
        },
        phoneNumber: "0123456789",
        monetizationEnabled: true,
        assignedToId: activeUsers[0].id
      },
      {
        groupName: {
          id: "114501234567890002",
          group_name: "Cộng Đồng Người Yêu Thể Thao"
        },
        groupType: "public",
        categories: "cộng đồng",
        classification: "new",
        adminData: {
          id: "114550257830462971",
          admin_name: "Nguyễn Thị Thể"
        },
        phoneNumber: "0987654321",
        monetizationEnabled: false,
        assignedToId: activeUsers[1 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890003",
          group_name: "Nhóm Học Tập Lập Trình"
        },
        groupType: "private",
        categories: "giáo dục",
        classification: "potential",
        adminData: {
          id: "114550257830462972",
          admin_name: "Lê Minh Hoàng"
        },
        phoneNumber: "0345678901",
        monetizationEnabled: false,
        assignedToId: activeUsers[2 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890004",
          group_name: "Doanh Nghiệp Công Nghệ Số"
        },
        groupType: "public",
        categories: "business",
        classification: "potential",
        adminData: {
          id: "114550257830462973",
          admin_name: "Phạm Công Nghệ"
        },
        phoneNumber: "0456789012",
        monetizationEnabled: true,
        assignedToId: activeUsers[3 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890005",
          group_name: "Cộng Đồng Du Lịch Việt Nam"
        },
        groupType: "public",
        categories: "du lịch",
        classification: "new",
        adminData: {
          id: "114550257830462974",
          admin_name: "Võ Du Lịch"
        },
        phoneNumber: "0567890123",
        monetizationEnabled: false,
        assignedToId: activeUsers[4 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890006",
          group_name: "Nhóm Đầu Tư Chứng Khoán"
        },
        groupType: "private",
        categories: "tài chính",
        classification: "potential",
        adminData: {
          id: "114550257830462975",
          admin_name: "Nguyễn Đầu Tư"
        },
        phoneNumber: "0678901234",
        monetizationEnabled: true,
        assignedToId: activeUsers[0].id
      },
      {
        groupName: {
          id: "114501234567890007",
          group_name: "Cộng Đồng Ẩm Thực Sài Gòn"
        },
        groupType: "public",
        categories: "cộng đồng",
        classification: "new",
        adminData: {
          id: "114550257830462976",
          admin_name: "Trần Ẩm Thực"
        },
        phoneNumber: "0789012345",
        monetizationEnabled: false,
        assignedToId: activeUsers[1 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890008",
          group_name: "Nhóm Mẹ và Bé"
        },
        groupType: "private",
        categories: "gia đình",
        classification: "potential",
        adminData: {
          id: "114550257830462977",
          admin_name: "Lê Thị Mẹ"
        },
        phoneNumber: "0890123456",
        monetizationEnabled: true,
        assignedToId: activeUsers[2 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890009",
          group_name: "Cộng Đồng Game Thủ Việt Nam"
        },
        groupType: "public",
        categories: "giải trí",
        classification: "new",
        adminData: {
          id: "114550257830462978",
          admin_name: "Phạm Game Thủ"
        },
        phoneNumber: "0901234567",
        monetizationEnabled: false,
        assignedToId: activeUsers[3 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890010",
          group_name: "Nhóm Bán Hàng Online"
        },
        groupType: "public",
        categories: "business",
        classification: "potential",
        adminData: {
          id: "114550257830462979",
          admin_name: "Võ Bán Hàng"
        },
        phoneNumber: "0912345678",
        monetizationEnabled: true,
        assignedToId: activeUsers[4 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890011",
          group_name: "Nhóm Học Tiếng Anh"
        },
        groupType: "private",
        categories: "giáo dục",
        classification: "new",
        adminData: {
          id: "114550257830462980",
          admin_name: "Nguyễn Tiếng Anh"
        },
        phoneNumber: "0923456789",
        monetizationEnabled: false,
        assignedToId: activeUsers[0].id
      },
      {
        groupName: {
          id: "114501234567890012",
          group_name: "Hội Phụ Huynh Trường ABC"
        },
        groupType: "private",
        categories: "gia đình",
        classification: "potential",
        adminData: {
          id: "114550257830462981",
          admin_name: "Trần Phụ Huynh"
        },
        phoneNumber: "0934567890",
        monetizationEnabled: false,
        assignedToId: activeUsers[1 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890013",
          group_name: "Cộng Đồng Yêu Sách"
        },
        groupType: "public",
        categories: "cộng đồng",
        classification: "new",
        adminData: {
          id: "114550257830462982",
          admin_name: "Lê Yêu Sách"
        },
        phoneNumber: "0945678901",
        monetizationEnabled: false,
        assignedToId: activeUsers[2 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890014",
          group_name: "Tour Du Lịch Miền Bắc"
        },
        groupType: "public",
        categories: "du lịch",
        classification: "potential",
        adminData: {
          id: "114550257830462983",
          admin_name: "Phạm Du Lịch"
        },
        phoneNumber: "0956789012",
        monetizationEnabled: true,
        assignedToId: activeUsers[3 % activeUsers.length].id
      },
      {
        groupName: {
          id: "114501234567890015",
          group_name: "Nhóm Học Piano"
        },
        groupType: "private",
        categories: "giáo dục",
        classification: "new",
        adminData: {
          id: "114550257830462984",
          admin_name: "Võ Piano"
        },
        phoneNumber: "0967890123",
        monetizationEnabled: true,
        assignedToId: activeUsers[4 % activeUsers.length].id
      }
    ];

    // Clear existing sample data first
    await db.delete(groups);
    console.log("Cleared existing groups data");

    // Insert new sample data
    const insertedGroups = await db.insert(groups).values(sampleGroups).returning();

    console.log(`Successfully created ${insertedGroups.length} sample groups:`);
    insertedGroups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.groupName.group_name} (ID: ${group.groupName.id}) - ${group.groupType} - ${group.categories}`);
    });

  } catch (error) {
    console.error("Error creating sample groups:", error);
  }
}

// Run the function
createSampleGroups()
  .then(() => {
    console.log("Sample groups creation completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
