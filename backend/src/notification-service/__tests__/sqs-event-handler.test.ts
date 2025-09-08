/**
 * Unit Tests for SQS Event Handler
 * Tests SQS message processing, event validation, and error handling
 */

import { SQSEvent, Context } from 'aws-lambda';
import { SQSEventHandler } from '../handlers/sqs-event-handler';
import { BookEventNotificationMapper } from '../services/book-event-notification-mapper';
import { sesService } from '../services/ses-service';
import { BookStatusChangeEvent } from '../../shared/events/book-workflow-events';
import { BookStatusEnum } from '../../shared/events/event-types';

// Mock dependencies
jest.mock('../services/book-event-notification-mapper', () => ({
  BookEventNotificationMapper: jest.fn().mockImplementation(() => ({
    mapEventToNotification: jest.fn(),
    generateEmailContent: jest.fn()
  }))
}));

jest.mock('../services/ses-service', () => ({
  sesService: {
    sendEmail: jest.fn(),
    sendEmailWithCC: jest.fn()
  }
}));

jest.mock('../services/cloudwatch-metrics', () => ({
  cloudWatchMetrics: {
    recordCCDeliveryMetrics: jest.fn(),
    recordCCDeliveryFailure: jest.fn(),
    recordBatchProcessingMetrics: jest.fn(),
    recordDLQMessage: jest.fn()
  }
}));

jest.mock('../../shared/monitoring/performance-monitor', () => ({
  performanceMonitor: {
    monitorBatchProcessing: jest.fn((fn) => fn()),
    monitorEventProcessing: jest.fn((fn) => fn()),
    monitorEmailDelivery: jest.fn((fn) => fn())
  }
}));

jest.mock('../../shared/monitoring/structured-logger', () => ({
  EventProcessingLogger: {
    logEventProcessingStart: jest.fn(),
    logEventValidationFailure: jest.fn(),
    logEventProcessingSuccess: jest.fn(),
    logEventProcessingFailure: jest.fn(),
    logRetryAttempt: jest.fn(),
    logDLQMessage: jest.fn(),
    logBatchProcessingMetrics: jest.fn(),
    logEmailDeliveryAttempt: jest.fn()
  }
}));

jest.mock('../../utils/logger');

