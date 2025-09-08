/**
 * Unit tests for Book Event Publisher
 */

import { 
  SNSBookEventPublisher, 
  MockBookEventPublisher, 
  createSNSEventPublisher,
  SNSEventPublisherConfig 
} from '../book-event-publisher';
import { BookStatusChangeEventData } from '../../../shared/events/book-workflow-events';
import { BookStatusEnum } from '../../../shared/events/event-types';

// Mock AWS SDK v3
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' })
  })),
  PublishCommand: jest.fn().mockImplementation((params) => ({ input: params }))
}));
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
const mockSNSClient = SNSClient as jest.MockedClass<typeof SNSClient>;

// Mock AWS SDK v3 CloudWatch client
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutMetricDataCommand: jest.fn().mockImplementation((params) => params)
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

describe('SNSBookEventPublisher', () => {
  let mockSend: jest.Mock;
  let publisher: SNSBookEventPublisher;
  let config: SNSEventPublisherConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock SNS client send method
    mockSend = jest.fn().mockResolvedValue({ MessageId: 'test-message-id' });
    
    mockSNSClient.mockImplementation(() => ({
      send: mockSend
    }) as any);

    config = {
      topicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      region: 'us-east-1'
    };

    publisher = new SNSBookEventPublisher(config);
  });

  const eventData: BookStatusChangeEventData = {
    bookId: 'book-123',
    title: 'Test Book',
    author: 'author-456',
    previousStatus: BookStatusEnum.DRAFT,
    newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
    changedBy: 'user-789',
    changeReason: 'Ready for review'
  };

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(mockSNSClient).toHaveBeenCalled();
    });
  });

  describe('publishStatusChange', () => {
    it('should successfully publish event to SNS', async () => {
      await publisher.publishStatusChange(eventData);

      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const publishCommand = mockSend.mock.calls[0][0];
      expect(publishCommand.input.TopicArn).toBe(config.topicArn);
      expect(publishCommand.input.Message).toContain('"eventType":"book_status_changed"');
    });

    it('should create event with correct structure', async () => {
      await publisher.publishStatusChange(eventData);

      const publishCommand = mockSend.mock.calls[0][0];
      const publishedEvent = JSON.parse(publishCommand.input.Message);
      
      expect(publishedEvent.data).toEqual(eventData);
      expect(publishedEvent.eventId).toBe('test-uuid-1234');
      expect(publishedEvent.timestamp).toBeDefined();
    });

    it('should handle SNS publish failure with retries', async () => {
      const error = new Error('SNS publish failed');
      mockSend.mockRejectedValue(error);

      await expect(publisher.publishStatusChange(eventData)).rejects.toThrow();
      
      // Should retry 3 times
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });
});

describe('MockBookEventPublisher', () => {
  let mockPublisher: MockBookEventPublisher;

  beforeEach(() => {
    mockPublisher = new MockBookEventPublisher();
  });

  const eventData: BookStatusChangeEventData = {
    bookId: 'book-123',
    title: 'Test Book',
    author: 'author-456',
    previousStatus: BookStatusEnum.DRAFT,
    newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
    changedBy: 'user-789',
    changeReason: 'Ready for review'
  };

  it('should store published events', async () => {
    await mockPublisher.publishStatusChange(eventData);

    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0]).toEqual(eventData);
  });

  it('should clear published events', async () => {
    await mockPublisher.publishStatusChange(eventData);
    mockPublisher.clearPublishedEvents();

    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(0);
  });
});

describe('createSNSEventPublisher', () => {
  it('should create publisher with default enhanced configuration', () => {
    const publisher = createSNSEventPublisher({
      topicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic'
    });

    expect(publisher).toBeInstanceOf(SNSBookEventPublisher);
    expect(mockSNSClient).toHaveBeenCalled();
  });

  it('should allow custom timeout override', () => {
    const publisher = createSNSEventPublisher({
      topicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      timeoutMs: 25000
    });

    expect(publisher).toBeInstanceOf(SNSBookEventPublisher);
    expect(mockSNSClient).toHaveBeenCalled();
  });
});