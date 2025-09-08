/**
 * SQS Event Handler for Book Workflow Notifications
 * Processes book status change events from SQS queue and sends email notifications
 */

import { SQSEvent, Context } from 'aws-lambda';
import { logger } from '../../utils/logger';
import { BookStatusChangeEvent, SQSBookEventRecord } from '../../shared/events/book-workflow-events';
import { extractEventsFromSQSRecords } from '../../shared/events/event-serialization';
import { validateBookStatusChangeEvent, EventValidationResult } from '../../shared/events/event-validation';


import { BookEventNotificationMapper } from '../services/book-event-notification-mapper';
import { sesService } from '../services/ses-service';
import { cloudWatchMetrics } from '../services/cloudwatch-metrics';
import { EnhancedSendEmailResult } from '../types/notification';
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
  recipientEmail?: string;
  emailSubject?: string;
  functionName?: string;
  remainingTimeMs?: number;
  willRetry?: boolean;
  willGoToDLQ?: boolean;
  batchItemFailuresCount?: number;
  ccEmails?: string[];
  ccEmailCount?: number;
  ccDeliverySuccessCount?: number;
  ccDeliveryFailureCount?: number;
  [key: string]: any;
}

import { EventProcessingLogger } from '../../shared/monitoring/structured-logger';
import { performanceMonitor } from '../../shared/monitoring/performance-monitor';

/**
 * SQS Event Processing Result with partial batch failure support
 */
export interface SQSProcessingResult {
  totalRecords: number;
  successfullyProcessed: number;
  failed: number;
  errors: Array<{
    messageId: string;
    error: string;
  }>;
  // For partial batch failure reporting
  batchItemFailures?: Array<{
    itemIdentifier: string;
  }>;
}

/**
 * SQS Event Handler Class
 * Handles batch processing of SQS messages containing book workflow events
 */
export class SQSEventHandler {
  private notificationMapper: BookEventNotificationMapper;

  constructor() {
    this.notificationMapper = new BookEventNotificationMapper();
  }

