
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogConfig {
  level: LogLevel;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logFormat: 'json' | 'text';
  maxLogFiles: number;
  maxLogSize: string;
}

export class Logger {
  private static instance: Logger;
  private config: LogConfig;
  private logFile: string;

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enableFileLogging: true,
      enableConsoleLogging: true,
      logFormat: 'json',
      maxLogFiles: 5,
      maxLogSize: '10MB',
      ...config
    };
    
    this.logFile = `logs/app-${new Date().toISOString().split('T')[0]}.log`;
    this.ensureLogDirectory();
  }

  static getInstance(config?: Partial<LogConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private ensureLogDirectory() {
    const fs = require('fs');
    const path = require('path');
    const logDir = path.dirname(this.logFile);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(level: LogLevel, category: string, message: string, metadata?: any) {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];

    if (this.config.logFormat === 'json') {
      // ELK/Fluentd standard JSON format
      const logEntry = {
        '@timestamp': timestamp,
        '@version': '1',
        level: levelName.toLowerCase(),
        logger_name: category,
        message: message,
        thread_name: `pid-${process.pid}`,
        host: process.env.HOSTNAME || 'localhost',
        application: 'emso-content-management',
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        ...metadata && { fields: metadata }
      };

      // Add stack trace for ERROR level
      if (level === LogLevel.ERROR && metadata?.error instanceof Error) {
        logEntry.stack_trace = metadata.error.stack;
        logEntry.exception = {
          class: metadata.error.constructor.name,
          message: metadata.error.message
        };
      }

      return JSON.stringify(logEntry);
    } else {
      return `[${timestamp}] ${levelName} [${category}] ${message}${metadata ? ` ${JSON.stringify(metadata)}` : ''}`;
    }
  }

  private writeLog(formattedMessage: string) {
    if (this.config.enableConsoleLogging) {
      console.log(formattedMessage);
    }

    if (this.config.enableFileLogging) {
      const fs = require('fs');
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    }
  }

  debug(message: string, category: string = 'APP', metadata?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, category, message, metadata);
      this.writeLog(formatted);
    }
  }

  info(message: string, category: string = 'APP', metadata?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, category, message, metadata);
      this.writeLog(formatted);
    }
  }

  warn(message: string, category: string = 'APP', metadata?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, category, message, metadata);
      this.writeLog(formatted);
    }
  }

  error(message: string, category: string = 'APP', metadata?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage(LogLevel.ERROR, category, message, metadata);
      this.writeLog(formatted);
    }
  }

  // Kafka-specific logging methods
  kafka(message: string, metadata?: any) {
    this.info(message, 'KAFKA', metadata);
  }

  kafkaError(message: string, metadata?: any) {
    this.error(message, 'KAFKA_ERROR', metadata);
  }

  // API-specific logging methods
  apiRequest(method: string, path: string, statusCode: number, duration: number, response?: any) {
    this.info(`${method} ${path} ${statusCode} in ${duration}ms`, 'API', {
      http: {
        method,
        path,
        status_code: statusCode,
        response_time_ms: duration,
        response_size: response ? JSON.stringify(response).length : 0
      },
      user_agent: process.env.USER_AGENT,
      response_preview: response ? JSON.stringify(response).substring(0, 200) : undefined
    });
  }

  // Database-specific logging
  dbQuery(query: string, duration: number, rowCount?: number, error?: Error) {
    const logData = {
      database: {
        query_type: query.split(' ')[0]?.toUpperCase(),
        duration_ms: duration,
        row_count: rowCount,
        query_preview: query.substring(0, 100)
      }
    };

    if (error) {
      this.error(`Database query failed: ${error.message}`, 'DATABASE', {
        ...logData,
        error: {
          message: error.message,
          stack: error.stack,
          query: query
        }
      });
    } else {
      this.info(`Database query executed successfully`, 'DATABASE', logData);
    }
  }

  // Kafka-specific structured logging
  kafkaEvent(event: string, topic?: string, partition?: number, offset?: string, metadata?: any) {
    this.info(`Kafka ${event}`, 'KAFKA', {
      kafka: {
        event,
        topic,
        partition,
        offset,
        ...metadata
      }
    });
  }

  // Security/Auth logging
  securityEvent(event: string, userId?: string, ip?: string, details?: any) {
    this.warn(`Security event: ${event}`, 'SECURITY', {
      security: {
        event,
        user_id: userId,
        ip_address: ip,
        timestamp: new Date().toISOString(),
        ...details
      }
    });
  }

  // Performance monitoring
  performanceMetric(metric: string, value: number, unit: string, tags?: any) {
    this.info(`Performance metric: ${metric}`, 'PERFORMANCE', {
      metrics: {
        name: metric,
        value,
        unit,
        tags: tags || {},
        timestamp: new Date().toISOString()
      }
    });
  }

  // Cleanup old log files
  async cleanupLogs() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const logDir = path.dirname(this.logFile);
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter(file => file.startsWith('app-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stat: require('fs').statSync(path.join(logDir, file))
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // Keep only the most recent files
      if (logFiles.length > this.config.maxLogFiles) {
        const filesToDelete = logFiles.slice(this.config.maxLogFiles);
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          this.info(`Deleted old log file: ${file.name}`, 'CLEANUP');
        }
      }
    } catch (error) {
      this.error(`Failed to cleanup logs: ${error}`, 'CLEANUP');
    }
  }
}

// Export singleton instance with stdout-only configuration
export const logger = Logger.getInstance({
  level: process.env.LOG_LEVEL === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO,
  enableFileLogging: false, // Disable file logging - use stdout only
  logFormat: 'json', // Always use JSON for structured logging
  enableConsoleLogging: true, // Always enable console/stdout logging
  maxLogFiles: parseInt(process.env.MAX_LOG_FILES || '7'), // Keep for compatibility
  maxLogSize: process.env.MAX_LOG_SIZE || '100MB'
});

// Backward compatibility function
export function log(message: string, category: string = 'APP') {
  logger.info(message, category.toUpperCase());
}
