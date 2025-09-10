/**
 * Book Event Publisher
 * Handles publishing book status change events to SNS
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';
import { SharedLogger } from '../../shared/logging/logger';
import { getWorkflowServiceConfig, getCloudWatchNamespace, isDevelopmentEnvironment } from '../config/environment';

const logger = new SharedLogger('book-event-publisher');
import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';

import {
  BookStatusChangeEvent,
  BookStatusChangeEventData
} from '../../shared/events/book-workflow-events';
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

// Enhanced retry configuration interface
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

// SNS publish result interface
interface PublishResult {
  success: boolean;
  messageId?: string;
  error?: Error;
  retryCount: number;
  duration: number;
  errorType?: string;
}

// CloudWatch metrics service for SNS publishing
class SNSMetricsService {
  private cloudWatchClient: CloudWatchClient;
  private namespace: string;
  private environment: string;

  constructor() {
    const config = getWorkflowServiceConfig();
    this.environment = config.environment;
    this.namespace = getCloudWatchNamespace();
    
    this.cloudWatchClient = new CloudWatchClient({ region: config.awsRegion });
  }

  async recordSNSPublishSuccess(duration: number, eventType: string, retryCount: number = 0): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'SNSPublishSuccess',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Success' }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'SNSPublishDuration',
          Value: duration,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Success' }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'SNSPublishRetryCount',
          Value: retryCount,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Success' }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
    } catch (error) {
      logger.error('Failed to record SNS publish success metrics', error instanceof Error ? error : new Error(String(error)));
    }
  }

  async recordSNSPublishFailure(duration: number, eventType: string, errorType: string, retryCount: number = 0): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'SNSPublishFailure',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Failed' },
            { Name: 'ErrorType', Value: errorType }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'SNSPublishDuration',
          Value: duration,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Failed' }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'SNSPublishRetryCount',
          Value: retryCount,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Failed' }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
    } catch (error) {
      logger.error('Failed to record SNS publish failure metrics', error instanceof Error ? error : new Error(String(error)));
    }
  }

  async recordSNSPublishTimeout(duration: number, eventType: string, retryCount: number = 0): Promise<void> {
    try {
      const metrics: MetricDatum[] = [
        {
          MetricName: 'SNSPublishTimeout',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventType', Value: eventType }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'SNSPublishDuration',
          Value: duration,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Timeout' }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'SNSPublishRetryCount',
          Value: retryCount,
          Unit: 'Count',
          Dimensions: [
            { Name: 'EventType', Value: eventType },
            { Name: 'Status', Value: 'Timeout' }
          ],
          Timestamp: new Date()
        }
      ];

      await this.putMetrics(metrics);
    } catch (error) {
      logger.error('Failed to record SNS publish timeout metrics', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async putMetrics(metrics: MetricDatum[]): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: this.namespace,
      MetricData: metrics
    });

    await this.cloudWatchClient.send(command);
  }
}

// Simplified logging for event processing
const EventProcessingLogger = {
  logSNSPublishAttempt: (context: any) => logger.debug('SNS publish attempt', context),
  logSNSPublishSuccess: (context: any) => logger.info('SNS publish success', context),
  logSNSPublishFailure: (error: Error, context: any) => logger.error('SNS publish failure', error, context),
  logRetryAttempt: (context: any) => logger.warn('SNS publish retry attempt', context)
};

/**
 * Interface for book event publisher
 */
export interface BookEventPublisher {
  publishStatusChange(event: BookStatusChangeEventData): Promise<void>;
}

/**
 * Configuration for the SNS event publisher
 */
export interface SNSEventPublisherConfig {
  topicArn: string;
  region?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  retryConfig?: Partial<RetryConfig>;
}

/**
 * SNS implementation of BookEventPublisher
 */
export class SNSBookEventPublisher implements BookEventPublisher {
  private snsClient: SNSClient;
  private config: Required<SNSEventPublisherConfig>;
  private retryConfig: RetryConfig;
  private metricsService: SNSMetricsService;

