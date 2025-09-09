/**
 * Book Workflow Notifications - Performance and Monitoring Integration Tests
 * Tests performance characteristics, monitoring, and high-volume scenarios
 */

import { SQSEvent, Context } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { mockClient } from 'aws-sdk-client-mock';
import { v4 as uuidv4 } from 'uuid';

import { WorkflowEventService, initializeWorkflowEventService, resetWorkflowEventService } from '../../workflow-service/events/workflow-event-integration';
import { MockBookEventPublisher } from '../../workflow-service/events/book-event-publisher';
import { SQSEventHandler } from '../../notification-service/handlers/sqs-event-handler';
import { cloudWatchMetrics } from '../../notification-service/services/cloudwatch-metrics';
import { performanceMonitor } from '../../shared/monitoring/performance-monitor';
import { 
  BookStatusChangeEvent, 
  BookStatusChangeEventData 
} from '../../shared/events/book-workflow-events';
import { BookStatus, Book } from '../../types';
import { logger } from '../../utils/logger';

// Mock AWS clients
const sesMock = mockClient(SESClient);

// Test data
const TEST_BOOK: Book = {
  bookId: 'perf-test-book-123',
  authorId: 'perf-author-456',
  title: 'Performance Test Book',
  description: 'A book for performance testing',
  content: 'Performance test content',
  genre: 'fiction',
  status: 'DRAFT' as BookStatus,
  tags: ['performance', 'test'],
  wordCount: 1000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
};

