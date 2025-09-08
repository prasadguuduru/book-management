/**
 * CloudWatch Metrics Service for Notification Service
 * Emits custom metrics for monitoring notification processing performance
 */

import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';
import { logger } from '../../utils/logger';

export class CloudWatchMetricsService {
  private cloudWatchClient: CloudWatchClient;
  private namespace: string;
  private environment: string;

  constructor() {
    const region = process.env['AWS_REGION'] || 'us-east-1';
    this.environment = process.env['ENVIRONMENT'] || 'dev';
    this.namespace = `EbookPlatform/Notifications/${this.environment}`;
    
    this.cloudWatchClient = new CloudWatchClient({ region });

    logger.info('📊 CLOUDWATCH METRICS SERVICE INITIALIZED', {
      region,
      namespace: this.namespace,
      environment: this.environment
    });
  }

  /**
   * Record notification processing success
   */
  async recordNotificationSuccess(notificationType: string, processingTimeMs: number): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'NotificationProcessed',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'Status', Value: 'Success' }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'NotificationProcessingTime',
          Value: processingTimeMs,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
      
      logger.debug('📊 NOTIFICATION SUCCESS METRICS RECORDED', {
        notificationType,
        processingTimeMs
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD SUCCESS METRICS', error instanceof Error ? error : new Error(String(error)), {
        notificationType,
        processingTimeMs
      });
    }
  }

  /**
   * Record notification processing failure
   */
  async recordNotificationFailure(notificationType: string, errorType: string, processingTimeMs: number): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'NotificationProcessed',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'Status', Value: 'Failed' }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'NotificationError',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'ErrorType', Value: errorType }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'NotificationProcessingTime',
          Value: processingTimeMs,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'Status', Value: 'Failed' }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
      
      logger.debug('📊 NOTIFICATION FAILURE METRICS RECORDED', {
        notificationType,
        errorType,
        processingTimeMs
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD FAILURE METRICS', error instanceof Error ? error : new Error(String(error)), {
        notificationType,
        errorType,
        processingTimeMs
      });
    }
  }

  /**
   * Record SQS batch processing metrics
   */
  async recordBatchProcessingMetrics(
    totalRecords: number,
    successfulRecords: number,
    failedRecords: number,
    processingTimeMs: number
  ): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'SQSBatchSize',
          Value: totalRecords,
          Unit: 'Count',
          Timestamp: new Date()
        },
        {
          MetricName: 'SQSBatchSuccessCount',
          Value: successfulRecords,
          Unit: 'Count',
          Timestamp: new Date()
        },
        {
          MetricName: 'SQSBatchFailureCount',
          Value: failedRecords,
          Unit: 'Count',
          Timestamp: new Date()
        },
        {
          MetricName: 'SQSBatchProcessingTime',
          Value: processingTimeMs,
          Unit: 'Milliseconds',
          Timestamp: new Date()
        }
      ];

      // Add success rate metric
      if (totalRecords > 0) {
        metrics.push({
          MetricName: 'SQSBatchSuccessRate',
          Value: (successfulRecords / totalRecords) * 100,
          Unit: 'Percent',
          Timestamp: new Date()
        });
      }

      await this.putMetrics(metrics);
      
      logger.debug('📊 BATCH PROCESSING METRICS RECORDED', {
        totalRecords,
        successfulRecords,
        failedRecords,
        processingTimeMs
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD BATCH METRICS', error instanceof Error ? error : new Error(String(error)), {
        totalRecords,
        successfulRecords,
        failedRecords,
        processingTimeMs
      });
    }
  }

  /**
   * Record email delivery metrics
   */
  async recordEmailDeliveryMetrics(
    notificationType: string,
    deliveryStatus: 'sent' | 'failed',
    deliveryTimeMs: number,
    errorType?: string
  ): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'EmailDelivery',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'DeliveryStatus', Value: deliveryStatus }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'EmailDeliveryTime',
          Value: deliveryTimeMs,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'DeliveryStatus', Value: deliveryStatus }
          ],
          Timestamp: new Date()
        }
      ];

      // Add error type metric if delivery failed
      if (deliveryStatus === 'failed' && errorType) {
        metrics.push({
          MetricName: 'EmailDeliveryError',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'ErrorType', Value: errorType }
          ],
          Timestamp: new Date()
        });
      }

      await this.putMetrics(metrics);
      
      logger.debug('📊 EMAIL DELIVERY METRICS RECORDED', {
        notificationType,
        deliveryStatus,
        deliveryTimeMs,
        errorType
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD EMAIL DELIVERY METRICS', error instanceof Error ? error : new Error(String(error)), {
        notificationType,
        deliveryStatus,
        deliveryTimeMs,
        errorType
      });
    }
  }

  /**
   * Record DLQ message metrics
   */
  async recordDLQMessage(notificationType: string, reason: string): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'DLQMessage',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'Reason', Value: reason }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
      
      logger.warn('📊 DLQ MESSAGE METRICS RECORDED', {
        notificationType,
        reason
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD DLQ METRICS', error instanceof Error ? error : new Error(String(error)), {
        notificationType,
        reason
      });
    }
  }

  /**
   * Put metrics to CloudWatch
   */
  private async putMetrics(metrics: MetricDatum[]): Promise<void> {
    try {
      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: metrics
      });

      await this.cloudWatchClient.send(command);
    } catch (error) {
      logger.error('❌ FAILED TO PUT METRICS TO CLOUDWATCH', error instanceof Error ? error : new Error(String(error)), {
        namespace: this.namespace,
        metricsCount: metrics.length
      });
      throw error;
    }
  }

  /**
   * Record performance alert metrics
   */
  async recordPerformanceAlert(
    operation: string,
    severity: 'WARNING' | 'CRITICAL',
    processingTimeMs: number,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'PerformanceAlert',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'Operation', Value: operation },
            { Name: 'Severity', Value: severity }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'PerformanceAlertProcessingTime',
          Value: processingTimeMs,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'Operation', Value: operation },
            { Name: 'Severity', Value: severity }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
      
      logger.warn('📊 PERFORMANCE ALERT METRICS RECORDED', {
        operation,
        severity,
        processingTimeMs,
        context
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD PERFORMANCE ALERT METRICS', error instanceof Error ? error : new Error(String(error)), {
        operation,
        severity,
        processingTimeMs
      });
    }
  }

  /**
   * Record system health metrics
   */
  async recordSystemHealthMetrics(
    memoryUsagePercent: number,
    uptimeSeconds: number,
    cpuUsagePercent?: number
  ): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'MemoryUsagePercent',
          Value: memoryUsagePercent,
          Unit: 'Percent',
          Timestamp: new Date()
        },
        {
          MetricName: 'UptimeSeconds',
          Value: uptimeSeconds,
          Unit: 'Seconds',
          Timestamp: new Date()
        }
      ];

      if (cpuUsagePercent !== undefined) {
        metrics.push({
          MetricName: 'CPUUsagePercent',
          Value: cpuUsagePercent,
          Unit: 'Percent',
          Timestamp: new Date()
        });
      }

      await this.putMetrics(metrics);
      
      logger.debug('📊 SYSTEM HEALTH METRICS RECORDED', {
        memoryUsagePercent,
        uptimeSeconds,
        cpuUsagePercent
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD SYSTEM HEALTH METRICS', error instanceof Error ? error : new Error(String(error)), {
        memoryUsagePercent,
        uptimeSeconds,
        cpuUsagePercent
      });
    }
  }

  /**
   * Record queue depth metrics
   */
  async recordQueueDepthMetrics(
    queueName: string,
    approximateNumberOfMessages: number,
    approximateNumberOfMessagesNotVisible: number
  ): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'QueueDepth',
          Value: approximateNumberOfMessages,
          Unit: 'Count',
          Dimensions: [
            { Name: 'QueueName', Value: queueName }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'QueueInFlightMessages',
          Value: approximateNumberOfMessagesNotVisible,
          Unit: 'Count',
          Dimensions: [
            { Name: 'QueueName', Value: queueName }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
      
      logger.debug('📊 QUEUE DEPTH METRICS RECORDED', {
        queueName,
        approximateNumberOfMessages,
        approximateNumberOfMessagesNotVisible
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD QUEUE DEPTH METRICS', error instanceof Error ? error : new Error(String(error)), {
        queueName,
        approximateNumberOfMessages,
        approximateNumberOfMessagesNotVisible
      });
    }
  }

  /**
   * Record error rate metrics
   */
  async recordErrorRateMetrics(
    operation: string,
    totalRequests: number,
    errorCount: number,
    timeWindowMinutes: number = 5
  ): Promise<void> {
    try {
      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

      const metrics: MetricDatum[] = [
        {
          MetricName: 'ErrorRate',
          Value: errorRate,
          Unit: 'Percent',
          Dimensions: [
            { Name: 'Operation', Value: operation },
            { Name: 'TimeWindow', Value: `${timeWindowMinutes}min` }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'TotalRequests',
          Value: totalRequests,
          Unit: 'Count',
          Dimensions: [
            { Name: 'Operation', Value: operation },
            { Name: 'TimeWindow', Value: `${timeWindowMinutes}min` }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'ErrorCount',
          Value: errorCount,
          Unit: 'Count',
          Dimensions: [
            { Name: 'Operation', Value: operation },
            { Name: 'TimeWindow', Value: `${timeWindowMinutes}min` }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
      
      logger.debug('📊 ERROR RATE METRICS RECORDED', {
        operation,
        totalRequests,
        errorCount,
        errorRate: `${errorRate.toFixed(2)}%`,
        timeWindowMinutes
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD ERROR RATE METRICS', error instanceof Error ? error : new Error(String(error)), {
        operation,
        totalRequests,
        errorCount
      });
    }
  }

  /**
   * Record CC email delivery metrics
   */
  async recordCCDeliveryMetrics(
    notificationType: string,
    totalCCEmails: number,
    successfulCCDeliveries: number,
    failedCCDeliveries: number
  ): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'CCEmailsTotal',
          Value: totalCCEmails,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'CCEmailsDelivered',
          Value: successfulCCDeliveries,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'DeliveryStatus', Value: 'Success' }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'CCEmailsFailed',
          Value: failedCCDeliveries,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'DeliveryStatus', Value: 'Failed' }
          ],
          Timestamp: new Date()
        }
      ];

      // Add CC delivery success rate if there were CC emails
      if (totalCCEmails > 0) {
        metrics.push({
          MetricName: 'CCDeliverySuccessRate',
          Value: (successfulCCDeliveries / totalCCEmails) * 100,
          Unit: 'Percent',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType }
          ],
          Timestamp: new Date()
        });
      }

      await this.putMetrics(metrics);
      
      logger.debug('📊 CC DELIVERY METRICS RECORDED', {
        notificationType,
        totalCCEmails,
        successfulCCDeliveries,
        failedCCDeliveries,
        successRate: totalCCEmails > 0 ? `${((successfulCCDeliveries / totalCCEmails) * 100).toFixed(2)}%` : 'N/A'
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD CC DELIVERY METRICS', error instanceof Error ? error : new Error(String(error)), {
        notificationType,
        totalCCEmails,
        successfulCCDeliveries,
        failedCCDeliveries
      });
    }
  }

  /**
   * Record CC email delivery failure
   */
  async recordCCDeliveryFailure(
    notificationType: string,
    ccEmailCount: number,
    errorType: string
  ): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'CCDeliveryFailure',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'ErrorType', Value: errorType }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'CCEmailsAffected',
          Value: ccEmailCount,
          Unit: 'Count',
          Dimensions: [
            { Name: 'NotificationType', Value: notificationType },
            { Name: 'ErrorType', Value: errorType }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
      
      logger.debug('📊 CC DELIVERY FAILURE METRICS RECORDED', {
        notificationType,
        ccEmailCount,
        errorType
      });
    } catch (error) {
      logger.error('❌ FAILED TO RECORD CC DELIVERY FAILURE METRICS', error instanceof Error ? error : new Error(String(error)), {
        notificationType,
        ccEmailCount,
        errorType
      });
    }
  }

  /**
   * Create a timer for measuring processing time
   */
  createTimer(): { stop: () => number } {
    const startTime = Date.now();
    
    return {
      stop: () => Date.now() - startTime
    };
  }
}

// Export singleton instance
export const cloudWatchMetrics = new CloudWatchMetricsService();