  constructor(config: SNSEventPublisherConfig) {
    const envConfig = getWorkflowServiceConfig();
    
    this.config = {
      topicArn: config.topicArn,
      region: config.region || envConfig.awsRegion,
      retryAttempts: config.retryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      timeoutMs: config.timeoutMs || 30000, // Increased to 30 seconds for reliable delivery
      retryConfig: config.retryConfig || {}
    };

    // Enhanced retry configuration with exponential backoff
    this.retryConfig = {
      maxRetries: this.config.retryAttempts,
      baseDelay: this.config.retryDelayMs,
      maxDelay: 10000, // Reduced max delay for POC
      backoffMultiplier: 2,
      jitterEnabled: true,
      ...config.retryConfig
    };

    this.metricsService = new SNSMetricsService();

    // Use AWS SDK v3 with better timeout handling
    this.snsClient = new SNSClient({
      region: this.config.region,
      // Use localstack endpoint if in development
      ...(isDevelopmentEnvironment() && envConfig.localstackEndpoint && {
        endpoint: envConfig.localstackEndpoint
      }),
      // Better timeout configuration for Lambda
      requestHandler: {
        requestTimeout: this.config.timeoutMs,
        connectionTimeout: 10000 // 10 second connection timeout
      },
      maxAttempts: 1 // We handle retries manually
    });

    logger.info('SNS Book Event Publisher initialized', {
      topicArn: this.config.topicArn,
      region: this.config.region,
      retryAttempts: this.config.retryAttempts,
      timeoutMs: this.config.timeoutMs,
      retryConfig: this.retryConfig
    });
  }

