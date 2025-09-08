/**
 * Structured Logger for Book Workflow Notifications
 * Provides comprehensive structured logging for event processing
 */

import { logger } from '../../utils/logger';

/**
 * Event processing context for structured logging
 */
export interface EventProcessingContext {
  requestId?: string;
  eventId?: string;
  messageId?: string;
  bookId?: string;
  notificationType?: string;
  statusTransition?: string;
  receiveCount?: number;
  processingTimeMs?: number;
  batchSize?: number;
  successCount?: number;
  failureCount?: number;
  errorType?: string;
  retryAttempt?: number;
  dlqReason?: string;
  emailDeliveryTimeMs?: number;
  queueDepth?: number;
  [key: string]: any;
}

/**
 * Performance timer for measuring processing times
 */
export interface PerformanceTimer {
  start: number;
  stop(): number;
  elapsed(): number;
}

/**
 * Structured logger for event processing
 */
export class EventProcessingLogger {
  /**
   * Log event processing start
   */
  static logEventProcessingStart(context: EventProcessingContext): void {
    logger.info('🔄 EVENT PROCESSING STARTED', {
      ...context,
      operation: 'EVENT_PROCESSING_START',
      category: 'EVENT_PROCESSING',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log event processing success
   */
  static logEventProcessingSuccess(context: EventProcessingContext): void {
    logger.info('✅ EVENT PROCESSING SUCCESS', {
      ...context,
      operation: 'EVENT_PROCESSING_SUCCESS',
      category: 'EVENT_PROCESSING',
      status: 'SUCCESS',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log event processing failure
   */
  static logEventProcessingFailure(error: Error, context: EventProcessingContext): void {
    logger.error('❌ EVENT PROCESSING FAILURE', error, {
      ...context,
      operation: 'EVENT_PROCESSING_FAILURE',
      category: 'EVENT_PROCESSING',
      status: 'FAILURE',
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log batch processing metrics
   */
  static logBatchProcessingMetrics(context: EventProcessingContext): void {
    const successRate = context.batchSize && context.batchSize > 0 
      ? ((context.successCount || 0) / context.batchSize * 100).toFixed(2)
      : '0';

    logger.info('📊 BATCH PROCESSING METRICS', {
      ...context,
      operation: 'BATCH_PROCESSING_METRICS',
      category: 'METRICS',
      successRate: `${successRate}%`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log email delivery attempt
   */
  static logEmailDeliveryAttempt(context: EventProcessingContext): void {
    logger.info('📧 EMAIL DELIVERY ATTEMPT', {
      ...context,
      operation: 'EMAIL_DELIVERY_ATTEMPT',
      category: 'EMAIL_DELIVERY',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log email delivery success
   */
  static logEmailDeliverySuccess(context: EventProcessingContext): void {
    logger.info('✅ EMAIL DELIVERY SUCCESS', {
      ...context,
      operation: 'EMAIL_DELIVERY_SUCCESS',
      category: 'EMAIL_DELIVERY',
      status: 'SUCCESS',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log email delivery failure
   */
  static logEmailDeliveryFailure(error: Error, context: EventProcessingContext): void {
    logger.error('❌ EMAIL DELIVERY FAILURE', error, {
      ...context,
      operation: 'EMAIL_DELIVERY_FAILURE',
      category: 'EMAIL_DELIVERY',
      status: 'FAILURE',
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log retry attempt
   */
  static logRetryAttempt(context: EventProcessingContext): void {
    logger.warn('🔄 RETRY ATTEMPT', {
      ...context,
      operation: 'RETRY_ATTEMPT',
      category: 'RETRY',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log DLQ message
   */
  static logDLQMessage(context: EventProcessingContext): void {
    logger.error('💀 MESSAGE SENT TO DLQ', new Error(context.dlqReason || 'Unknown reason'), {
      ...context,
      operation: 'DLQ_MESSAGE',
      category: 'DLQ',
      severity: 'HIGH',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log performance warning
   */
  static logPerformanceWarning(context: EventProcessingContext): void {
    logger.warn('⚠️ PERFORMANCE WARNING', {
      ...context,
      operation: 'PERFORMANCE_WARNING',
      category: 'PERFORMANCE',
      severity: 'MEDIUM',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log queue depth alert
   */
  static logQueueDepthAlert(context: EventProcessingContext): void {
    logger.warn('📈 QUEUE DEPTH ALERT', {
      ...context,
      operation: 'QUEUE_DEPTH_ALERT',
      category: 'QUEUE_MONITORING',
      severity: 'MEDIUM',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log event validation failure
   */
  static logEventValidationFailure(validationErrors: string[], context: EventProcessingContext): void {
    logger.error('❌ EVENT VALIDATION FAILURE', new Error(`Validation failed: ${validationErrors.join(', ')}`), {
      ...context,
      operation: 'EVENT_VALIDATION_FAILURE',
      category: 'VALIDATION',
      validationErrors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log SNS publish attempt
   */
  static logSNSPublishAttempt(context: EventProcessingContext): void {
    logger.info('📤 SNS PUBLISH ATTEMPT', {
      ...context,
      operation: 'SNS_PUBLISH_ATTEMPT',
      category: 'SNS_PUBLISHING',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log SNS publish success
   */
  static logSNSPublishSuccess(context: EventProcessingContext): void {
    logger.info('✅ SNS PUBLISH SUCCESS', {
      ...context,
      operation: 'SNS_PUBLISH_SUCCESS',
      category: 'SNS_PUBLISHING',
      status: 'SUCCESS',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log SNS publish failure
   */
  static logSNSPublishFailure(error: Error, context: EventProcessingContext): void {
    logger.error('❌ SNS PUBLISH FAILURE', error, {
      ...context,
      operation: 'SNS_PUBLISH_FAILURE',
      category: 'SNS_PUBLISHING',
      status: 'FAILURE',
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create a performance timer
   */
  static createTimer(): PerformanceTimer {
    const start = Date.now();
    
    return {
      start,
      stop(): number {
        const elapsed = Date.now() - start;
        return elapsed;
      },
      elapsed(): number {
        return Date.now() - start;
      }
    };
  }

  /**
   * Log performance metrics
   */
  static logPerformanceMetrics(operation: string, processingTimeMs: number, context: EventProcessingContext): void {
    const performanceLevel = processingTimeMs > 30000 ? 'CRITICAL' : 
                           processingTimeMs > 10000 ? 'WARNING' : 
                           processingTimeMs > 5000 ? 'SLOW' : 'NORMAL';

    const logLevel = performanceLevel === 'CRITICAL' ? 'error' :
                    performanceLevel === 'WARNING' ? 'warn' :
                    performanceLevel === 'SLOW' ? 'warn' : 'info';

    if (logLevel === 'error') {
      logger.error(`⏱️ PERFORMANCE METRICS: ${operation}`, new Error(`Performance ${performanceLevel}: ${processingTimeMs}ms`), {
        ...context,
        operation: 'PERFORMANCE_METRICS',
        category: 'PERFORMANCE',
        performanceLevel,
        processingTimeMs,
        timestamp: new Date().toISOString()
      });
    } else {
      logger[logLevel](`⏱️ PERFORMANCE METRICS: ${operation}`, {
        ...context,
        operation: 'PERFORMANCE_METRICS',
        category: 'PERFORMANCE',
        performanceLevel,
        processingTimeMs,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Log system health metrics
   */
  static logSystemHealthMetrics(context: EventProcessingContext): void {
    logger.info('💚 SYSTEM HEALTH METRICS', {
      ...context,
      operation: 'SYSTEM_HEALTH_METRICS',
      category: 'HEALTH',
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });
  }
}