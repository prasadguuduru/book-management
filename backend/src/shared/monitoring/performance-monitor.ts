/**
 * Performance Monitoring Service
 * Provides comprehensive performance monitoring for event processing
 */

import { logger } from '../../utils/logger';
import { cloudWatchMetrics } from '../../notification-service/services/cloudwatch-metrics';
// Local type definition for event processing context
interface EventProcessingContext {
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

// Import structured logger with fallback
let EventProcessingLogger: any;

try {
  const structuredLogger = require('./structured-logger');
  EventProcessingLogger = structuredLogger.EventProcessingLogger;
} catch (error) {
  // Fallback for Lambda deployment
  EventProcessingLogger = {
    logPerformanceMetrics: (operation: string, processingTimeMs: number, context: any) => {
      logger.info(`Performance metrics: ${operation}`, { ...context, processingTimeMs });
    }
  };
}

/**
 * Performance thresholds for different operations
 */
export interface PerformanceThresholds {
  eventProcessing: {
    warning: number;    // ms
    critical: number;   // ms
  };
  emailDelivery: {
    warning: number;    // ms
    critical: number;   // ms
  };
  batchProcessing: {
    warning: number;    // ms
    critical: number;   // ms
  };
  snsPublishing: {
    warning: number;    // ms
    critical: number;   // ms
  };
}

/**
 * Default performance thresholds
 */
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  eventProcessing: {
    warning: 5000,    // 5 seconds
    critical: 30000   // 30 seconds
  },
  emailDelivery: {
    warning: 3000,    // 3 seconds
    critical: 10000   // 10 seconds
  },
  batchProcessing: {
    warning: 10000,   // 10 seconds
    critical: 60000   // 60 seconds
  },
  snsPublishing: {
    warning: 2000,    // 2 seconds
    critical: 5000    // 5 seconds
  }
};

/**
 * Performance monitoring service
 */
