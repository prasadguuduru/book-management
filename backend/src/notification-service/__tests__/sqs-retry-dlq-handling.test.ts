/**
 * Tests for SQS retry and DLQ handling functionality
 * Verifies proper retry logic and partial batch failure reporting
 */

import { SQSEvent, Context } from 'aws-lambda';
import { SQSEventHandler } from '../handlers/sqs-event-handler';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../utils/logger');
jest.mock('../services/book-event-notification-mapper');
jest.mock('../services/ses-service');
jest.mock('../services/cloudwatch-metrics');

// Mock the event extraction to return valid events for testing
jest.mock('../../shared/events/event-serialization', () => ({
  extractEventsFromSQSRecords: jest.fn()
}));

describe('SQS Retry and DLQ Handling', () => {
  let handler: SQSEventHandler;
  let mockContext: Context;
  let mockExtractEventsFromSQSRecords: jest.Mock;

  beforeEach(() => {
    handler = new SQSEventHandler();
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      getRemainingTimeInMillis: () => 30000,
    } as Context;

    // Get the mocked function
    mockExtractEventsFromSQSRecords = require('../../shared/events/event-serialization').extractEventsFromSQSRecords;

    jest.clearAllMocks();
  });

  // Helper function to create properly formatted SQS record
  const createSQSRecord = (messageId: string, eventData: any, receiveCount: string = '1') => ({
    messageId,
    receiptHandle: `receipt-${messageId}`,
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: `sns-${messageId}`,
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-workflow-events',
      Message: JSON.stringify(eventData),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1',
      Signature: 'test-signature',
      SigningCertURL: 'https://sns.us-east-1.amazonaws.com/test.pem'
    }),
    attributes: {
      ApproximateReceiveCount: receiveCount,
      SentTimestamp: '1234567890',
      SenderId: 'sender-1',
      ApproximateFirstReceiveTimestamp: '1234567890'
    },
    messageAttributes: {},
    md5OfBody: `test-md5-${messageId}`,
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:region:account:queue',
    awsRegion: 'us-east-1'
  });

  // Helper function to create valid event data
  const createValidEventData = (overrides: any = {}) => ({
    eventType: 'book_status_changed',
    eventId: '12345678-1234-4123-8123-123456789012', // Valid UUID v4
    timestamp: new Date().toISOString(),
    source: 'workflow-service',
    version: '1.0',
    data: {
      bookId: 'book-123',
      title: 'Test Book',
      author: 'Test Author',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED_FOR_EDITING',
      changedBy: 'user-456',
      ...overrides
    }
  });

  describe('Retry Logic', () => {
    it('should retry transient errors within max attempts', async () => {
      const eventData = createValidEventData({
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING'
      });

      const sqsRecord = createSQSRecord('msg-1', eventData, '2');
      const event: SQSEvent = {
        Records: [sqsRecord]
      };

      // Mock successful event extraction
      mockExtractEventsFromSQSRecords.mockReturnValue({
        validEvents: [{
          event: eventData,
          record: {
            messageId: 'msg-1',
            attributes: { ApproximateReceiveCount: '2' }
          }
        }],
        invalidRecords: []
      });

      // Mock a transient error (network timeout)
      const mockMapper = require('../services/book-event-notification-mapper').BookEventNotificationMapper;
      mockMapper.prototype.mapEventToNotification = jest.fn().mockImplementation(() => {
        throw new Error('Network timeout - please retry');
      });

      const result = await handler.handleSQSEvent(event, mockContext);

      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(1);
      expect(result.batchItemFailures?.[0]?.itemIdentifier).toBe('msg-1');
      expect(logger.info).toHaveBeenCalledWith(
        '✅ WILL RETRY',
        expect.objectContaining({
          receiveCount: 2,
          attemptsRemaining: 1,
          reason: 'Transient error - will retry'
        })
      );
    });

    it('should not retry validation errors', async () => {
      const eventData = createValidEventData({
        bookId: '', // Invalid - empty book ID
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING'
      });

      const sqsRecord = createSQSRecord('msg-1', eventData, '1');
      const event: SQSEvent = {
        Records: [sqsRecord]
      };

      // Mock successful event extraction but validation will fail in processing
      mockExtractEventsFromSQSRecords.mockReturnValue({
        validEvents: [{
          event: eventData,
          record: {
            messageId: 'msg-1',
            attributes: { ApproximateReceiveCount: '1' }
          }
        }],
        invalidRecords: []
      });

      const result = await handler.handleSQSEvent(event, mockContext);

      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(1);
      expect(logger.info).toHaveBeenCalledWith(
        '❌ NO RETRY - VALIDATION ERROR',
        expect.objectContaining({
          reason: 'Validation errors are permanent failures'
        })
      );
    });

    it('should not retry after max attempts exceeded', async () => {
      const eventData = createValidEventData({
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING'
      });

      const sqsRecord = createSQSRecord('msg-1', eventData, '3');
      const event: SQSEvent = {
        Records: [sqsRecord]
      };

      // Mock successful event extraction
      mockExtractEventsFromSQSRecords.mockReturnValue({
        validEvents: [{
          event: eventData,
          record: {
            messageId: 'msg-1',
            attributes: { ApproximateReceiveCount: '3' }
          }
        }],
        invalidRecords: []
      });

      // Mock a transient error
      const mockMapper = require('../services/book-event-notification-mapper').BookEventNotificationMapper;
      mockMapper.prototype.mapEventToNotification = jest.fn().mockImplementation(() => {
        throw new Error('Temporary service unavailable');
      });

      const result = await handler.handleSQSEvent(event, mockContext);

      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(0); // Should not retry, goes to DLQ
      expect(logger.info).toHaveBeenCalledWith(
        '❌ NO RETRY - MAX ATTEMPTS EXCEEDED',
        expect.objectContaining({
          receiveCount: 3,
          maxRetries: 3,
          reason: 'Maximum retry attempts exceeded'
        })
      );
    });

    it('should not retry permanent SES errors', async () => {
      const eventData = createValidEventData({
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING'
      });

      const sqsRecord = createSQSRecord('msg-1', eventData, '1');
      const event: SQSEvent = {
        Records: [sqsRecord]
      };

      // Mock successful event extraction
      mockExtractEventsFromSQSRecords.mockReturnValue({
        validEvents: [{
          event: eventData,
          record: {
            messageId: 'msg-1',
            attributes: { ApproximateReceiveCount: '1' }
          }
        }],
        invalidRecords: []
      });

      // Mock SES service to throw permanent error
      const mockSesService = require('../services/ses-service').sesService;
      mockSesService.sendEmail = jest.fn().mockResolvedValue({
        success: false,
        error: 'Invalid email address'
      });

      const mockMapper = require('../services/book-event-notification-mapper').BookEventNotificationMapper;
      mockMapper.prototype.mapEventToNotification = jest.fn().mockReturnValue({
        type: 'book_approved',
        recipientEmail: 'invalid-email',
        variables: {}
      });
      mockMapper.prototype.generateEmailContent = jest.fn().mockReturnValue({
        subject: 'Test Subject',
        htmlBody: '<p>Test</p>',
        textBody: 'Test'
      });

      const result = await handler.handleSQSEvent(event, mockContext);

      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(0); // Should not retry permanent SES errors
      expect(logger.info).toHaveBeenCalledWith(
        '❌ NO RETRY - PERMANENT SES ERROR',
        expect.objectContaining({
          reason: 'SES error is permanent'
        })
      );
    });
  });

  describe('Partial Batch Failure Reporting', () => {
    it('should handle mixed success and failure in batch', async () => {
      const successEventData = createValidEventData({
        bookId: 'book-success',
        title: 'Success Book',
        author: 'Success Author',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING'
      });

      const retryEventData = createValidEventData({
        bookId: 'book-retry',
        title: 'Retry Book',
        author: 'Retry Author',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING'
      });

      const dlqEventData = createValidEventData({
        bookId: '', // Invalid - will cause validation error
        title: 'DLQ Book',
        author: 'DLQ Author',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING'
      });

      const event: SQSEvent = {
        Records: [
          createSQSRecord('msg-success', successEventData, '1'),
          createSQSRecord('msg-retry', retryEventData, '1'),
          createSQSRecord('msg-dlq', dlqEventData, '1')
        ]
      };

      // Mock services
      const mockMapper = require('../services/book-event-notification-mapper').BookEventNotificationMapper;
      mockMapper.prototype.mapEventToNotification = jest.fn()
        .mockReturnValueOnce({
          type: 'book_approved',
          recipientEmail: 'success@example.com',
          variables: {}
        })
        .mockImplementationOnce(() => {
          throw new Error('Temporary network error'); // Retryable
        });
      
      mockMapper.prototype.generateEmailContent = jest.fn().mockReturnValue({
        subject: 'Test Subject',
        htmlBody: '<p>Test</p>',
        textBody: 'Test'
      });

      const mockSesService = require('../services/ses-service').sesService;
      mockSesService.sendEmail = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'ses-message-id'
      });

      const result = await handler.handleSQSEvent(event, mockContext);

      expect(result.totalRecords).toBe(3);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.batchItemFailures).toHaveLength(2);
      
      // Check that only retryable message is in batch failures
      const failureIds = result.batchItemFailures?.map(f => f.itemIdentifier) || [];
      expect(failureIds).toContain('msg-retry'); // Retryable error
      expect(failureIds).toContain('msg-dlq'); // Validation error (still reported for DLQ)
    });
  });

  describe('DLQ Handling', () => {
    it('should log appropriate information for DLQ-bound messages', async () => {
      const event: SQSEvent = {
        Records: [
          {
            messageId: 'msg-dlq',
            receiptHandle: 'receipt-dlq',
            body: 'invalid-json', // Invalid JSON will cause parsing error
            attributes: {
              ApproximateReceiveCount: '3', // Max attempts reached
              SentTimestamp: '1234567890',
              SenderId: 'sender-1',
              ApproximateFirstReceiveTimestamp: '1234567890'
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:region:account:queue',
            awsRegion: 'us-east-1'
          }
        ]
      };

      const result = await handler.handleSQSEvent(event, mockContext);

      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(1);
      expect(logger.error).toHaveBeenCalledWith(
        '❌ INVALID SQS RECORD',
        expect.any(Error),
        expect.objectContaining({
          messageId: 'msg-dlq',
          receiveCount: 3,
          willRetry: false
        })
      );
    });
  });
});