
import { db } from './server/db';
import { smtpConfig } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

async function fixSMTPConfig() {
  try {
    console.log('🔧 Fixing SMTP configuration...');
    
    // Get all active configs ordered by creation date (newest first)
    const activeConfigs = await db.select()
      .from(smtpConfig)
      .where(eq(smtpConfig.isActive, true))
      .orderBy(desc(smtpConfig.createdAt));
    
    console.log(`Found ${activeConfigs.length} active configs`);
    
    if (activeConfigs.length > 1) {
      // Keep the newest one, deactivate the rest
      const newestConfig = activeConfigs[0];
      const oldConfigs = activeConfigs.slice(1);
      
      console.log(`✅ Keeping config ID: ${newestConfig.id} (newest)`);
      
      for (const oldConfig of oldConfigs) {
        await db.update(smtpConfig)
          .set({ 
            isActive: false,
            updatedAt: new Date()
          })
          .where(eq(smtpConfig.id, oldConfig.id));
        
        console.log(`❌ Deactivated config ID: ${oldConfig.id}`);
      }
      
      console.log('✅ SMTP configuration fixed!');
    } else if (activeConfigs.length === 1) {
      console.log('✅ Only one active config found - no fix needed');
    } else {
      console.log('⚠️ No active configs found');
    }
    
    // Show final status
    const finalActiveConfigs = await db.select()
      .from(smtpConfig)
      .where(eq(smtpConfig.isActive, true));
    
    console.log(`Final status: ${finalActiveConfigs.length} active config(s)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing SMTP config:', error);
    process.exit(1);
  }
}

fixSMTPConfig();