  /**
   * Main handler for SQS events with batch processing and partial failure support
   */
  async handleSQSEvent(event: SQSEvent, context: Context): Promise<SQSProcessingResult> {
    const requestId = context.awsRequestId;
    const batchProcessingContext: EventProcessingContext = {
      requestId,
      batchSize: event.Records.length,
      functionName: context.functionName,
      remainingTimeMs: context.getRemainingTimeInMillis()
    };

    return await performanceMonitor.monitorBatchProcessing(async () => {
      EventProcessingLogger.logEventProcessingStart(batchProcessingContext);
      
      const result: SQSProcessingResult = {
        totalRecords: event.Records.length,
        successfullyProcessed: 0,
        failed: 0,
        errors: [],
        batchItemFailures: []
      };

      // Convert SQS records to our internal format
      const sqsRecords: SQSBookEventRecord[] = event.Records.map(record => ({
        messageId: record.messageId,
        receiptHandle: record.receiptHandle,
        body: record.body,
        attributes: {
          ApproximateReceiveCount: record.attributes.ApproximateReceiveCount,
          SentTimestamp: record.attributes.SentTimestamp,
          SenderId: record.attributes.SenderId,
          ApproximateFirstReceiveTimestamp: record.attributes.ApproximateFirstReceiveTimestamp
        },
        messageAttributes: record.messageAttributes || {},
        md5OfBody: record.md5OfBody,
        eventSource: 'aws:sqs',
        eventSourceARN: record.eventSourceARN,
        awsRegion: record.awsRegion
      }));

      // Extract and validate events from SQS records
      const { validEvents, invalidRecords } = extractEventsFromSQSRecords(sqsRecords);

      logger.info('📊 SQS EVENT EXTRACTION RESULTS', {
        requestId,
        totalRecords: sqsRecords.length,
        validEvents: validEvents.length,
        invalidRecords: invalidRecords.length
      });

      // Handle invalid records - these should go to DLQ immediately
      for (const invalidRecord of invalidRecords) {
        const receiveCount = parseInt(invalidRecord.record.attributes.ApproximateReceiveCount, 10);
        
        result.failed++;
        result.errors.push({
          messageId: invalidRecord.record.messageId,
          error: `Invalid event format: ${invalidRecord.error}`
        });

        // Add to batch failures for retry/DLQ handling
        result.batchItemFailures!.push({
          itemIdentifier: invalidRecord.record.messageId
        });

        // Log validation failure with structured logging
        EventProcessingLogger.logEventValidationFailure([invalidRecord.error], {
          requestId,
          messageId: invalidRecord.record.messageId,
          receiveCount,
          willRetry: receiveCount < 3
        });

        // Record DLQ metrics if this will go to DLQ
        if (receiveCount >= 3) {
          await cloudWatchMetrics.recordDLQMessage('validation_failure', 'Invalid event format');
          EventProcessingLogger.logDLQMessage({
            requestId,
            messageId: invalidRecord.record.messageId,
            dlqReason: 'Invalid event format',
            receiveCount
          });
        }
      }

      // Process valid events
      for (const { event, record } of validEvents) {
        const receiveCount = parseInt(record.attributes.ApproximateReceiveCount, 10);
        const eventContext: EventProcessingContext = {
          requestId,
          messageId: record.messageId,
          eventId: event.eventId,
          bookId: event.data.bookId,
          notificationType: `${event.data.previousStatus}_to_${event.data.newStatus}`,
          statusTransition: `${event.data.previousStatus} -> ${event.data.newStatus}`,
          receiveCount
        };
        
        try {
          await this.processBookStatusChangeEvent(event, record, requestId);
          result.successfullyProcessed++;
          
          EventProcessingLogger.logEventProcessingSuccess(eventContext);

        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push({
            messageId: record.messageId,
            error: errorMessage
          });

          // Determine if this should be retried or sent to DLQ
          const shouldRetry = this.shouldRetryProcessing(error instanceof Error ? error : new Error(String(error)), record.attributes.ApproximateReceiveCount);
          
          if (shouldRetry) {
            // Add to batch failures for retry
            result.batchItemFailures!.push({
              itemIdentifier: record.messageId
            });
            
            EventProcessingLogger.logRetryAttempt({
              ...eventContext,
              retryAttempt: receiveCount + 1,
              errorType: error instanceof Error ? error.name : 'UnknownError'
            });
          } else {
            // Will go to DLQ
            await cloudWatchMetrics.recordDLQMessage(
              eventContext.notificationType || 'unknown',
              error instanceof Error ? error.name : 'UnknownError'
            );
            
            EventProcessingLogger.logDLQMessage({
              ...eventContext,
              dlqReason: errorMessage,
              errorType: error instanceof Error ? error.name : 'UnknownError'
            });
          }

          EventProcessingLogger.logEventProcessingFailure(
            error instanceof Error ? error : new Error(String(error)),
            {
              ...eventContext,
              willRetry: shouldRetry,
              willGoToDLQ: !shouldRetry
            }
          );
        }
      }

      // Update batch processing context with results
      const finalBatchContext: EventProcessingContext = {
        ...batchProcessingContext,
        successCount: result.successfullyProcessed,
        failureCount: result.failed,
        batchItemFailuresCount: result.batchItemFailures?.length || 0
      };

      EventProcessingLogger.logBatchProcessingMetrics(finalBatchContext);

      return result;
    }, batchProcessingContext);
  }

