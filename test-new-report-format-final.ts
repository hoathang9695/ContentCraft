
import { db } from './server/db';
import { reportManagement } from './shared/schema';

async function testNewReportFormat() {
  console.log('🧪 Testing new report format with email in reporterName...');

  try {
    // Test data với format mới hoàn chỉnh
    const testData = {
      reportedId: {
        id: "TEST_USER_12345",
        name: "Nguyễn Văn Test",
        email: "test@example.com"
      },
      reportType: "user" as const,
      reporterName: {
        id: "1749539951001",
        name: "Nguyễn Văn An", 
        reporterEmail: "an.nguyen@example.com" // Email nằm trong reporterName
      },
      reason: "Spam tin nhắn",
      detailedReason: "Người dùng này liên tục gửi tin nhắn spam quảng cáo đến nhiều người dùng khác.",
      status: "pending" as const,
      assignedToId: 1,
      assignedToName: "Administrator",
      assignedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.insert(reportManagement).values(testData).returning();
    
    console.log('✅ Successfully inserted new format report:', result[0]);
    
    // Verify data structure
    console.log('📋 Reporter Name Object:', result[0].reporterName);
    console.log('📧 Email from reporterName:', 
      typeof result[0].reporterName === 'object' && result[0].reporterName?.reporterEmail 
        ? result[0].reporterName.reporterEmail 
        : 'Not found'
    );

  } catch (error) {
    console.error('❌ Error testing new report format:', error);
  }
}

testNewReportFormat();