  /**
   * Publishes a book status change event to SNS
   */
  async publishStatusChange(eventData: BookStatusChangeEventData): Promise<void> {
    const event = this.createBookStatusChangeEvent(eventData);
    const publishContext: EventProcessingContext = {
      eventId: event.eventId,
      bookId: eventData.bookId,
      notificationType: `${eventData.previousStatus}_to_${eventData.newStatus}`,
      statusTransition: `${eventData.previousStatus} -> ${eventData.newStatus}`,
      changedBy: eventData.changedBy,
      topicArn: this.config.topicArn
    };

    EventProcessingLogger.logSNSPublishAttempt(publishContext);

    const startTime = Date.now();
    try {
      const result = await this.publishEventWithRetry(event);
      const duration = Date.now() - startTime;
      
      // Record success metrics
      await this.metricsService.recordSNSPublishSuccess(
        duration, 
        event.eventType, 
        result.retryCount
      );

      EventProcessingLogger.logSNSPublishSuccess({
        ...publishContext,
        duration,
        messageId: result.messageId,
        retryCount: result.retryCount
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorType = this.categorizeError(error);
      
      // Record failure metrics
      await this.metricsService.recordSNSPublishFailure(
        duration, 
        event.eventType, 
        errorType,
        this.config.retryAttempts
      );

      EventProcessingLogger.logSNSPublishFailure(error instanceof Error ? error : new Error(String(error)), {
        ...publishContext,
        duration,
        errorType,
        finalFailure: true
      });

      throw error;
    }
  }

  /**
   * Creates a standardized book status change event
   */
  private createBookStatusChangeEvent(eventData: BookStatusChangeEventData): BookStatusChangeEvent {
    return {
      eventType: 'book_status_changed',
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      source: 'workflow-service',
      version: '1.0',
      data: eventData
    };
  }

  /**
   * Publishes event to SNS with enhanced retry logic
   */
  private async publishEventWithRetry(event: BookStatusChangeEvent): Promise<PublishResult> {
    let lastError: Error | null = null;
    let messageId: string | undefined;
    const retryContext: EventProcessingContext = {
      eventId: event.eventId,
      bookId: event.data.bookId,
      topicArn: this.config.topicArn,
      maxRetryAttempts: this.retryConfig.maxRetries
    };

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        messageId = await this.publishToSNS(event);
        const attemptDuration = Date.now() - attemptStartTime;

        EventProcessingLogger.logSNSPublishSuccess({
          ...retryContext,
          retryAttempt: attempt,
          attemptDuration,
          messageId,
          finalAttempt: true
        });

        return {
          success: true,
          messageId,
          retryCount: attempt - 1,
          duration: attemptDuration
        };

      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorType = this.categorizeError(lastError);

        // Record timeout metrics if it's a timeout error
        if (errorType === 'TIMEOUT') {
          await this.metricsService.recordSNSPublishTimeout(
            attemptDuration,
            event.eventType,
            attempt - 1
          );
        }

        EventProcessingLogger.logSNSPublishFailure(lastError, {
          ...retryContext,
          retryAttempt: attempt,
          attemptDuration,
          errorType,
          willRetry: attempt < this.retryConfig.maxRetries,
          isRetryable: this.isRetryableError(lastError)
        });

        // Don't retry if error is not retryable
        if (!this.isRetryableError(lastError)) {
          logger.warn('Non-retryable error encountered, stopping retry attempts', {
            eventId: event.eventId,
            errorType,
            error: lastError.message
          });
          break;
        }

        // Don't wait after the last attempt
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);

          EventProcessingLogger.logRetryAttempt({
            ...retryContext,
            retryAttempt: attempt + 1,
            delayMs: delay,
            errorType
          });

          await this.sleep(delay);
        }
      }
    }

    // All retries failed - this is a critical failure
    const finalError = new Error(`Failed to publish event after ${this.retryConfig.maxRetries} attempts: ${lastError?.message}`);

    EventProcessingLogger.logSNSPublishFailure(finalError, {
      ...retryContext,
      retryAttempt: this.retryConfig.maxRetries,
      finalFailure: true,
      lastErrorType: this.categorizeError(lastError)
    });

    throw finalError;
  }

  /**
   * Publishes event to SNS topic using AWS SDK v3
   */
  private async publishToSNS(event: BookStatusChangeEvent): Promise<string> {
    const message = JSON.stringify(event);
    const subject = `Book Status Changed: ${event.data.title}`;

    const command = new PublishCommand({
      TopicArn: this.config.topicArn,
      Message: message,
      Subject: subject,
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: event.eventType
        },
        bookId: {
          DataType: 'String',
          StringValue: event.data.bookId
        },
        newStatus: {
          DataType: 'String',
          StringValue: event.data.newStatus
        },
        source: {
          DataType: 'String',
          StringValue: event.source
        },
        timestamp: {
          DataType: 'String',
          StringValue: event.timestamp
        }
      }
    });

    logger.info('🔧 SNS PUBLISH PARAMETERS', {
      eventId: event.eventId,
      topicArn: this.config.topicArn,
      messageLength: message.length,
      subject,
      messageAttributesCount: 5,
      timeoutMs: this.config.timeoutMs
    });

    const publishStartTime = Date.now();
    
    try {
      logger.info('📡 CALLING SNS.PUBLISH (AWS SDK v3)', {
        eventId: event.eventId,
        topicArn: this.config.topicArn,
        timeoutMs: this.config.timeoutMs
      });

      // AWS SDK v3 handles timeouts internally with better connection management
      const result = await this.snsClient.send(command);
      const publishDuration = Date.now() - publishStartTime;

      logger.info('✅ SNS PUBLISH COMPLETED', {
        eventId: event.eventId,
        messageId: result.MessageId,
        publishDuration,
        topicArn: this.config.topicArn,
        timeoutMs: this.config.timeoutMs
      });

      return result.MessageId!;

    } catch (error) {
      const publishDuration = Date.now() - publishStartTime;
      const errorType = this.categorizeError(error);
      
      logger.error('SNS publish failed', error instanceof Error ? error : new Error(String(error)), {
        eventId: event.eventId,
        topicArn: this.config.topicArn,
        messageLength: message.length,
        publishDuration,
        errorType,
        timeoutMs: this.config.timeoutMs
      });

      throw error;
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelay);
    
    if (this.retryConfig.jitterEnabled) {
      // Add random jitter (±25% of the delay)
      const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
      return Math.max(0, cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  /**
   * Categorize error types for metrics and logging
   */
  private categorizeError(error: any): string {
    if (!error) return 'UNKNOWN';
    
    const errorMessage = error.message || String(error);
    const errorCode = error.code || error.statusCode;

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return 'TIMEOUT';
    }

    // Network errors
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED') || 
        errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT')) {
      return 'NETWORK_ERROR';
    }

    // AWS service errors
    if (errorCode === 'Throttling' || errorCode === 'ThrottlingException') {
      return 'THROTTLING';
    }

    if (errorCode === 'InvalidParameter' || errorCode === 'ValidationException') {
      return 'INVALID_PARAMETER';
    }

    if (errorCode === 'AccessDenied' || errorCode === 'UnauthorizedOperation') {
      return 'ACCESS_DENIED';
    }

    if (errorCode === 'ServiceUnavailable' || errorCode === 'InternalError') {
      return 'SERVICE_UNAVAILABLE';
    }

    // Topic-related errors
    if (errorMessage.includes('does not exist') || errorCode === 'NotFound') {
      return 'TOPIC_NOT_FOUND';
    }

    // Message size errors
    if (errorMessage.includes('too large') || errorCode === 'InvalidParameterValue') {
      return 'MESSAGE_TOO_LARGE';
    }

    return 'UNKNOWN';
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorType = this.categorizeError(error);
    
    // Retryable error types
    const retryableErrors = [
      'TIMEOUT',
      'NETWORK_ERROR',
      'THROTTLING',
      'SERVICE_UNAVAILABLE',
      'UNKNOWN'
    ];

    // Non-retryable error types
    const nonRetryableErrors = [
      'INVALID_PARAMETER',
      'ACCESS_DENIED',
      'TOPIC_NOT_FOUND',
      'MESSAGE_TOO_LARGE'
    ];

    if (nonRetryableErrors.includes(errorType)) {
      return false;
    }

    if (retryableErrors.includes(errorType)) {
      return true;
    }

    // Default to retryable for unknown errors
    return true;
  }
}

