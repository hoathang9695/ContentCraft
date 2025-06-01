
import fs from 'fs';
import path from 'path';

export class FileCleanupService {
  private static instance: FileCleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly uploadDir = path.join(process.cwd(), "uploads");

  static getInstance(): FileCleanupService {
    if (!FileCleanupService.instance) {
      FileCleanupService.instance = new FileCleanupService();
    }
    return FileCleanupService.instance;
  }

  // Start automatic cleanup every hour
  startAutoCleanup() {
    if (this.cleanupInterval) return;

    console.log('Starting automatic file cleanup service...');
    
    // Run cleanup immediately
    this.cleanupOldFiles();
    
    // Then run every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldFiles();
    }, 60 * 60 * 1000); // 1 hour
  }

  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Stopped automatic file cleanup service');
    }
  }

  // Clean up files older than maxAge (default 2 hours)
  cleanupOldFiles(maxAgeHours: number = 2) {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        return;
      }

      const files = fs.readdirSync(this.uploadDir);
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
      const now = Date.now();
      let deletedCount = 0;

      files.forEach(filename => {
        const filePath = path.join(this.uploadDir, filename);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`Cleaned up old file: ${filename} (${(fileAge / (60 * 60 * 1000)).toFixed(1)} hours old)`);
          }
        } catch (error) {
          console.error(`Error processing file ${filename}:`, error);
        }
      });

      if (deletedCount > 0) {
        console.log(`File cleanup completed: ${deletedCount} files deleted`);
      }
    } catch (error) {
      console.error('Error during file cleanup:', error);
    }
  }

  // Manual cleanup method
  cleanupAllFiles() {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        return;
      }

      const files = fs.readdirSync(this.uploadDir);
      let deletedCount = 0;

      files.forEach(filename => {
        const filePath = path.join(this.uploadDir, filename);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Deleted file: ${filename}`);
        } catch (error) {
          console.error(`Failed to delete ${filename}:`, error);
        }
      });

      console.log(`Manual cleanup completed: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (error) {
      console.error('Error during manual cleanup:', error);
      return 0;
    }
  }
}