describe('SQSEventHandler', () => {
  let handler: SQSEventHandler;
  let mockContext: Context;
  let mockMapEventToNotification: jest.Mock;
  let mockGenerateEmailContent: jest.Mock;
  let mockSendEmail: jest.Mock;
  let mockSendEmailWithCC: jest.Mock;

  beforeEach(() => {
    handler = new SQSEventHandler();
    
    // Get the mock functions from the mocked instances
    mockMapEventToNotification = (handler as any).notificationMapper.mapEventToNotification;
    mockGenerateEmailContent = (handler as any).notificationMapper.generateEmailContent;
    mockSendEmail = require('../services/ses-service').sesService.sendEmail;
    mockSendEmailWithCC = require('../services/ses-service').sesService.sendEmailWithCC;
    
    // Setup mock context
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      getRemainingTimeInMillis: jest.fn().mockReturnValue(30000),
      callbackWaitsForEmptyEventLoop: false,
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: '2023/01/01/[$LATEST]test',
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn()
    };

    // Reset mocks
    jest.clearAllMocks();
    mockMapEventToNotification.mockReset();
    mockGenerateEmailContent.mockReset();
    mockSendEmail.mockReset();
    mockSendEmailWithCC.mockReset();
  });

  describe('handleSQSEvent', () => {
    it('should process valid SQS events successfully', async () => {
      // Arrange
      const validEvent: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.DRAFT,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'user-456',
          changeReason: 'Ready for review'
        }
      };

      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent),
        Timestamp: '2025-01-01T12:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'sqs-message-123',
          receiptHandle: 'receipt-handle-123',
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      // Mock notification mapper
      mockMapEventToNotification.mockReturnValue({
        type: 'book_submitted',
        recipientEmail: 'bookmanagement@yopmail.com',
        variables: {
          userName: 'Test Author',
          bookTitle: 'Test Book',
          bookId: 'book-123'
        }
      });

      mockGenerateEmailContent.mockReturnValue({
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });

      // Mock SES service
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'ses-message-123'
      });

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockMapEventToNotification).toHaveBeenCalledWith(validEvent);
      expect(mockGenerateEmailContent).toHaveBeenCalledWith(
        'book_submitted',
        expect.objectContaining({
          userName: 'Test Author',
          bookTitle: 'Test Book',
          bookId: 'book-123'
        })
      );
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'bookmanagement@yopmail.com',
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });
    });

    it('should handle invalid SQS records gracefully', async () => {
      // Arrange
      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'invalid-message-123',
          receiptHandle: 'receipt-handle-123',
          body: 'invalid-json-body',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.messageId).toBe('invalid-message-123');
      expect(result.errors[0]?.error).toContain('Invalid event format');

      expect(mockMapEventToNotification).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should handle email sending failures', async () => {
      // Arrange
      const validEvent: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.DRAFT,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'user-456'
        }
      };

      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent),
        Timestamp: '2025-01-01T12:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'sqs-message-123',
          receiptHandle: 'receipt-handle-123',
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      // Mock notification mapper
      mockMapEventToNotification.mockReturnValue({
        type: 'book_submitted',
        recipientEmail: 'bookmanagement@yopmail.com',
        variables: {
          userName: 'Test Author',
          bookTitle: 'Test Book',
          bookId: 'book-123'
        }
      });

      mockGenerateEmailContent.mockReturnValue({
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });

      // Mock SES service failure
      mockSendEmail.mockResolvedValue({
        success: false,
        error: 'SES rate limit exceeded'
      });

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.messageId).toBe('sqs-message-123');
      expect(result.errors[0]?.error).toContain('Failed to send email: SES rate limit exceeded');
    });

    it('should skip events that do not require notifications', async () => {
      // Arrange
      const validEvent: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.DRAFT,
          newStatus: BookStatusEnum.DRAFT, // No status change
          changedBy: 'user-456'
        }
      };

      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent),
        Timestamp: '2025-01-01T12:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'sqs-message-123',
          receiptHandle: 'receipt-handle-123',
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      // Mock notification mapper to return null (no notification needed)
      mockMapEventToNotification.mockReturnValue(null);

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1); // Successfully processed (but no email sent)
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockMapEventToNotification).toHaveBeenCalledWith(validEvent);
      expect(mockGenerateEmailContent).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should process multiple SQS records in batch', async () => {
      // Arrange
      const validEvent1: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book 1',
          author: 'Test Author 1',
          previousStatus: BookStatusEnum.DRAFT,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'user-456'
        }
      };

      const validEvent2: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '87654321-4321-4321-8321-210987654321',
        timestamp: '2025-01-01T12:01:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-456',
          title: 'Test Book 2',
          author: 'Test Author 2',
          previousStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          newStatus: BookStatusEnum.READY_FOR_PUBLICATION,
          changedBy: 'user-789'
        }
      };

      const snsMessage1 = {
        Type: 'Notification',
        MessageId: 'sns-message-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent1),
        Timestamp: '2025-01-01T12:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const snsMessage2 = {
        Type: 'Notification',
        MessageId: 'sns-message-456',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent2),
        Timestamp: '2025-01-01T12:01:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const sqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'sqs-message-123',
            receiptHandle: 'receipt-handle-123',
            body: JSON.stringify(snsMessage1),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1640995200000',
              SenderId: 'AIDAIENQZJOLO23YVJ4VO',
              ApproximateFirstReceiveTimestamp: '1640995200000'
            },
            messageAttributes: {},
            md5OfBody: 'test-md5-1',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1'
          },
          {
            messageId: 'sqs-message-456',
            receiptHandle: 'receipt-handle-456',
            body: JSON.stringify(snsMessage2),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1640995260000',
              SenderId: 'AIDAIENQZJOLO23YVJ4VO',
              ApproximateFirstReceiveTimestamp: '1640995260000'
            },
            messageAttributes: {},
            md5OfBody: 'test-md5-2',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1'
          }
        ]
      };

      // Mock notification mapper
      mockMapEventToNotification
        .mockReturnValueOnce({
          type: 'book_submitted',
          recipientEmail: 'bookmanagement@yopmail.com',
          variables: { userName: 'Test Author 1', bookTitle: 'Test Book 1', bookId: 'book-123' }
        })
        .mockReturnValueOnce({
          type: 'book_approved',
          recipientEmail: 'bookmanagement@yopmail.com',
          variables: { userName: 'Test Author 2', bookTitle: 'Test Book 2', bookId: 'book-456' }
        });

      mockGenerateEmailContent
        .mockReturnValueOnce({
          subject: 'Book Submitted: Test Book 1',
          htmlBody: '<html><body>Test HTML 1</body></html>',
          textBody: 'Test Text 1'
        })
        .mockReturnValueOnce({
          subject: 'Book Approved: Test Book 2',
          htmlBody: '<html><body>Test HTML 2</body></html>',
          textBody: 'Test Text 2'
        });

      // Mock SES service
      mockSendEmail
        .mockResolvedValueOnce({ success: true, messageId: 'ses-message-123' })
        .mockResolvedValueOnce({ success: true, messageId: 'ses-message-456' });

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(2);
      expect(result.successfullyProcessed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockMapEventToNotification).toHaveBeenCalledTimes(2);
      expect(mockGenerateEmailContent).toHaveBeenCalledTimes(2);
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });

    it('should send emails with CC when CC emails are present in notification request', async () => {
      // Arrange
      const validEvent: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.DRAFT,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'user-456',
          changeReason: 'Ready for review'
        }
      };

      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent),
        Timestamp: '2025-01-01T12:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'sqs-message-123',
          receiptHandle: 'receipt-handle-123',
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      // Mock notification mapper to return CC emails
      mockMapEventToNotification.mockReturnValue({
        type: 'book_submitted',
        recipientEmail: 'bookmanagement@yopmail.com',
        ccEmails: ['manager1@yopmail.com', 'manager2@yopmail.com'],
        variables: {
          userName: 'Test Author',
          bookTitle: 'Test Book',
          bookId: 'book-123'
        }
      });

      mockGenerateEmailContent.mockReturnValue({
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });

      // Mock SES service with CC support
      mockSendEmailWithCC.mockResolvedValue({
        success: true,
        messageId: 'ses-message-123',
        ccDeliveryStatus: [
          { email: 'manager1@yopmail.com', success: true },
          { email: 'manager2@yopmail.com', success: true }
        ]
      });

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockMapEventToNotification).toHaveBeenCalledWith(validEvent);
      expect(mockGenerateEmailContent).toHaveBeenCalledWith('book_submitted', {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123'
      });

      // Verify CC email sending was used
      expect(mockSendEmailWithCC).toHaveBeenCalledWith({
        to: 'bookmanagement@yopmail.com',
        ccEmails: ['manager1@yopmail.com', 'manager2@yopmail.com'],
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });

      // Verify regular email sending was not used
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should use regular email sending when no CC emails are present', async () => {
      // Arrange
      const validEvent: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.DRAFT,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'user-456',
          changeReason: 'Ready for review'
        }
      };

      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent),
        Timestamp: '2025-01-01T12:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'sqs-message-123',
          receiptHandle: 'receipt-handle-123',
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      // Mock notification mapper without CC emails
      mockMapEventToNotification.mockReturnValue({
        type: 'book_submitted',
        recipientEmail: 'bookmanagement@yopmail.com',
        variables: {
          userName: 'Test Author',
          bookTitle: 'Test Book',
          bookId: 'book-123'
        }
      });

      mockGenerateEmailContent.mockReturnValue({
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });

      // Mock regular SES service
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'ses-message-123'
      });

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);

      // Verify regular email sending was used
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'bookmanagement@yopmail.com',
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });

      // Verify CC email sending was not used
      expect(mockSendEmailWithCC).not.toHaveBeenCalled();
    });

    it('should handle partial CC delivery failures gracefully', async () => {
      // Arrange
      const validEvent: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.DRAFT,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'user-456',
          changeReason: 'Ready for review'
        }
      };

      const snsMessage = {
        Type: 'Notification',
        MessageId: 'sns-message-123',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:book-events',
        Message: JSON.stringify(validEvent),
        Timestamp: '2025-01-01T12:00:00.000Z',
        SignatureVersion: '1',
        Signature: 'test-signature',
        SigningCertURL: 'https://sns.amazonaws.com/cert.pem',
        UnsubscribeURL: 'https://sns.amazonaws.com/unsubscribe'
      };

      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'sqs-message-123',
          receiptHandle: 'receipt-handle-123',
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      // Mock notification mapper with CC emails
      mockMapEventToNotification.mockReturnValue({
        type: 'book_submitted',
        recipientEmail: 'bookmanagement@yopmail.com',
        ccEmails: ['manager1@yopmail.com', 'invalid-email'],
        variables: {
          userName: 'Test Author',
          bookTitle: 'Test Book',
          bookId: 'book-123'
        }
      });

      mockGenerateEmailContent.mockReturnValue({
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });

      // Mock SES service with partial CC failure
      mockSendEmailWithCC.mockResolvedValue({
        success: true,
        messageId: 'ses-message-123',
        ccDeliveryStatus: [
          { email: 'manager1@yopmail.com', success: true },
          { email: 'invalid-email', success: false, error: 'Invalid email address format' }
        ]
      });

      // Act
      const result = await handler.handleSQSEvent(sqsEvent, mockContext);

      // Assert
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);

      // Verify CC email sending was used
      expect(mockSendEmailWithCC).toHaveBeenCalledWith({
        to: 'bookmanagement@yopmail.com',
        ccEmails: ['manager1@yopmail.com', 'invalid-email'],
        subject: 'Book Submitted: Test Book',
        htmlBody: '<html><body>Test HTML</body></html>',
        textBody: 'Test Text'
      });
    });
  });
});