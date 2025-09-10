/**
 * Logging utilities and helpers for Lambda functions
 * Provides common logging patterns and middleware
 */

import { SharedLogger, LogMeta } from './logger';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Lambda logging context
 */
export interface LambdaLogContext extends LogMeta {
  functionName?: string;
  functionVersion?: string;
  memoryLimitInMB?: string;
  remainingTimeInMillis?: number;
  awsRequestId?: string;
  logGroupName?: string;
  logStreamName?: string;
}

/**
 * Create logger instance for Lambda function
 */
export function createLambdaLogger(serviceName: string, context?: Context): SharedLogger {
  const logger = new SharedLogger(serviceName);
  
  if (context) {
    // Generate correlation ID from AWS request ID or create new one
    const correlationId = context.awsRequestId || logger.generateCorrelationId();
    logger.setCorrelationId(correlationId);
    
    // Log Lambda context information
    logger.debug('Lambda context initialized', {
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      memoryLimitInMB: context.memoryLimitInMB,
      remainingTimeInMillis: context.getRemainingTimeInMillis(),
      awsRequestId: context.awsRequestId,
      logGroupName: context.logGroupName,
      logStreamName: context.logStreamName
    });
  }
  
  return logger;
}

/**
 * Extract request metadata from API Gateway event
 */
export function extractRequestMeta(event: APIGatewayProxyEvent): LogMeta {
  return {
    requestId: event.requestContext?.requestId,
    method: event.httpMethod,
    url: event.path,
    userAgent: event.headers?.['User-Agent'],
    ip: event.requestContext?.identity?.sourceIp,
    stage: event.requestContext?.stage,
    resourcePath: event.resource
  };
}

/**
 * Log API Gateway request
 */
export function logApiGatewayRequest(
  logger: SharedLogger, 
  event: APIGatewayProxyEvent, 
  additionalMeta?: LogMeta
): void {
  const requestMeta = extractRequestMeta(event);
  
  logger.httpRequest(
    event.httpMethod,
    event.path,
    logger['sanitizeHeaders'](event.headers),
    logger['sanitizeBody'](event.body),
    { ...requestMeta, ...additionalMeta }
  );
}

/**
 * Log API Gateway response
 */
export function logApiGatewayResponse(
  logger: SharedLogger,
  response: APIGatewayProxyResult,
  additionalMeta?: LogMeta
): void {
  logger.httpResponse(
    response.statusCode,
    response.headers,
    logger['sanitizeBody'](response.body),
    additionalMeta
  );
}

/**
 * Performance timing decorator
 */
export function withPerformanceLogging<T extends any[], R>(
  logger: SharedLogger,
  operationName: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    logger.debug(`⏱️ START: ${operationName}`, {
      operation: operationName,
      startTime
    });
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      logger.performance(`✅ COMPLETED: ${operationName}`, {
        operation: operationName,
        duration,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`❌ FAILED: ${operationName}`, error as Error, {
        operation: operationName,
        duration,
        success: false
      });
      
      throw error;
    }
  };
}

/**
 * Error logging helper
 */
export function logError(
  logger: SharedLogger,
  error: Error,
  context: string,
  additionalMeta?: LogMeta
): void {
  logger.error(`Error in ${context}`, error, {
    context,
    errorName: error.name,
    errorCode: (error as any).code,
    ...additionalMeta
  });
}

/**
 * Security event logging helper
 */
export function logSecurityEvent(
  logger: SharedLogger,
  eventType: string,
  details: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
  additionalMeta?: LogMeta
): void {
  logger.security(`🚨 SECURITY_EVENT: ${eventType} - ${details}`, {
    eventType,
    severity,
    ...additionalMeta
  });
}

/**
 * Audit event logging helper
 */
export function logAuditEvent(
  logger: SharedLogger,
  action: string,
  resource: string,
  userId?: string,
  additionalMeta?: LogMeta
): void {
  logger.audit(`📋 AUDIT: ${action} on ${resource}`, {
    action,
    resource,
    userId,
    ...additionalMeta
  });
}

/**
 * Database operation logging helper
 */
export function logDatabaseOperation(
  logger: SharedLogger,
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SCAN' | 'QUERY',
  table: string,
  key?: any,
  additionalMeta?: LogMeta
): void {
  logger.dbOperation(operation, table, key, additionalMeta);
}

/**
 * Lambda timeout monitoring
 */
export function monitorLambdaTimeout(
  logger: SharedLogger,
  context: Context,
  warningThresholdMs: number = 5000
): NodeJS.Timeout {
  const timeoutWarning = setTimeout(() => {
    const remainingTime = context.getRemainingTimeInMillis();
    if (remainingTime <= warningThresholdMs) {
      logger.timeoutWarning(remainingTime, {
        functionName: context.functionName,
        warningThresholdMs
      });
    }
  }, Math.max(0, context.getRemainingTimeInMillis() - warningThresholdMs));

  return timeoutWarning;
}

/**
 * Correlation ID middleware for Express-like frameworks
 */
export function correlationIdMiddleware(logger: SharedLogger) {
  return (req: any, res: any, next: any) => {
    const correlationId = req.headers['x-correlation-id'] || 
                         req.headers['x-request-id'] || 
                         logger.generateCorrelationId();
    
    logger.setCorrelationId(correlationId);
    
    // Add correlation ID to response headers
    res.setHeader('x-correlation-id', correlationId);
    
    next();
  };
}

/**
 * Structured error response logging
 */
export function logStructuredError(
  logger: SharedLogger,
  error: Error,
  statusCode: number,
  userMessage: string,
  additionalMeta?: LogMeta
): void {
  logger.error('Structured error response', error, {
    statusCode,
    userMessage,
    errorType: error.constructor.name,
    ...additionalMeta
  });
}

/**
 * Business logic operation logging
 */
export function logBusinessOperation(
  logger: SharedLogger,
  operation: string,
  entity: string,
  entityId: string,
  success: boolean,
  additionalMeta?: LogMeta
): void {
  const message = `🏢 BUSINESS_OP: ${operation} ${entity}`;
  
  if (success) {
    logger.info(`${message} - SUCCESS`, {
      operation,
      entity,
      entityId,
      success,
      ...additionalMeta
    });
  } else {
    logger.warn(`${message} - FAILED`, {
      operation,
      entity,
      entityId,
      success,
      ...additionalMeta
    });
  }
}

/**
 * External service call logging
 */
export function logExternalServiceCall(
  logger: SharedLogger,
  serviceName: string,
  operation: string,
  url?: string,
  additionalMeta?: LogMeta
): void {
  logger.debug(`🌐 EXTERNAL_SERVICE: ${serviceName} - ${operation}`, {
    serviceName,
    operation,
    url,
    ...additionalMeta
  });
}