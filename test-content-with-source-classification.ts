
import { db } from './server/db';
import { contents, realUsers, pages, groups } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

interface ContentMessage {
  externalId: string;
  source: {
    id: string;
    name: string;
    type: string;
  };
  categories: string[];
  labels: string[];
  sourceVerification: "verified" | "unverified";
}

async function testContentWithSourceClassification() {
  console.log('🧪 Testing content creation with auto source classification...\n');

  const testMessage: ContentMessage = {
    "externalId": "114687715594965519",
    "source": {
      "id": "113752366387735850",
      "name": "Nguyễn Hoàng Nam",
      "type": "Account"
    },
    "categories": [
      "default",
      "Chính trị"
    ],
    "labels": [
      "bình luận chính trị, câu chuyện về tổng thống Trump và Elon Musk"
    ],
    "sourceVerification": "verified"
  };

  try {
    console.log('📋 Test message:', JSON.stringify(testMessage, null, 2));

    // 1. First check if user exists and their current classification
    console.log('\n🔍 Checking user classification...');
    const userResult = await db
      .select({ 
        id: realUsers.id,
        fullName: realUsers.fullName, 
        classification: realUsers.classification 
      })
      .from(realUsers)
      .where(sql`full_name::json->>'id' = ${testMessage.source.id}`)
      .limit(1);

    if (userResult.length > 0) {
      console.log('✅ Found user:', {
        id: userResult[0].id,
        name: userResult[0].fullName,
        classification: userResult[0].classification
      });
    } else {
      console.log('❌ User not found in real_users table');
      return;
    }

    // 2. Check if content already exists
    console.log('\n🔍 Checking if content already exists...');
    const existingContent = await db
      .select()
      .from(contents)
      .where(eq(contents.externalId, testMessage.externalId))
      .limit(1);

    if (existingContent.length > 0) {
      console.log('⚠️ Content already exists:', {
        id: existingContent[0].id,
        externalId: existingContent[0].externalId,
        sourceClassification: existingContent[0].sourceClassification
      });
      
      // Delete existing content for clean test
      console.log('🗑️ Deleting existing content for clean test...');
      await db.delete(contents).where(eq(contents.externalId, testMessage.externalId));
      console.log('✅ Existing content deleted');
    }

    // 3. Simulate the Kafka message processing
    console.log('\n📝 Processing test message...');
    
    const { processContentMessage } = await import('./server/kafka-consumer');
    
    await db.transaction(async (tx) => {
      await processContentMessage(testMessage, tx);
    });

    // 4. Verify the result
    console.log('\n✅ Verifying result...');
    const newContent = await db
      .select({
        id: contents.id,
        externalId: contents.externalId,
        source: contents.source,
        sourceClassification: contents.sourceClassification,
        categories: contents.categories,
        labels: contents.labels,
        sourceVerification: contents.sourceVerification,
        status: contents.status
      })
      .from(contents)
      .where(eq(contents.externalId, testMessage.externalId))
      .limit(1);

    if (newContent.length > 0) {
      console.log('🎉 Content created successfully:');
      console.log('   ID:', newContent[0].id);
      console.log('   External ID:', newContent[0].externalId);
      console.log('   Source Classification:', newContent[0].sourceClassification);
      console.log('   Source Verification:', newContent[0].sourceVerification);
      console.log('   Status:', newContent[0].status);
      console.log('   Source:', newContent[0].source);
      console.log('   Categories:', newContent[0].categories);
      console.log('   Labels:', newContent[0].labels);

      // Check if source classification matches user classification
      const expectedClassification = userResult[0].classification;
      const actualClassification = newContent[0].sourceClassification;
      
      if (expectedClassification === actualClassification) {
        console.log(`\n✅ SUCCESS: Source classification correctly set to "${actualClassification}"`);
      } else {
        console.log(`\n❌ MISMATCH: Expected "${expectedClassification}" but got "${actualClassification}"`);
      }
    } else {
      console.log('❌ Content was not created');
    }

    console.log('\n🧪 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the test
testContentWithSourceClassification()
  .then(() => {
    console.log('\n✨ Test script finished');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Test script error:', err);
    process.exit(1);
  });