  /**
   * Process a single book status change event
   */
  private async processBookStatusChangeEvent(
    event: BookStatusChangeEvent,
    record: SQSBookEventRecord,
    requestId: string
  ): Promise<void> {
    const notificationType = `${event.data.previousStatus}_to_${event.data.newStatus}`;
    const eventContext: EventProcessingContext = {
      requestId,
      eventId: event.eventId,
      messageId: record.messageId,
      bookId: event.data.bookId,
      notificationType,
      statusTransition: `${event.data.previousStatus} -> ${event.data.newStatus}`,
      receiveCount: parseInt(record.attributes.ApproximateReceiveCount, 10)
    };

    return await performanceMonitor.monitorEventProcessing(async () => {
      // Additional event schema validation
      const validation = this.validateEventForProcessing(event);
      if (!validation.isValid) {
        EventProcessingLogger.logEventValidationFailure(validation.errors, eventContext);
        throw new Error(`Event validation failed: ${validation.errors.join(', ')}`);
      }

      // Map event to notification request
      const notificationRequest = this.notificationMapper.mapEventToNotification(event);
      if (!notificationRequest) {
        logger.info('ℹ️ NO NOTIFICATION REQUIRED FOR EVENT', {
          ...eventContext,
          reason: 'Status transition does not require notification'
        });
        return;
      }

      // Generate email content
      const emailContent = this.notificationMapper.generateEmailContent(
        notificationRequest.type,
        notificationRequest.variables || {}
      );

      // Extract CC emails from notification request
      const ccEmails = notificationRequest.ccEmails || [];
      const hasCCEmails = ccEmails.length > 0;

      // Send email via SES with performance monitoring and CC support
      const emailResult = await performanceMonitor.monitorEmailDelivery(async () => {
        EventProcessingLogger.logEmailDeliveryAttempt({
          ...eventContext,
          recipientEmail: notificationRequest.recipientEmail,
          emailSubject: emailContent.subject,
          ccEmails: hasCCEmails ? ccEmails : undefined,
          ccEmailCount: ccEmails.length
        });

        // Use enhanced SES service with CC support if CC emails are present
        if (hasCCEmails) {
          return await sesService.sendEmailWithCC({
            to: notificationRequest.recipientEmail,
            ccEmails: ccEmails,
            subject: emailContent.subject,
            htmlBody: emailContent.htmlBody,
            textBody: emailContent.textBody
          });
        } else {
          // Use standard email sending for backward compatibility
          return await sesService.sendEmail({
            to: notificationRequest.recipientEmail,
            subject: emailContent.subject,
            htmlBody: emailContent.htmlBody,
            textBody: emailContent.textBody
          });
        }
      }, eventContext);

      // Handle CC-specific error scenarios
      if (!emailResult.success) {
        // Check if this is a CC-related error
        const isCCError = hasCCEmails && emailResult.error && 
          (emailResult.error.includes('CC') || emailResult.error.includes('carbon copy'));
        
        if (isCCError) {
          logger.warn('⚠️ CC EMAIL DELIVERY FAILED', {
            ...eventContext,
            ccEmails,
            ccEmailCount: ccEmails.length,
            error: emailResult.error,
            primaryRecipient: notificationRequest.recipientEmail
          });
          
          // Record CC-specific failure metrics
          await cloudWatchMetrics.recordCCDeliveryFailure(
            notificationType,
            ccEmails.length,
            emailResult.error || 'Unknown CC error'
          );
        }
        
        throw new Error(`Failed to send email: ${emailResult.error}`);
      }

      // Record CC delivery success metrics if CC emails were sent
      if (hasCCEmails && 'ccDeliveryStatus' in emailResult) {
        const enhancedResult = emailResult as EnhancedSendEmailResult;
        const ccDeliveryStatus = enhancedResult.ccDeliveryStatus || [];
        const successfulCCDeliveries = ccDeliveryStatus.filter(status => status.success).length;
        const failedCCDeliveries = ccDeliveryStatus.filter(status => !status.success).length;

        // Record CC delivery metrics
        await cloudWatchMetrics.recordCCDeliveryMetrics(
          notificationType,
          ccEmails.length,
          successfulCCDeliveries,
          failedCCDeliveries
        );

        // Log CC delivery details
        if (failedCCDeliveries > 0) {
          const failedEmails = ccDeliveryStatus
            .filter(status => !status.success)
            .map(status => ({ email: status.email, error: status.error }));
          
          logger.warn('⚠️ PARTIAL CC DELIVERY FAILURE', {
            ...eventContext,
            totalCCEmails: ccEmails.length,
            successfulCCDeliveries,
            failedCCDeliveries,
            failedEmails,
            primaryRecipient: notificationRequest.recipientEmail
          });
        } else {
          logger.info('✅ ALL CC EMAILS DELIVERED SUCCESSFULLY', {
            ...eventContext,
            ccEmailCount: ccEmails.length,
            ccEmails,
            primaryRecipient: notificationRequest.recipientEmail
          });
        }
      }

      logger.info('✅ EMAIL SENT SUCCESSFULLY', {
        ...eventContext,
        messageId: emailResult.messageId,
        recipientEmail: notificationRequest.recipientEmail,
        emailSubject: emailContent.subject,
        ccEmailCount: ccEmails.length,
        ccEmails: hasCCEmails ? ccEmails : undefined
      });
    }, eventContext);
  }

