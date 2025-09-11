/**
 * Enhanced logging utility for the ebook publishing platform
 * Provides comprehensive logging for debugging and monitoring
 */

import { config } from '../config/environment';

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  userAgent?: string | undefined;
  ip?: string | undefined;
  tokenId?: string | undefined;
  sessionId?: string;
  correlationId?: string;
  [key: string]: any;
}

class Logger {
  private logLevel: number;

  constructor() {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    this.logLevel = levels[config.logging.level] || 0; // Default to debug for POC
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      environment: config.environment,
      service: 'ebook-backend',
      version: process.env['npm_package_version'] || '1.0.0',
      ...context,
    };
    return JSON.stringify(logEntry, null, 2);
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
          cause: error.cause,
        } : undefined,
      };
      console.error(this.formatMessage('ERROR', message, errorContext));
    }
  }

  // Security-specific logging methods
  security(message: string, context?: LogContext): void {
    const securityContext = {
      ...context,
      category: 'SECURITY',
      severity: 'HIGH',
    };
    console.log(this.formatMessage('SECURITY', message, securityContext));
  }

  audit(message: string, context?: LogContext): void {
    const auditContext = {
      ...context,
      category: 'AUDIT',
      severity: 'MEDIUM',
    };
    console.log(this.formatMessage('AUDIT', message, auditContext));
  }

  performance(message: string, context?: LogContext): void {
    const perfContext = {
      ...context,
      category: 'PERFORMANCE',
    };
    console.log(this.formatMessage('PERF', message, perfContext));
  }

  // Function entry/exit logging
  functionEntry(functionName: string, args?: any, context?: LogContext): void {
    this.debug(`🔵 ENTER: ${functionName}`, {
      ...context,
      functionName,
      arguments: this.sanitizeArgs(args),
      operation: 'FUNCTION_ENTRY',
    });
  }

  functionExit(functionName: string, result?: any, context?: LogContext): void {
    this.debug(`🔴 EXIT: ${functionName}`, {
      ...context,
      functionName,
      result: this.sanitizeResult(result),
      operation: 'FUNCTION_EXIT',
    });
  }

  // State change logging
  stateChange(entity: string, from: any, to: any, context?: LogContext): void {
    this.info(`🔄 STATE_CHANGE: ${entity}`, {
      ...context,
      entity,
      fromState: from,
      toState: to,
      operation: 'STATE_CHANGE',
    });
  }

  // Database operation logging
  dbOperation(operation: string, table: string, key?: any, context?: LogContext): void {
    this.debug(`💾 DB_${operation.toUpperCase()}`, {
      ...context,
      operation: `DB_${operation.toUpperCase()}`,
      table,
      key: this.sanitizeKey(key),
    });
  }

  // JWT token logging
  tokenOperation(operation: string, tokenType: string, payload?: any, context?: LogContext): void {
    this.security(`🔐 TOKEN_${operation.toUpperCase()}: ${tokenType}`, {
      ...context,
      operation: `TOKEN_${operation.toUpperCase()}`,
      tokenType,
      payload: this.sanitizeTokenPayload(payload),
    });
  }

  // HTTP request/response logging
  httpRequest(method: string, url: string, headers?: any, body?: any, context?: LogContext): void {
    this.debug(`📥 HTTP_REQUEST: ${method} ${url}`, {
      ...context,
      method,
      url,
      headers: this.sanitizeHeaders(headers),
      body: this.sanitizeBody(body),
      operation: 'HTTP_REQUEST',
    });
  }

  httpResponse(statusCode: number, headers?: any, body?: any, context?: LogContext): void {
    this.debug(`📤 HTTP_RESPONSE: ${statusCode}`, {
      ...context,
      statusCode,
      headers: this.sanitizeHeaders(headers),
      body: this.sanitizeBody(body),
      operation: 'HTTP_RESPONSE',
    });
  }

  // Validation logging
  validation(type: string, success: boolean, errors?: any, context?: LogContext): void {
    const level = success ? 'debug' : 'warn';
    this[level](`✅ VALIDATION_${success ? 'SUCCESS' : 'FAILED'}: ${type}`, {
      ...context,
      validationType: type,
      success,
      errors,
      operation: 'VALIDATION',
    });
  }

  // Authorization logging
  authorization(resource: string, action: string, allowed: boolean, reason?: string, context?: LogContext): void {
    const level = allowed ? 'info' : 'warn';
    this[level](`🔒 AUTHORIZATION_${allowed ? 'GRANTED' : 'DENIED'}: ${action} on ${resource}`, {
      ...context,
      resource,
      action,
      allowed,
      reason,
      operation: 'AUTHORIZATION',
    });
  }

  // Private helper methods for sanitization
  private sanitizeArgs(args: any): any {
    if (!args) return undefined;
    if (typeof args === 'object') {
      const sanitized = { ...args };
      // Remove sensitive fields
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.refreshToken;
      delete sanitized.accessToken;
      return sanitized;
    }
    return args;
  }

  private sanitizeResult(result: any): any {
    if (!result) return undefined;
    if (typeof result === 'object') {
      const sanitized = { ...result };
      // Remove sensitive fields
      delete sanitized.hashedPassword;
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.refreshToken;
      delete sanitized.accessToken;
      return sanitized;
    }
    return result;
  }

  private sanitizeKey(key: any): any {
    if (!key) return undefined;
    if (typeof key === 'object') {
      return { ...key };
    }
    return key;
  }

  private sanitizeTokenPayload(payload: any): any {
    if (!payload) return undefined;
    return {
      userId: payload.userId,
      email: payload.email ? '***@***.***' : undefined,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
      aud: payload.aud,
      iss: payload.iss,
    };
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return undefined;
    const sanitized = { ...headers };
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    if (typeof body === 'object') {
      const sanitized = { ...body };
      // Remove sensitive fields
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.refreshToken;
      delete sanitized.accessToken;
      return sanitized;
    }
    return body;
  }
}

export const logger = new Logger();