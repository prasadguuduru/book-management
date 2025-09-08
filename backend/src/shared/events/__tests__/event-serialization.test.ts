/**
 * Comprehensive Unit Tests for Event Serialization
 * Tests serialization, deserialization, and error scenarios
 */

import {
  serializeBookEvent,
  deserializeBookEvent,
  extractEventFromSNSMessage,
  extractEventFromSQSRecord,
  extractEventsFromSQSRecords,
  createBookStatusChangeEvent,
  safeJsonParse,
  safeJsonStringify
} from '../event-serialization';
import { BookStatusChangeEvent, SNSBookEventMessage, SQSBookEventRecord } from '../book-workflow-events';
import { BookStatusEnum } from '../event-types';
import { logger } from '../../../utils/logger';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Event Serialization', () => {
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
      changeReason: 'Ready for review',
      metadata: { reviewComments: 'Looks good' }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('serializeBookEvent', () => {
    it('should serialize valid event to JSON string', () => {
      const result = serializeBookEvent(validEvent);
      
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(validEvent);
    });

    it('should throw error for invalid event', () => {
      const invalidEvent = {
        ...validEvent,
        eventType: 'invalid_type'
      } as any;

      expect(() => serializeBookEvent(invalidEvent)).toThrow('Invalid event');
    });

    it('should log error and throw for invalid event', () => {
      const invalidEvent = {
        ...validEvent,
        eventId: 'invalid-uuid'
      } as any;

      expect(() => serializeBookEvent(invalidEvent)).toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to serialize book event',
        expect.any(Error),
        expect.objectContaining({
          eventId: 'invalid-uuid',
          eventType: 'book_status_changed'
        })
      );
    });

    it('should handle serialization of event without optional fields', () => {
      const minimalEvent: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: null,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'user-456'
        }
      };

      const result = serializeBookEvent(minimalEvent);
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(minimalEvent);
    });
  });

  describe('deserializeBookEvent', () => {
    it('should deserialize valid JSON string to event', () => {
      const eventJson = JSON.stringify(validEvent);
      const result = deserializeBookEvent(eventJson);
      
      expect(result).toEqual(validEvent);
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => deserializeBookEvent(invalidJson)).toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to deserialize book event',
        expect.any(Error),
        expect.objectContaining({
          eventJson: invalidJson
        })
      );
    });

    it('should throw error for valid JSON with invalid event structure', () => {
      const invalidEventJson = JSON.stringify({
        eventType: 'invalid_type',
        data: {}
      });
      
      expect(() => deserializeBookEvent(invalidEventJson)).toThrow('Invalid event structure');
    });

    it('should log truncated JSON for long strings', () => {
      const longInvalidJson = 'invalid'.repeat(100);
      
      expect(() => deserializeBookEvent(longInvalidJson)).toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to deserialize book event',
        expect.any(Error),
        expect.objectContaining({
          eventJson: longInvalidJson.substring(0, 200)
        })
      );
    });
  });

  describe('extractEventFromSNSMessage', () => {
    const validSNSMessage: SNSBookEventMessage = {
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

    it('should extract valid event from SNS message', () => {
      const result = extractEventFromSNSMessage(validSNSMessage);
      expect(result).toEqual(validEvent);
    });

    it('should throw error for invalid JSON in SNS message', () => {
      const invalidSNSMessage = {
        ...validSNSMessage,
        Message: '{ invalid json }'
      };

      expect(() => extractEventFromSNSMessage(invalidSNSMessage)).toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to extract event from SNS message',
        expect.any(Error),
        expect.objectContaining({
          messageId: 'sns-message-123',
          topicArn: 'arn:aws:sns:us-east-1:123456789012:book-events'
        })
      );
    });

    it('should throw error for invalid event structure in SNS message', () => {
      const invalidSNSMessage = {
        ...validSNSMessage,
        Message: JSON.stringify({ eventType: 'invalid' })
      };

      expect(() => extractEventFromSNSMessage(invalidSNSMessage)).toThrow();
    });
  });

  describe('extractEventFromSQSRecord', () => {
    const validSNSMessage: SNSBookEventMessage = {
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

    const validSQSRecord: SQSBookEventRecord = {
      messageId: 'sqs-message-123',
      receiptHandle: 'receipt-handle-123',
      body: JSON.stringify(validSNSMessage),
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
    };

    it('should extract valid event from SQS record', () => {
      const result = extractEventFromSQSRecord(validSQSRecord);
      expect(result).toEqual(validEvent);
    });

    it('should throw error for invalid JSON in SQS record body', () => {
      const invalidSQSRecord = {
        ...validSQSRecord,
        body: '{ invalid json }'
      };

      expect(() => extractEventFromSQSRecord(invalidSQSRecord)).toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to extract event from SQS record',
        expect.any(Error),
        expect.objectContaining({
          messageId: 'sqs-message-123',
          eventSource: 'aws:sqs'
        })
      );
    });

    it('should throw error for invalid SNS message in SQS record', () => {
      const invalidSQSRecord = {
        ...validSQSRecord,
        body: JSON.stringify({ Type: 'Invalid' })
      };

      expect(() => extractEventFromSQSRecord(invalidSQSRecord)).toThrow();
    });
  });

  describe('extractEventsFromSQSRecords', () => {
    const validSNSMessage: SNSBookEventMessage = {
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

    const validSQSRecord: SQSBookEventRecord = {
      messageId: 'sqs-message-123',
      receiptHandle: 'receipt-handle-123',
      body: JSON.stringify(validSNSMessage),
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
    };

    it('should extract valid events from multiple SQS records', () => {
      const records = [validSQSRecord, validSQSRecord];
      const result = extractEventsFromSQSRecords(records);
      
      expect(result.validEvents).toHaveLength(2);
      expect(result.invalidRecords).toHaveLength(0);
      expect(result.validEvents[0]?.event).toEqual(validEvent);
      expect(result.validEvents[0]?.record).toEqual(validSQSRecord);
    });

    it('should separate valid and invalid records', () => {
      const invalidRecord = {
        ...validSQSRecord,
        messageId: 'invalid-message-123',
        body: '{ invalid json }'
      };
      
      const records = [validSQSRecord, invalidRecord];
      const result = extractEventsFromSQSRecords(records);
      
      expect(result.validEvents).toHaveLength(1);
      expect(result.invalidRecords).toHaveLength(1);
      expect(result.validEvents[0]?.event).toEqual(validEvent);
      expect(result.invalidRecords[0]?.record.messageId).toBe('invalid-message-123');
      expect(result.invalidRecords[0]?.error).toContain('JSON');
    });

    it('should handle empty records array', () => {
      const result = extractEventsFromSQSRecords([]);
      
      expect(result.validEvents).toHaveLength(0);
      expect(result.invalidRecords).toHaveLength(0);
    });

    it('should log warnings for invalid records', () => {
      const invalidRecord = {
        ...validSQSRecord,
        messageId: 'invalid-message-123',
        body: '{ invalid json }'
      };
      
      const records = [invalidRecord];
      extractEventsFromSQSRecords(records);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Skipping invalid SQS record',
        expect.objectContaining({
          messageId: 'invalid-message-123',
          error: expect.stringContaining('JSON')
        })
      );
    });
  });

  describe('createBookStatusChangeEvent', () => {
    it('should create valid event with all fields', () => {
      const eventData = {
        bookId: 'book-123',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: BookStatusEnum.DRAFT,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456',
        changeReason: 'Ready for review',
        metadata: { reviewComments: 'Looks good' }
      };

      const result = createBookStatusChangeEvent(eventData);
      
      expect(result.eventType).toBe('book_status_changed');
      expect(result.source).toBe('workflow-service');
      expect(result.version).toBe('1.0');
      expect(result.data).toEqual(eventData);
      expect(typeof result.eventId).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should create valid event with minimal fields', () => {
      const eventData = {
        bookId: 'book-123',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: null,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456'
      };

      const result = createBookStatusChangeEvent(eventData);
      
      expect(result.data).toEqual(eventData);
      expect(result.data.changeReason).toBeUndefined();
      expect(result.data.metadata).toBeUndefined();
    });

    it('should generate valid UUID for eventId', () => {
      const eventData = {
        bookId: 'book-123',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: null,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456'
      };

      const result = createBookStatusChangeEvent(eventData);
      
      // UUID v4 pattern
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.eventId).toMatch(uuidPattern);
    });

    it('should generate valid ISO 8601 timestamp', () => {
      const eventData = {
        bookId: 'book-123',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: null,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456'
      };

      const result = createBookStatusChangeEvent(eventData);
      
      // Should be valid ISO 8601
      const date = new Date(result.timestamp);
      expect(date.toISOString()).toBe(result.timestamp);
    });

    it('should throw error for invalid event data', () => {
      const invalidEventData = {
        bookId: '',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: null,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456'
      };

      expect(() => createBookStatusChangeEvent(invalidEventData)).toThrow('Failed to create valid event');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const validJson = '{"key": "value"}';
      const result = safeJsonParse(validJson);
      
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid JSON', () => {
      const invalidJson = '{ invalid json }';
      const result = safeJsonParse(invalidJson);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse JSON',
        expect.any(Error),
        expect.objectContaining({
          jsonString: invalidJson
        })
      );
    });

    it('should include context in error message', () => {
      const invalidJson = '{ invalid json }';
      const result = safeJsonParse(invalidJson, 'test context');
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse JSON in test context',
        expect.any(Error),
        expect.objectContaining({
          jsonString: invalidJson
        })
      );
    });

    it('should truncate long JSON strings in error logs', () => {
      const longInvalidJson = 'invalid'.repeat(100);
      const result = safeJsonParse(longInvalidJson);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse JSON',
        expect.any(Error),
        expect.objectContaining({
          jsonString: longInvalidJson.substring(0, 200)
        })
      );
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify valid object', () => {
      const validObject = { key: 'value' };
      const result = safeJsonStringify(validObject);
      
      expect(result).toBe('{"key":"value"}');
    });

    it('should return null for circular references', () => {
      const circularObject: any = { key: 'value' };
      circularObject.circular = circularObject;
      
      const result = safeJsonStringify(circularObject);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to stringify object',
        expect.any(Error),
        expect.objectContaining({
          objectType: 'object'
        })
      );
    });

    it('should include context in error message', () => {
      const circularObject: any = { key: 'value' };
      circularObject.circular = circularObject;
      
      const result = safeJsonStringify(circularObject, 'test context');
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to stringify object in test context',
        expect.any(Error),
        expect.objectContaining({
          objectType: 'object'
        })
      );
    });

    it('should handle different object types', () => {
      const testCases = [
        { input: 'string', expected: '"string"' },
        { input: 123, expected: '123' },
        { input: true, expected: 'true' },
        { input: null, expected: 'null' },
        { input: [], expected: '[]' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = safeJsonStringify(input);
        expect(result).toBe(expected);
      });
    });
  });
});