export class PerformanceMonitor {
  private thresholds: PerformanceThresholds;
  private environment: string;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds
    };
    this.environment = process.env['ENVIRONMENT'] || 'dev';

    logger.info('📊 PERFORMANCE MONITOR INITIALIZED', {
      thresholds: this.thresholds,
      environment: this.environment
    });
  }

  /**
   * Monitor event processing performance
   */
  async monitorEventProcessing<T>(
    operation: () => Promise<T>,
    context: EventProcessingContext
  ): Promise<T> {
    const timer = EventProcessingLogger.createTimer();
    const operationName = 'EVENT_PROCESSING';

    EventProcessingLogger.logEventProcessingStart(context);

    try {
      const result = await operation();
      const processingTime = timer.stop();

      // Log performance metrics
      EventProcessingLogger.logPerformanceMetrics(operationName, processingTime, {
        ...context,
        processingTimeMs: processingTime
      });

      // Check performance thresholds
      await this.checkPerformanceThresholds(
        operationName,
        processingTime,
        this.thresholds.eventProcessing,
        context
      );

      // Record success metrics
      await cloudWatchMetrics.recordNotificationSuccess(
        context.notificationType || 'unknown',
        processingTime
      );

      EventProcessingLogger.logEventProcessingSuccess({
        ...context,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      const processingTime = timer.stop();
      const err = error instanceof Error ? error : new Error(String(error));

      // Log failure
      EventProcessingLogger.logEventProcessingFailure(err, {
        ...context,
        processingTimeMs: processingTime
      });

      // Record failure metrics
      await cloudWatchMetrics.recordNotificationFailure(
        context.notificationType || 'unknown',
        err.name,
        processingTime
      );

      throw error;
    }
  }

  /**
   * Monitor email delivery performance
   */
  async monitorEmailDelivery<T>(
    operation: () => Promise<T>,
    context: EventProcessingContext
  ): Promise<T> {
    const timer = EventProcessingLogger.createTimer();
    const operationName = 'EMAIL_DELIVERY';

    EventProcessingLogger.logEmailDeliveryAttempt(context);

    try {
      const result = await operation();
      const deliveryTime = timer.stop();

      // Log performance metrics
      EventProcessingLogger.logPerformanceMetrics(operationName, deliveryTime, {
        ...context,
        emailDeliveryTimeMs: deliveryTime
      });

      // Check performance thresholds
      await this.checkPerformanceThresholds(
        operationName,
        deliveryTime,
        this.thresholds.emailDelivery,
        context
      );

      // Record email delivery metrics
      await cloudWatchMetrics.recordEmailDeliveryMetrics(
        context.notificationType || 'unknown',
        'sent',
        deliveryTime
      );

      EventProcessingLogger.logEmailDeliverySuccess({
        ...context,
        emailDeliveryTimeMs: deliveryTime
      });

      return result;

    } catch (error) {
      const deliveryTime = timer.stop();
      const err = error instanceof Error ? error : new Error(String(error));

      // Log failure
      EventProcessingLogger.logEmailDeliveryFailure(err, {
        ...context,
        emailDeliveryTimeMs: deliveryTime
      });

      // Record failure metrics
      await cloudWatchMetrics.recordEmailDeliveryMetrics(
        context.notificationType || 'unknown',
        'failed',
        deliveryTime,
        err.name
      );

      throw error;
    }
  }

  /**
   * Monitor batch processing performance
   */
  async monitorBatchProcessing<T>(
    operation: () => Promise<T>,
    context: EventProcessingContext
  ): Promise<T> {
    const timer = EventProcessingLogger.createTimer();
    const operationName = 'BATCH_PROCESSING';

    logger.info('📦 BATCH PROCESSING STARTED', {
      ...context,
      batchSize: context.batchSize
    });

    try {
      const result = await operation();
      const processingTime = timer.stop();

      // Log performance metrics
      EventProcessingLogger.logPerformanceMetrics(operationName, processingTime, {
        ...context,
        processingTimeMs: processingTime
      });

      // Log batch metrics
      EventProcessingLogger.logBatchProcessingMetrics({
        ...context,
        processingTimeMs: processingTime
      });

      // Check performance thresholds
      await this.checkPerformanceThresholds(
        operationName,
        processingTime,
        this.thresholds.batchProcessing,
        context
      );

      // Record batch processing metrics
      await cloudWatchMetrics.recordBatchProcessingMetrics(
        context.batchSize || 0,
        context.successCount || 0,
        context.failureCount || 0,
        processingTime
      );

      logger.info('✅ BATCH PROCESSING COMPLETED', {
        ...context,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      const processingTime = timer.stop();
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error('❌ BATCH PROCESSING FAILED', err, {
        ...context,
        processingTimeMs: processingTime
      });

      throw error;
    }
  }

  /**
   * Monitor SNS publishing performance
   */
  async monitorSNSPublishing<T>(
    operation: () => Promise<T>,
    context: EventProcessingContext
  ): Promise<T> {
    const timer = EventProcessingLogger.createTimer();
    const operationName = 'SNS_PUBLISHING';

    EventProcessingLogger.logSNSPublishAttempt(context);

    try {
      const result = await operation();
      const publishingTime = timer.stop();

      // Log performance metrics
      EventProcessingLogger.logPerformanceMetrics(operationName, publishingTime, {
        ...context,
        snsPublishingTimeMs: publishingTime
      });

      // Check performance thresholds
      await this.checkPerformanceThresholds(
        operationName,
        publishingTime,
        this.thresholds.snsPublishing,
        context
      );

      EventProcessingLogger.logSNSPublishSuccess({
        ...context,
        snsPublishingTimeMs: publishingTime
      });

      return result;

    } catch (error) {
      const publishingTime = timer.stop();
      const err = error instanceof Error ? error : new Error(String(error));

      EventProcessingLogger.logSNSPublishFailure(err, {
        ...context,
        snsPublishingTimeMs: publishingTime
      });

      throw error;
    }
  }

  /**
   * Check performance thresholds and log warnings/alerts
   */
  private async checkPerformanceThresholds(
    operation: string,
    processingTime: number,
    thresholds: { warning: number; critical: number },
    context: EventProcessingContext
  ): Promise<void> {
    if (processingTime >= thresholds.critical) {
      EventProcessingLogger.logPerformanceWarning({
        ...context,
        operation,
        processingTimeMs: processingTime,
        threshold: 'CRITICAL',
        thresholdValue: thresholds.critical,
        severity: 'CRITICAL'
      });

      // Emit CloudWatch metric for critical performance
      await this.emitPerformanceAlert('CRITICAL', operation, processingTime, context);

    } else if (processingTime >= thresholds.warning) {
      EventProcessingLogger.logPerformanceWarning({
        ...context,
        operation,
        processingTimeMs: processingTime,
        threshold: 'WARNING',
        thresholdValue: thresholds.warning,
        severity: 'WARNING'
      });

      // Emit CloudWatch metric for warning performance
      await this.emitPerformanceAlert('WARNING', operation, processingTime, context);
    }
  }

  /**
   * Emit performance alert to CloudWatch
   */
  private async emitPerformanceAlert(
    severity: 'WARNING' | 'CRITICAL',
    operation: string,
    processingTime: number,
    context: EventProcessingContext
  ): Promise<void> {
    try {
      // Use the existing CloudWatch metrics service to emit custom metrics
      const metricName = `PerformanceAlert_${severity}`;
      
      // We'll add this method to the CloudWatch metrics service
      // For now, log the alert
      logger.warn(`🚨 PERFORMANCE ALERT: ${severity}`, {
        ...context,
        operation,
        processingTimeMs: processingTime,
        severity,
        alertType: 'PERFORMANCE_THRESHOLD_EXCEEDED'
      });

    } catch (error) {
      logger.error('Failed to emit performance alert', error instanceof Error ? error : new Error(String(error)), {
        operation,
        severity,
        processingTime
      });
    }
  }

  /**
   * Monitor system health and emit metrics
   */
  async monitorSystemHealth(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      const cpuUsage = process.cpuUsage();

      const healthContext: EventProcessingContext = {
        operation: 'SYSTEM_HEALTH_CHECK',
        memoryUsageHeapUsed: memoryUsage.heapUsed,
        memoryUsageHeapTotal: memoryUsage.heapTotal,
        memoryUsageRSS: memoryUsage.rss,
        memoryUsageExternal: memoryUsage.external,
        uptimeSeconds: uptime,
        cpuUserTime: cpuUsage.user,
        cpuSystemTime: cpuUsage.system
      };

      EventProcessingLogger.logSystemHealthMetrics(healthContext);

      // Check memory usage thresholds
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      if (memoryUsagePercent > 90) {
        logger.warn('🚨 HIGH MEMORY USAGE ALERT', {
          ...healthContext,
          memoryUsagePercent,
          severity: 'HIGH'
        });
      } else if (memoryUsagePercent > 75) {
        logger.warn('⚠️ ELEVATED MEMORY USAGE', {
          ...healthContext,
          memoryUsagePercent,
          severity: 'MEDIUM'
        });
      }

    } catch (error) {
      logger.error('Failed to monitor system health', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get current performance thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };

    logger.info('📊 PERFORMANCE THRESHOLDS UPDATED', {
      thresholds: this.thresholds
    });
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();