/**
 * Factory function to create a configured SNS event publisher
 */
export function createSNSEventPublisher(config?: Partial<SNSEventPublisherConfig>): SNSBookEventPublisher {
  const envConfig = getWorkflowServiceConfig();
  const topicArn = config?.topicArn || envConfig.bookWorkflowEventsTopicArn;

  if (!topicArn) {
    throw new Error('SNS Topic ARN is required. Set BOOK_WORKFLOW_EVENTS_TOPIC_ARN environment variable or provide in config.');
  }

  return new SNSBookEventPublisher({
    topicArn,
    timeoutMs: 30000, // Increased to 30 seconds for reliable delivery
    retryAttempts: 3, // Standard retry attempts
    retryDelayMs: 1000, // Standard retry delay
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterEnabled: true
    },
    ...config
  });
}



/**
 * Mock implementation for testing
 */
export class MockBookEventPublisher implements BookEventPublisher {
  private publishedEvents: BookStatusChangeEventData[] = [];

  async publishStatusChange(eventData: BookStatusChangeEventData): Promise<void> {
    logger.info('Mock: Publishing book status change event', {
      bookId: eventData.bookId,
      previousStatus: eventData.previousStatus,
      newStatus: eventData.newStatus
    });

    this.publishedEvents.push(eventData);
  }

  /**
   * Get all published events (for testing)
   */
  getPublishedEvents(): BookStatusChangeEventData[] {
    return [...this.publishedEvents];
  }

  /**
   * Clear published events (for testing)
   */
  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }
}