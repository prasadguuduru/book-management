/**
 * Unified logging system for Lambda functions
 * Provides consistent log formats, correlation IDs, and structured logging
 */

import { v4 as uuidv4 } from 'uuid';

export interface LogMeta {
  requestId?: string | undefined;
  correlationId?: string | undefined;
  userId?: string | undefined;
  operation?: string | undefined;
  duration?: number | undefined;
  statusCode?: number | undefined;
  method?: string | undefined;
  url?: string | undefined;
  userAgent?: string | undefined;
  ip?: string | undefined;
  sessionId?: string | undefined;
  functionName?: string | undefined;
  service?: string | undefined;
  [key: string]: any;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string | undefined;
  requestId?: string | undefined;
  service: string;
  environment: string;
  version: string;
  meta?: LogMeta;
  error?: {
    name: string;
    message: string;
    stack?: string | undefined;
    code?: string | undefined;
  };
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SECURITY' | 'AUDIT' | 'PERFORMANCE';

/**
 * Shared logger class providing unified logging functionality
 */
export class SharedLogger {
  private logLevel: number;
  private service: string;
  private environment: string;
  private version: string;
  private correlationId?: string;

  constructor(service: string = 'lambda-service', environment?: string) {
    const levels: Record<string, number> = { 
      DEBUG: 0, 
      INFO: 1, 
      WARN: 2, 
      ERROR: 3, 
      SECURITY: 1, 
      AUDIT: 1, 
      PERFORMANCE: 1 
    };
    
    const configLevel = process.env['LOG_LEVEL'] || 'DEBUG'; // Default to DEBUG for testing
    this.logLevel = levels[configLevel.toUpperCase()] || 0;
    this.service = service;
    this.environment = environment || process.env['NODE_ENV'] || 'development';
    this.version = process.env['npm_package_version'] || '1.0.0';
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Generate new correlation ID
   */
  generateCorrelationId(): string {
    this.correlationId = uuidv4();
    return this.correlationId;
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(
    level: LogLevel, 
    message: string, 
    meta?: LogMeta, 
    error?: Error
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      environment: this.environment,
      version: this.version,
      correlationId: this.correlationId || meta?.correlationId,
      requestId: meta?.requestId
    };

    if (meta) {
      entry.meta = this.sanitizeMeta(meta);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack || undefined,
        code: (error as any).code || undefined
      };
    }

    return entry;
  }

  /**
   * Output log entry to console
   */
  private output(entry: StructuredLogEntry): void {
    const logString = JSON.stringify(entry);
    
    switch (entry.level) {
      case 'ERROR':
      case 'SECURITY':
        console.error(logString);
        break;
      case 'WARN':
        console.warn(logString);
        break;
      default:
        console.log(logString);
    }
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      SECURITY: 1,
      AUDIT: 1,
      PERFORMANCE: 1
    };

    return levels[level] >= this.logLevel;
  }

