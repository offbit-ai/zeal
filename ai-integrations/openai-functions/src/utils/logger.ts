/**
 * Logger utility for OpenAI Functions server
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private context: string;

  constructor(context: string = 'OpenAI') {
    this.context = context;
    
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      this.level = LogLevel[envLevel as keyof typeof LogLevel] as unknown as LogLevel;
    }
  }

  private format(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level}] [${this.context}] ${message}`;
    
    if (data) {
      return `${base} ${JSON.stringify(data)}`;
    }
    
    return base;
  }

  error(message: string, error?: Error | any) {
    if (this.level >= LogLevel.ERROR) {
      const data = error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error;
      
      console.error(this.format('ERROR', message, data));
    }
  }

  warn(message: string, data?: any) {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.format('WARN', message, data));
    }
  }

  info(message: string, data?: any) {
    if (this.level >= LogLevel.INFO) {
      console.log(this.format('INFO', message, data));
    }
  }

  debug(message: string, data?: any) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(this.format('DEBUG', message, data));
    }
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }
}

export const logger = new Logger();