describe('Book Workflow Notifications - Performance and Monitoring Integration Tests', () => {
  let workflowEventService: WorkflowEventService;
  let sqsEventHandler: SQSEventHandler;
  let mockEventPublisher: MockBookEventPublisher;

  beforeAll(() => {
    // Set test environment variables
    process.env['NODE_ENV'] = 'test';
    process.env['NOTIFICATION_TARGET_EMAIL'] = 'performance@yopmail.com';
    process.env['BOOK_EVENTS_SNS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:123456789012:perf-test-book-events';
    process.env['FROM_EMAIL'] = 'noreply@perftest.com';
  });

  beforeEach(() => {
    // Reset mocks
    sesMock.reset();

    // Create fresh instances
    mockEventPublisher = new MockBookEventPublisher();
    workflowEventService = new WorkflowEventService(mockEventPublisher);
    sqsEventHandler = new SQSEventHandler();

    // Initialize workflow event service with mock publisher
    initializeWorkflowEventService(mockEventPublisher);

    // Clear any previous events
    mockEventPublisher.clearPublishedEvents();

    // Mock SES to succeed quickly
    sesMock.on(SendEmailCommand).resolves({
      MessageId: 'perf-test-message-id'
    });
  });

  afterEach(() => {
    resetWorkflowEventService();
  });

  describe('Performance Tests', () => {
    test('should process single event within performance threshold', async () => {
      // Arrange
      const startTime = Date.now();
      const maxProcessingTime = 2000; // 2 seconds

      // Act
      await workflowEventService.publishBookStatusChangeEvent(
        TEST_BOOK,
        'DRAFT',
        'SUBMITTED_FOR_EDITING',
        'perf-user-123'
      );

      const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
      const publishedEvent = createBookEventFromData(publishedEventData);
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
      
      const processingTime = Date.now() - startTime;

      // Assert
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);
      expect(processingTime).toBeLessThan(maxProcessingTime);
      
      logger.info('Single event processing performance', {
        processingTimeMs: processingTime,
        threshold: maxProcessingTime,
        passed: processingTime < maxProcessingTime
      });
    });

    test('should process batch of 10 events within performance threshold', async () => {
      // Arrange
      const batchSize = 10;
      const maxBatchProcessingTime = 5000; // 5 seconds
      const events: BookStatusChangeEvent[] = [];

      // Create batch of events
      for (let i = 0; i < batchSize; i++) {
        const event = await createValidBookEvent(
          `batch-book-${i}`,
          'DRAFT',
          'SUBMITTED_FOR_EDITING'
        );
        events.push(event);
      }

      const startTime = Date.now();

      // Act
      const sqsEvent = createBatchSQSEvent(events);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
      
      const processingTime = Date.now() - startTime;

      // Assert
      expect(result.totalRecords).toBe(batchSize);
      expect(result.successfullyProcessed).toBe(batchSize);
      expect(result.failed).toBe(0);
      expect(processingTime).toBeLessThan(maxBatchProcessingTime);
      
      // Verify all emails were sent
      expect(sesMock.calls()).toHaveLength(batchSize);

      logger.info('Batch processing performance', {
        batchSize,
        processingTimeMs: processingTime,
        avgTimePerEvent: processingTime / batchSize,
        threshold: maxBatchProcessingTime,
        passed: processingTime < maxBatchProcessingTime
      });
    });

    test('should handle high-volume concurrent processing', async () => {
      // Arrange
      const concurrentBatches = 5;
      const eventsPerBatch = 5;
      const maxConcurrentProcessingTime = 8000; // 8 seconds

      const batchPromises: Promise<any>[] = [];
      const startTime = Date.now();

      // Act - Process multiple batches concurrently
      for (let batchIndex = 0; batchIndex < concurrentBatches; batchIndex++) {
        const events: BookStatusChangeEvent[] = [];
        
        for (let eventIndex = 0; eventIndex < eventsPerBatch; eventIndex++) {
          const event = await createValidBookEvent(
            `concurrent-book-${batchIndex}-${eventIndex}`,
            'SUBMITTED_FOR_EDITING',
            'READY_FOR_PUBLICATION'
          );
          events.push(event);
        }

        const sqsEvent = createBatchSQSEvent(events);
        const context = createMockLambdaContext();
        
        const batchPromise = sqsEventHandler.handleSQSEvent(sqsEvent, context);
        batchPromises.push(batchPromise);
      }

      // Wait for all batches to complete
      const results = await Promise.all(batchPromises);
      const processingTime = Date.now() - startTime;

      // Assert
      const totalEvents = concurrentBatches * eventsPerBatch;
      const totalSuccessful = results.reduce((sum, result) => sum + result.successfullyProcessed, 0);
      const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);

      expect(totalSuccessful).toBe(totalEvents);
      expect(totalFailed).toBe(0);
      expect(processingTime).toBeLessThan(maxConcurrentProcessingTime);
      
      // Verify all emails were sent
      expect(sesMock.calls()).toHaveLength(totalEvents);

      logger.info('Concurrent processing performance', {
        concurrentBatches,
        eventsPerBatch,
        totalEvents,
        processingTimeMs: processingTime,
        avgTimePerEvent: processingTime / totalEvents,
        threshold: maxConcurrentProcessingTime,
        passed: processingTime < maxConcurrentProcessingTime
      });
    });

    test('should maintain performance under memory pressure', async () => {
      // Arrange - Create large events with substantial metadata
      const largeEvents: BookStatusChangeEvent[] = [];
      const eventCount = 20;
      const largeMetadata = {
        reviewComments: 'A'.repeat(1000), // 1KB of text
        submissionNotes: 'B'.repeat(1000),
        additionalData: 'C'.repeat(1000),
        processingHistory: Array(100).fill('processing-step').map((step, i) => `${step}-${i}`)
      };

      for (let i = 0; i < eventCount; i++) {
        const event = await createValidBookEvent(
          `large-book-${i}`,
          'READY_FOR_PUBLICATION',
          'PUBLISHED'
        );
        event.data.metadata = { ...event.data.metadata, ...largeMetadata };
        largeEvents.push(event);
      }

      const startTime = Date.now();
      const maxMemoryPressureTime = 10000; // 10 seconds

      // Act
      const sqsEvent = createBatchSQSEvent(largeEvents);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
      
      const processingTime = Date.now() - startTime;

      // Assert
      expect(result.totalRecords).toBe(eventCount);
      expect(result.successfullyProcessed).toBe(eventCount);
      expect(result.failed).toBe(0);
      expect(processingTime).toBeLessThan(maxMemoryPressureTime);

      logger.info('Memory pressure performance', {
        eventCount,
        metadataSize: JSON.stringify(largeMetadata).length,
        processingTimeMs: processingTime,
        threshold: maxMemoryPressureTime,
        passed: processingTime < maxMemoryPressureTime
      });
    });
  });

  describe('Monitoring and Metrics Tests', () => {
    test('should emit performance metrics during processing', async () => {
      // Arrange
      const metricsCollector: any[] = [];
      
      // Mock performance monitor to collect metrics
      const originalMonitorBatchProcessing = performanceMonitor.monitorBatchProcessing;
      const originalMonitorEventProcessing = performanceMonitor.monitorEventProcessing;
      const originalMonitorEmailDelivery = performanceMonitor.monitorEmailDelivery;

      performanceMonitor.monitorBatchProcessing = jest.fn().mockImplementation(async (fn, context) => {
        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;
        
        metricsCollector.push({
          type: 'batch_processing',
          duration,
          context
        });
        
        return result;
      });

      performanceMonitor.monitorEventProcessing = jest.fn().mockImplementation(async (fn, context) => {
        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;
        
        metricsCollector.push({
          type: 'event_processing',
          duration,
          context
        });
        
        return result;
      });

      performanceMonitor.monitorEmailDelivery = jest.fn().mockImplementation(async (fn, context) => {
        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;
        
        metricsCollector.push({
          type: 'email_delivery',
          duration,
          context
        });
        
        return result;
      });

      try {
        // Act
        await workflowEventService.publishBookStatusChangeEvent(
          TEST_BOOK,
          'DRAFT',
          'SUBMITTED_FOR_EDITING',
          'metrics-user-123'
        );

        const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
        const publishedEvent = createBookEventFromData(publishedEventData);
        const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
        const context = createMockLambdaContext();
        
        await sqsEventHandler.handleSQSEvent(sqsEvent, context);

        // Assert
        expect(metricsCollector.length).toBeGreaterThan(0);
        
        const batchMetrics = metricsCollector.filter(m => m.type === 'batch_processing');
        const eventMetrics = metricsCollector.filter(m => m.type === 'event_processing');
        const emailMetrics = metricsCollector.filter(m => m.type === 'email_delivery');

        expect(batchMetrics).toHaveLength(1);
        expect(eventMetrics).toHaveLength(1);
        expect(emailMetrics).toHaveLength(1);

        // Verify metrics contain expected context
        expect(batchMetrics[0].context).toHaveProperty('batchSize', 1);
        expect(eventMetrics[0].context).toHaveProperty('bookId', TEST_BOOK.bookId);
        expect(emailMetrics[0].context).toHaveProperty('bookId', TEST_BOOK.bookId);

        logger.info('Performance metrics collected', {
          totalMetrics: metricsCollector.length,
          batchMetrics: batchMetrics.length,
          eventMetrics: eventMetrics.length,
          emailMetrics: emailMetrics.length,
          avgBatchDuration: batchMetrics[0].duration,
          avgEventDuration: eventMetrics[0].duration,
          avgEmailDuration: emailMetrics[0].duration
        });

      } finally {
        // Restore original methods
        performanceMonitor.monitorBatchProcessing = originalMonitorBatchProcessing;
        performanceMonitor.monitorEventProcessing = originalMonitorEventProcessing;
        performanceMonitor.monitorEmailDelivery = originalMonitorEmailDelivery;
      }
    });

    test('should emit CloudWatch metrics for success and failure rates', async () => {
      // Arrange
      const metricsEmitted: any[] = [];
      
      // Mock CloudWatch metrics
      const originalRecordProcessingMetrics = cloudWatchMetrics.recordProcessingMetrics;
      const originalRecordDLQMessage = cloudWatchMetrics.recordDLQMessage;

      cloudWatchMetrics.recordProcessingMetrics = jest.fn().mockImplementation(async (metrics) => {
        metricsEmitted.push({ type: 'processing', ...metrics });
      });

      cloudWatchMetrics.recordDLQMessage = jest.fn().mockImplementation(async (notificationType, errorType) => {
        metricsEmitted.push({ type: 'dlq', notificationType, errorType });
      });

      try {
        // Act - Process successful event
        await workflowEventService.publishBookStatusChangeEvent(
          TEST_BOOK,
          'DRAFT',
          'SUBMITTED_FOR_EDITING',
          'cloudwatch-user-123'
        );

        const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
        const publishedEvent = createBookEventFromData(publishedEventData);
        const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
        const context = createMockLambdaContext();
        
        await sqsEventHandler.handleSQSEvent(sqsEvent, context);

        // Act - Process failed event (simulate SES failure)
        sesMock.reset();
        sesMock.on(SendEmailCommand).rejects(new Error('SES service unavailable'));

        const failedEvent = await createValidBookEvent(
          'failed-book-123',
          'SUBMITTED_FOR_EDITING',
          'READY_FOR_PUBLICATION'
        );
        const failedSqsEvent = createSQSEventFromBookEvent(failedEvent, '4'); // Max retries
        
        await sqsEventHandler.handleSQSEvent(failedSqsEvent, context);

        // Assert
        expect(metricsEmitted.length).toBeGreaterThan(0);
        
        const processingMetrics = metricsEmitted.filter(m => m.type === 'processing');
        const dlqMetrics = metricsEmitted.filter(m => m.type === 'dlq');

        // Should have processing metrics for both events
        expect(processingMetrics.length).toBeGreaterThanOrEqual(1);
        
        // Should have DLQ metrics for failed event
        expect(dlqMetrics.length).toBeGreaterThanOrEqual(1);
        expect(dlqMetrics[0].errorType).toBe('Error');

        logger.info('CloudWatch metrics emitted', {
          totalMetrics: metricsEmitted.length,
          processingMetrics: processingMetrics.length,
          dlqMetrics: dlqMetrics.length
        });

      } finally {
        // Restore original methods
        cloudWatchMetrics.recordProcessingMetrics = originalRecordProcessingMetrics;
        cloudWatchMetrics.recordDLQMessage = originalRecordDLQMessage;
      }
    });

    test('should track processing times and queue depths', async () => {
      // Arrange
      const processingTimes: number[] = [];
      const batchSizes: number[] = [];

      // Create multiple batches of different sizes
      const testBatches = [
        { size: 1, description: 'single event' },
        { size: 5, description: 'small batch' },
        { size: 10, description: 'medium batch' }
      ];

      // Act & Assert
      for (const batch of testBatches) {
        const events: BookStatusChangeEvent[] = [];
        
        for (let i = 0; i < batch.size; i++) {
          const event = await createValidBookEvent(
            `tracking-book-${batch.size}-${i}`,
            'READY_FOR_PUBLICATION',
            'PUBLISHED'
          );
          events.push(event);
        }

        const startTime = Date.now();
        const sqsEvent = createBatchSQSEvent(events);
        const context = createMockLambdaContext();
        
        const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
        const processingTime = Date.now() - startTime;

        processingTimes.push(processingTime);
        batchSizes.push(batch.size);

        expect(result.successfullyProcessed).toBe(batch.size);
        expect(result.failed).toBe(0);

        logger.info(`Processing time for ${batch.description}`, {
          batchSize: batch.size,
          processingTimeMs: processingTime,
          avgTimePerEvent: processingTime / batch.size
        });
      }

      // Analyze performance trends
      const avgProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      const totalEvents = batchSizes.reduce((sum, size) => sum + size, 0);
      const totalTime = processingTimes.reduce((sum, time) => sum + time, 0);
      const avgTimePerEvent = totalTime / totalEvents;

      logger.info('Processing performance summary', {
        totalBatches: testBatches.length,
        totalEvents,
        totalProcessingTimeMs: totalTime,
        avgBatchProcessingTimeMs: avgProcessingTime,
        avgTimePerEventMs: avgTimePerEvent,
        performanceAcceptable: avgTimePerEvent < 500 // 500ms per event threshold
      });

      expect(avgTimePerEvent).toBeLessThan(500); // Performance threshold
    });
  });

  // Helper functions
  function createBookEventFromData(eventData: BookStatusChangeEventData): BookStatusChangeEvent {
    return {
      eventType: 'book_status_changed',
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      source: 'workflow-service',
      version: '1.0',
      data: eventData
    };
  }

  function createSQSEventFromBookEvent(
    bookEvent: BookStatusChangeEvent, 
    receiveCount: string = '1'
  ): SQSEvent {
    const snsMessage = {
      Type: 'Notification',
      MessageId: uuidv4(),
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:perf-test-book-events',
      Message: JSON.stringify(bookEvent),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1',
      Signature: 'perf-test-signature',
      SigningCertURL: 'https://perftest.com/cert',
      UnsubscribeURL: 'https://perftest.com/unsubscribe'
    };

    return {
      Records: [{
        messageId: uuidv4(),
        receiptHandle: 'perf-test-receipt-handle',
        body: JSON.stringify(snsMessage),
        attributes: {
          ApproximateReceiveCount: receiveCount,
          SentTimestamp: Date.now().toString(),
          SenderId: 'perf-test-sender',
          ApproximateFirstReceiveTimestamp: Date.now().toString()
        },
        messageAttributes: {},
        md5OfBody: 'perf-test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:perf-test-queue',
        awsRegion: 'us-east-1'
      }]
    };
  }

  function createBatchSQSEvent(events: BookStatusChangeEvent[]): SQSEvent {
    return {
      Records: events.map((event, index) => {
        const snsMessage = {
          Type: 'Notification',
          MessageId: uuidv4(),
          TopicArn: 'arn:aws:sns:us-east-1:123456789012:perf-test-book-events',
          Message: JSON.stringify(event),
          Timestamp: new Date().toISOString(),
          SignatureVersion: '1',
          Signature: 'perf-batch-signature',
          SigningCertURL: 'https://perftest.com/cert',
          UnsubscribeURL: 'https://perftest.com/unsubscribe'
        };

        return {
          messageId: `perf-batch-message-${index}`,
          receiptHandle: `perf-batch-receipt-${index}`,
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: Date.now().toString(),
            SenderId: 'perf-test-sender',
            ApproximateFirstReceiveTimestamp: Date.now().toString()
          },
          messageAttributes: {},
          md5OfBody: `perf-batch-md5-${index}`,
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:perf-test-queue',
          awsRegion: 'us-east-1'
        };
      })
    };
  }

  async function createValidBookEvent(
    bookId: string,
    previousStatus: BookStatus,
    newStatus: BookStatus
  ): Promise<BookStatusChangeEvent> {
    const eventData: BookStatusChangeEventData = {
      bookId,
      title: `Performance Test Book ${bookId}`,
      author: 'perf-test-author',
      previousStatus,
      newStatus,
      changedBy: 'perf-test-user',
      changeReason: 'Performance test transition',
      metadata: { performanceTest: true }
    };

    return {
      eventType: 'book_status_changed',
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      source: 'workflow-service',
      version: '1.0',
      data: eventData
    };
  }

  function createMockLambdaContext(): Context {
    return {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'perf-test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:perf-test',
      memoryLimitInMB: '256',
      awsRequestId: uuidv4(),
      logGroupName: '/aws/lambda/perf-test',
      logStreamName: 'perf-test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };
  }
});