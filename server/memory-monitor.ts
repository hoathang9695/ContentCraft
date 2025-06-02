
class MemoryMonitor {
  private static instance: MemoryMonitor;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs = 60000; // 1 minute
  private readonly memoryThreshold = 500 * 1024 * 1024; // 500MB

  private constructor() {}

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  startMonitoring() {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.intervalMs);

    console.log('Memory monitoring started');
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('Memory monitoring stopped');
    }
  }

  private checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    
    console.log('Memory Usage:', {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
    });

    // Warning if memory usage is high
    if (memUsage.heapUsed > this.memoryThreshold) {
      console.warn(`High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`);
      
      // Force garbage collection if available
      if (global.gc) {
        console.log('Forcing garbage collection...');
        global.gc();
      }
    }
  }

  getMemoryUsage() {
    return process.memoryUsage();
  }
}

export { MemoryMonitor };
