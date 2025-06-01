
import { db } from './server/db';
import { smtpConfig } from '@shared/schema';
import { createCipheriv, randomBytes } from 'crypto';

const encryptionKey = process.env.SMTP_ENCRYPTION_KEY || 'emso-smtp-key-32-characters-long!';
const algorithm = 'aes-256-cbc';

function encryptPassword(password: string): string {
  if (!password) return '';
  try {
    const iv = randomBytes(16);
    const cipher = createCipheriv(algorithm, Buffer.from(encryptionKey), iv);
    let encrypted = cipher.update(password);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Error encrypting password:', error);
    return password;
  }
}

async function encryptExistingPasswords() {
  try {
    console.log('Starting to encrypt existing SMTP passwords...');
    
    // Get all SMTP configs
    const configs = await db.select().from(smtpConfig);
    
    for (const config of configs) {
      // Check if password is already encrypted (contains ':')
      if (config.password && !config.password.includes(':')) {
        console.log(`Encrypting password for config ID: ${config.id}`);
        
        const encryptedPassword = encryptPassword(config.password);
        
        // Update the record with encrypted password
        await db.update(smtpConfig)
          .set({ 
            password: encryptedPassword,
            updatedAt: new Date()
          })
          .where(db.eq(smtpConfig.id, config.id));
        
        console.log(`✅ Password encrypted for config ID: ${config.id}`);
      } else {
        console.log(`⏭️ Password already encrypted for config ID: ${config.id}`);
      }
    }
    
    console.log('✅ All passwords have been encrypted successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error encrypting passwords:', error);
    process.exit(1);
  }
}

encryptExistingPasswords();