  /**
   * Debug level logging
   */
  debug(message: string, meta?: LogMeta): void {
    if (this.shouldLog('DEBUG')) {
      const entry = this.createLogEntry('DEBUG', message, meta);
      this.output(entry);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, meta?: LogMeta): void {
    if (this.shouldLog('INFO')) {
      const entry = this.createLogEntry('INFO', message, meta);
      this.output(entry);
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, meta?: LogMeta): void {
    if (this.shouldLog('WARN')) {
      const entry = this.createLogEntry('WARN', message, meta);
      this.output(entry);
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error: Error, meta?: LogMeta): void {
    if (this.shouldLog('ERROR')) {
      const entry = this.createLogEntry('ERROR', message, meta, error);
      this.output(entry);
    }
  }

  /**
   * Security event logging
   */
  security(message: string, meta?: LogMeta): void {
    if (this.shouldLog('SECURITY')) {
      const securityMeta = {
        category: 'SECURITY',
        severity: meta?.['severity'] || 'HIGH',
        ...meta
      };
      const entry = this.createLogEntry('SECURITY', message, securityMeta);
      this.output(entry);
    }
  }

  /**
   * Audit event logging
   */
  audit(message: string, meta?: LogMeta): void {
    if (this.shouldLog('AUDIT')) {
      const auditMeta = {
        ...meta,
        category: 'AUDIT',
        severity: 'MEDIUM'
      };
      const entry = this.createLogEntry('AUDIT', message, auditMeta);
      this.output(entry);
    }
  }

  /**
   * Performance logging
   */
  performance(message: string, meta?: LogMeta): void {
    if (this.shouldLog('PERFORMANCE')) {
      const perfMeta = {
        ...meta,
        category: 'PERFORMANCE'
      };
      const entry = this.createLogEntry('PERFORMANCE', message, perfMeta);
      this.output(entry);
    }
  }

  /**
   * Function entry logging
   */
  functionEntry(functionName: string, input: any, meta?: LogMeta): void {
    this.debug(`🔵 ENTER: ${functionName}`, {
      ...meta,
      functionName,
      operation: 'FUNCTION_ENTRY',
      input: this.sanitizeInput(input)
    });
  }

  /**
   * Function exit logging
   */
  functionExit(functionName: string, output: any, meta?: LogMeta): void {
    this.debug(`🔴 EXIT: ${functionName}`, {
      ...meta,
      functionName,
      operation: 'FUNCTION_EXIT',
      output: this.sanitizeOutput(output)
    });
  }

  /**
   * State change logging
   */
  stateChange(entity: string, from: any, to: any, meta?: LogMeta): void {
    this.info(`🔄 STATE_CHANGE: ${entity}`, {
      ...meta,
      entity,
      fromState: from,
      toState: to,
      operation: 'STATE_CHANGE'
    });
  }

  /**
   * Database operation logging
   */
  dbOperation(operation: string, table: string, key?: any, meta?: LogMeta): void {
    this.debug(`💾 DB_${operation.toUpperCase()}`, {
      ...meta,
      operation: `DB_${operation.toUpperCase()}`,
      table,
      key: this.sanitizeKey(key)
    });
  }

  /**
   * HTTP request logging
   */
  httpRequest(method: string, url: string, headers?: any, body?: any, meta?: LogMeta): void {
    this.debug(`📥 HTTP_REQUEST: ${method} ${url}`, {
      ...meta,
      method,
      url,
      headers: this.sanitizeHeaders(headers),
      body: this.sanitizeBody(body),
      operation: 'HTTP_REQUEST'
    });
  }

  /**
   * HTTP response logging
   */
  httpResponse(statusCode: number, headers?: any, body?: any, meta?: LogMeta): void {
    this.debug(`📤 HTTP_RESPONSE: ${statusCode}`, {
      ...meta,
      statusCode,
      headers: this.sanitizeHeaders(headers),
      body: this.sanitizeBody(body),
      operation: 'HTTP_RESPONSE'
    });
  }

  /**
   * Validation logging
   */
  validation(type: string, success: boolean, errors?: any, meta?: LogMeta): void {
    const message = `✅ VALIDATION_${success ? 'SUCCESS' : 'FAILED'}: ${type}`;
    const validationMeta = {
      ...meta,
      validationType: type,
      success,
      errors,
      operation: 'VALIDATION'
    };

    if (success) {
      this.debug(message, validationMeta);
    } else {
      this.warn(message, validationMeta);
    }
  }

  /**
   * Authorization logging
   */
  authorization(resource: string, action: string, allowed: boolean, reason?: string, meta?: LogMeta): void {
    const message = `🔒 AUTHORIZATION_${allowed ? 'GRANTED' : 'DENIED'}: ${action} on ${resource}`;
    const authMeta = {
      ...meta,
      resource,
      action,
      allowed,
      reason,
      operation: 'AUTHORIZATION'
    };

    if (allowed) {
      this.info(message, authMeta);
    } else {
      this.warn(message, authMeta);
    }
  }

  /**
   * Lambda cold start logging
   */
  coldStart(meta?: LogMeta): void {
    this.info('❄️ LAMBDA_COLD_START', {
      ...meta,
      operation: 'COLD_START'
    });
  }

  /**
   * Lambda timeout warning
   */
  timeoutWarning(remainingTime: number, meta?: LogMeta): void {
    this.warn('⏰ LAMBDA_TIMEOUT_WARNING', {
      ...meta,
      remainingTime,
      operation: 'TIMEOUT_WARNING'
    });
  }

  // Private sanitization methods
  private sanitizeMeta(meta: LogMeta): LogMeta {
    const sanitized = { ...meta };
    
    // Remove sensitive fields
    delete sanitized['password'];
    delete sanitized['token'];
    delete sanitized['refreshToken'];
    delete sanitized['accessToken'];
    delete sanitized['authorization'];
    
    return sanitized;
  }

  private sanitizeInput(input: any): any {
    if (!input) return undefined;
    if (typeof input === 'object') {
      const sanitized = { ...input };
      delete sanitized['password'];
      delete sanitized['token'];
      delete sanitized['refreshToken'];
      delete sanitized['accessToken'];
      return sanitized;
    }
    return input;
  }

  private sanitizeOutput(output: any): any {
    if (!output) return undefined;
    if (typeof output === 'object') {
      const sanitized = { ...output };
      delete sanitized['hashedPassword'];
      delete sanitized['password'];
      delete sanitized['token'];
      delete sanitized['refreshToken'];
      delete sanitized['accessToken'];
      return sanitized;
    }
    return output;
  }

  private sanitizeKey(key: any): any {
    if (!key) return undefined;
    if (typeof key === 'object') {
      return { ...key };
    }
    return key;
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return undefined;
    const sanitized = { ...headers };
    delete sanitized['authorization'];
    delete sanitized['cookie'];
    delete sanitized['x-api-key'];
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    if (typeof body === 'object') {
      const sanitized = { ...body };
      delete sanitized['password'];
      delete sanitized['token'];
      delete sanitized['refreshToken'];
      delete sanitized['accessToken'];
      return sanitized;
    }
    return body;
  }
}