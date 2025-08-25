/**
 * Logging utility for the ebook publishing platform
 */

import { config } from '../config/environment';

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

class Logger {
  private logLevel: number;

  constructor() {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.logLevel = levels[config.logging.level] || 1;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      environment: config.environment,
      ...context,
    };
    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.logLevel <= 0) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.logLevel <= 1) {
      console.log(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.logLevel <= 2) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.logLevel <= 3) {
      const errorContext = {
        ...context,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      };
      console.error(this.formatMessage('ERROR', message, errorContext));
    }
  }
}

export const logger = new Logger();