
import { db } from "./server/db.js";
import { supportRequests } from "./shared/schema.js";

async function createFeedbackTestData() {
  console.log("Creating test feedback data...");

  const feedbackData = [
    {
      full_name: "Nguyễn Văn An",
      email: "nguyenvanan@example.com",
      subject: "Báo lỗi: Không thể đăng nhập",
      content: "Tôi không thể đăng nhập vào hệ thống từ sáng nay. Khi nhập username và password thì bị báo lỗi 'Invalid credentials'.",
      type: "feedback",
      feedback_type: "bug_report",
      detailed_description: "Lỗi xảy ra từ khoảng 8:00 sáng nay. Tôi đã thử clear cache và cookies nhưng vẫn không được. Browser: Chrome 120, OS: Windows 11.",
      status: "pending",
      assigned_to_id: 1,
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      full_name: "Trần Thị Bình",
      email: "tranthibibinh@example.com", 
      subject: "Yêu cầu tính năng: Dark mode",
      content: "Tôi muốn có tính năng dark mode cho ứng dụng để dễ sử dụng vào ban đêm.",
      type: "feedback",
      feedback_type: "feature_request",
      feature_type: "Giao diện người dùng",
      detailed_description: "Dark mode sẽ giúp giảm mỏi mắt khi sử dụng ứng dụng trong môi trường ánh sáng yếu. Có thể thêm toggle switch ở góc phải trên cùng.",
      status: "processing",
      assigned_to_id: 2,
      assigned_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updated_at: new Date(),
    },
    {
      full_name: "Lê Minh Cường",
      email: "leminhcuong@example.com",
      subject: "Khiếu nại: Dịch vụ chậm",
      content: "Dịch vụ xử lý của hệ thống rất chậm, mất nhiều thời gian để load dữ liệu.",
      type: "feedback", 
      feedback_type: "complaint",
      detailed_description: "Thời gian load trang thường mất từ 10-15 giây, đặc biệt là trang danh sách content. Điều này ảnh hưởng đến công việc hàng ngày.",
      attachment_url: "https://example.com/speed-test-report.pdf",
      status: "completed",
      assigned_to_id: 1,
      assigned_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      response_content: "Chúng tôi đã tối ưu hóa database và cải thiện tốc độ load. Vui lòng kiểm tra lại.",
      responder_id: 1,
      response_time: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    {
      full_name: "Phạm Thị Dung",
      email: "phamthidung@example.com",
      subject: "Đề xuất: Thêm tính năng export Excel",
      content: "Đề xuất thêm tính năng export dữ liệu ra file Excel để tiện theo dõi và báo cáo.",
      type: "feedback",
      feedback_type: "suggestion", 
      feature_type: "Xuất dữ liệu",
      detailed_description: "Tính năng export Excel sẽ giúp người dùng dễ dàng tạo báo cáo và chia sẻ dữ liệu với đồng nghiệp. Nên hỗ trợ export theo bộ lọc.",
      status: "pending",
      assigned_to_id: 2,
      assigned_at: new Date(),
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      full_name: "Hoàng Văn Em",
      email: "hoangvanem@example.com",
      subject: "Khác: Câu hỏi về bảo mật",
      content: "Tôi có thắc mắc về chính sách bảo mật dữ liệu của hệ thống.",
      type: "feedback",
      feedback_type: "other",
      detailed_description: "Tôi muốn biết dữ liệu cá nhân có được mã hóa không và được lưu trữ ở đâu. Có tuân thủ các quy định về bảo vệ dữ liệu cá nhân không?",
      status: "processing",
      assigned_to_id: 1,
      assigned_at: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
    }
  ];

  try {
    for (const feedback of feedbackData) {
      await db.insert(supportRequests).values(feedback);
      console.log(`✅ Created feedback: ${feedback.subject}`);
    }
    
    console.log("\n🎉 Test feedback data created successfully!");
    console.log(`📊 Created ${feedbackData.length} feedback records`);
    
  } catch (error) {
    console.error("❌ Error creating feedback test data:", error);
  }
}

// Run the script
createFeedbackTestData()
  .then(() => {
    console.log("✅ Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