  /**
   * Additional validation for event processing
   */
  private validateEventForProcessing(event: BookStatusChangeEvent): EventValidationResult {
    const errors: string[] = [];

    // Basic schema validation
    const schemaValidation = validateBookStatusChangeEvent(event);
    if (!schemaValidation.isValid) {
      errors.push(...schemaValidation.errors);
    }

    // Business logic validation
    if (!event.data.bookId || event.data.bookId.trim().length === 0) {
      errors.push('Book ID cannot be empty');
    }

    if (!event.data.title || event.data.title.trim().length === 0) {
      errors.push('Book title cannot be empty');
    }

    if (!event.data.author || event.data.author.trim().length === 0) {
      errors.push('Book author cannot be empty');
    }

    if (!event.data.changedBy || event.data.changedBy.trim().length === 0) {
      errors.push('Changed by user ID cannot be empty');
    }

    // Timestamp validation
    try {
      const eventTime = new Date(event.timestamp);
      const now = new Date();
      const timeDiff = now.getTime() - eventTime.getTime();
      
      // Warn if event is older than 1 hour (but don't fail)
      if (timeDiff > 60 * 60 * 1000) {
        logger.warn('⚠️ PROCESSING OLD EVENT', {
          eventId: event.eventId,
          eventTimestamp: event.timestamp,
          ageMinutes: Math.round(timeDiff / (60 * 1000))
        });
      }
    } catch (error) {
      errors.push('Invalid event timestamp format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Handle processing errors with retry logic
   * Determines whether a message should be retried or sent to DLQ
   */
  private shouldRetryProcessing(error: Error, receiveCount: string): boolean {
    const count = parseInt(receiveCount, 10);
    const maxRetries = 3;

    logger.info('🔄 EVALUATING RETRY DECISION', {
      errorMessage: error.message,
      receiveCount: count,
      maxRetries
    });

    // Don't retry validation errors - these are permanent failures
    if (error.message.includes('validation failed') || 
        error.message.includes('Invalid event format') ||
        error.message.includes('Event validation failed')) {
      logger.info('❌ NO RETRY - VALIDATION ERROR', {
        errorMessage: error.message,
        reason: 'Validation errors are permanent failures'
      });
      return false;
    }

    // Don't retry if we've exceeded max attempts
    if (count >= maxRetries) {
      logger.info('❌ NO RETRY - MAX ATTEMPTS EXCEEDED', {
        receiveCount: count,
        maxRetries,
        reason: 'Maximum retry attempts exceeded'
      });
      return false;
    }

    // Don't retry certain SES errors that are permanent
    if (error.message.includes('Invalid email address') ||
        error.message.includes('Email address not verified') ||
        error.message.includes('Sending quota exceeded')) {
      logger.info('❌ NO RETRY - PERMANENT SES ERROR', {
        errorMessage: error.message,
        reason: 'SES error is permanent'
      });
      return false;
    }

    // Handle CC-specific errors - some should be retried, others shouldn't
    if (error.message.includes('CC') || error.message.includes('carbon copy')) {
      // Don't retry CC configuration errors (permanent)
      if (error.message.includes('Invalid CC email address') ||
          error.message.includes('CC email validation failed')) {
        logger.info('❌ NO RETRY - PERMANENT CC ERROR', {
          errorMessage: error.message,
          reason: 'CC configuration error is permanent'
        });
        return false;
      }
      
      // Retry transient CC errors (like temporary SES issues affecting CC)
      if (error.message.includes('CC delivery failed') ||
          error.message.includes('Partial CC failure')) {
        logger.info('✅ WILL RETRY - TRANSIENT CC ERROR', {
          errorMessage: error.message,
          receiveCount: count,
          attemptsRemaining: maxRetries - count,
          reason: 'CC delivery error may be transient'
        });
        return true;
      }
    }

    // Retry transient errors
    logger.info('✅ WILL RETRY', {
      errorMessage: error.message,
      receiveCount: count,
      attemptsRemaining: maxRetries - count,
      reason: 'Transient error - will retry'
    });
    
    return true;
  }
}

/**
 * Lambda handler function for SQS events with partial batch failure support
 */
export const sqsHandler = async (event: SQSEvent, context: Context): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> => {
  const handler = new SQSEventHandler();
  const result = await handler.handleSQSEvent(event, context);
  
  // Return only the batch item failures for Lambda's partial batch failure handling
  return {
    batchItemFailures: result.batchItemFailures || []
  };
};