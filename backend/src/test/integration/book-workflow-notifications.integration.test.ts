/**
 * Book Workflow Notifications - End-to-End Integration Tests
 * Tests complete workflow: status change → event → email delivery
 */

import { SQSEvent, Context } from 'aws-lambda';
import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { mockClient } from 'aws-sdk-client-mock';
import { v4 as uuidv4 } from 'uuid';

import { WorkflowEventService, initializeWorkflowEventService, resetWorkflowEventService } from '../../workflow-service/events/workflow-event-integration';
import { BookEventPublisher, MockBookEventPublisher } from '../../workflow-service/events/book-event-publisher';
import { SQSEventHandler } from '../../notification-service/handlers/sqs-event-handler';
import { BookEventNotificationMapper } from '../../notification-service/services/book-event-notification-mapper';
import { sesService } from '../../notification-service/services/ses-service';
import { 
  BookStatusChangeEvent, 
  BookStatusChangeEventData,
  SQSBookEventRecord 
} from '../../shared/events/book-workflow-events';
import { BookStatus, Book } from '../../types';
import { BookNotificationType } from '../../shared/events/event-types';
import { logger } from '../../utils/logger';

// Mock AWS clients
const sesMock = mockClient(SESClient);

// Test data
const TEST_BOOK: Book = {
  bookId: 'test-book-123',
  authorId: 'author-456',
  title: 'Test Book Title',
  description: 'A test book for integration testing',
  content: 'Test book content',
  genre: 'fiction',
  status: 'DRAFT' as BookStatus,
  tags: ['test', 'integration'],
  wordCount: 1000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
};

const TEST_USER_ID = 'user-789';
const TEST_EMAIL = 'bookmanagement@yopmail.com';

describe('Book Workflow Notifications - End-to-End Integration Tests', () => {
  let workflowEventService: WorkflowEventService;
  let sqsEventHandler: SQSEventHandler;
  let notificationMapper: BookEventNotificationMapper;
  let mockEventPublisher: MockBookEventPublisher;

  beforeAll(() => {
    // Set test environment variables
    process.env['NODE_ENV'] = 'test';
    process.env['NOTIFICATION_TARGET_EMAIL'] = TEST_EMAIL;
    process.env['BOOK_EVENTS_SNS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:123456789012:test-book-events';
    process.env['BOOK_NOTIFICATIONS_QUEUE_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/test-book-notifications';
    process.env['FROM_EMAIL'] = 'noreply@test.com';
    process.env['FRONTEND_BASE_URL'] = 'https://test.bookmanagement.com';
  });

  beforeEach(() => {
    // Reset mocks
    sesMock.reset();

    // Create fresh instances
    mockEventPublisher = new MockBookEventPublisher();
    workflowEventService = new WorkflowEventService(mockEventPublisher);
    sqsEventHandler = new SQSEventHandler();
    notificationMapper = new BookEventNotificationMapper();

    // Initialize workflow event service with mock publisher
    initializeWorkflowEventService(mockEventPublisher);

    // Clear any previous events
    mockEventPublisher.clearPublishedEvents();
  });

  afterEach(() => {
    resetWorkflowEventService();
  });

  describe('Complete End-to-End Flow Tests', () => {
    test('should complete full workflow: book submitted → event published → email sent', async () => {
      // Arrange
      const previousStatus: BookStatus = 'DRAFT';
      const newStatus: BookStatus = 'SUBMITTED_FOR_EDITING';
      const changeReason = 'Author submitted book for review';
      const metadata = { submissionNotes: 'Please review carefully' };

      // Mock SES to succeed
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'test-message-id-123'
      });

      // Act 1: Publish book status change event (simulates workflow service)
      await workflowEventService.publishBookStatusChangeEvent(
        TEST_BOOK,
        previousStatus,
        newStatus,
        TEST_USER_ID,
        changeReason,
        metadata
      );

      // Assert 1: Event was published
      const publishedEvents = mockEventPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const publishedEventData = publishedEvents[0];
      expect(publishedEventData).toBeDefined();
      expect(publishedEventData!.bookId).toBe(TEST_BOOK.bookId);
      expect(publishedEventData!.title).toBe(TEST_BOOK.title);
      expect(publishedEventData!.previousStatus).toBe(previousStatus);
      expect(publishedEventData!.newStatus).toBe(newStatus);
      expect(publishedEventData!.changedBy).toBe(TEST_USER_ID);
      expect(publishedEventData!.changeReason).toBe(changeReason);

      // Create full event from published data
      const publishedEvent = createBookEventFromData(publishedEventData!);

      // Act 2: Process event through SQS handler (simulates notification service)
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);

      // Assert 2: Event was processed successfully
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Assert 3: Email was sent with correct content
      expect(sesMock.calls()).toHaveLength(1);
      const emailCall = sesMock.calls()[0];
      expect(emailCall).toBeDefined();
      
      const emailInput = emailCall!.args[0].input as SendEmailCommandInput;
      expect(emailInput.Source).toBe('noreply@test.com');
      expect(emailInput.Destination?.ToAddresses).toContain(TEST_EMAIL);
      expect(emailInput.Message?.Subject?.Data).toContain('Book Submitted for Review');

      // Verify email content includes book details
      const htmlBody = emailInput.Message?.Body?.Html?.Data || '';
      const textBody = emailInput.Message?.Body?.Text?.Data || '';
      
      expect(htmlBody).toContain(TEST_BOOK.title);
      expect(htmlBody).toContain(TEST_BOOK.authorId);
      expect(htmlBody).toContain(TEST_BOOK.bookId);
      expect(htmlBody).toContain(changeReason);
      
      expect(textBody).toContain(TEST_BOOK.title);
      expect(textBody).toContain(TEST_BOOK.authorId);
      expect(textBody).toContain(TEST_BOOK.bookId);
      expect(textBody).toContain(changeReason);
    });

    test('should complete full workflow: book approved → event published → email sent', async () => {
      // Arrange
      const previousStatus: BookStatus = 'SUBMITTED_FOR_EDITING';
      const newStatus: BookStatus = 'READY_FOR_PUBLICATION';
      const changeReason = 'Book approved after editorial review';
      const metadata = { reviewComments: 'Excellent work, ready for publication' };

      // Mock SES to succeed
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'test-message-id-456'
      });

      // Act 1: Publish book status change event
      await workflowEventService.publishBookStatusChangeEvent(
        { ...TEST_BOOK, status: previousStatus },
        previousStatus,
        newStatus,
        TEST_USER_ID,
        changeReason,
        metadata
      );

      // Assert 1: Event was published
      const publishedEvents = mockEventPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const publishedEventData = publishedEvents[0];
      expect(publishedEventData.newStatus).toBe(newStatus);
      expect(publishedEventData.metadata?.notificationType).toBe(BookNotificationType.BOOK_APPROVED);

      // Create full event from published data
      const publishedEvent = createBookEventFromData(publishedEventData);

      // Act 2: Process event through SQS handler
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);

      // Assert 2: Event was processed successfully
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);

      // Assert 3: Approval email was sent
      expect(sesMock.calls()).toHaveLength(1);
      const emailCall = sesMock.calls()[0];
      const subject = emailCall.args[0].input.Message.Subject.Data;
      const htmlBody = emailCall.args[0].input.Message.Body.Html.Data;
      
      expect(subject).toContain('Book Approved for Publication');
      expect(htmlBody).toContain('approved');
      expect(htmlBody).toContain('ready for publication');
      expect(htmlBody).toContain(metadata.reviewComments);
    });

    test('should complete full workflow: book rejected → event published → email sent', async () => {
      // Arrange
      const previousStatus: BookStatus = 'READY_FOR_PUBLICATION';
      const newStatus: BookStatus = 'SUBMITTED_FOR_EDITING';
      const changeReason = 'Book requires revisions';
      const metadata = { reviewComments: 'Please address formatting issues' };

      // Mock SES to succeed
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'test-message-id-789'
      });

      // Act 1: Publish book status change event (rejection)
      await workflowEventService.publishBookStatusChangeEvent(
        { ...TEST_BOOK, status: previousStatus },
        previousStatus,
        newStatus,
        TEST_USER_ID,
        changeReason,
        metadata
      );

      // Assert 1: Event was published
      const publishedEvents = mockEventPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const publishedEventData = publishedEvents[0];
      expect(publishedEventData.previousStatus).toBe(previousStatus);
      expect(publishedEventData.newStatus).toBe(newStatus);

      // Create full event from published data
      const publishedEvent = createBookEventFromData(publishedEventData);

      // Act 2: Process event through SQS handler
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);

      // Assert 2: Event was processed successfully
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);

      // Assert 3: Rejection email was sent
      expect(sesMock.calls()).toHaveLength(1);
      const emailCall = sesMock.calls()[0];
      const subject = emailCall.args[0].input.Message.Subject.Data;
      const htmlBody = emailCall.args[0].input.Message.Body.Html.Data;
      
      expect(subject).toContain('Book Requires Revision');
      expect(htmlBody).toContain('requires revisions');
      expect(htmlBody).toContain(metadata.reviewComments);
    });

    test('should complete full workflow: book published → event published → email sent', async () => {
      // Arrange
      const previousStatus: BookStatus = 'READY_FOR_PUBLICATION';
      const newStatus: BookStatus = 'PUBLISHED';
      const changeReason = 'Book published successfully';
      const metadata = { publicationDate: new Date().toISOString() };

      // Mock SES to succeed
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'test-message-id-published'
      });

      // Act 1: Publish book status change event
      await workflowEventService.publishBookStatusChangeEvent(
        { ...TEST_BOOK, status: previousStatus },
        previousStatus,
        newStatus,
        TEST_USER_ID,
        changeReason,
        metadata
      );

      // Assert 1: Event was published
      const publishedEvents = mockEventPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const publishedEventData = publishedEvents[0];
      expect(publishedEventData.newStatus).toBe(newStatus);
      expect(publishedEventData.metadata?.notificationType).toBe(BookNotificationType.BOOK_PUBLISHED);

      // Create full event from published data
      const publishedEvent = createBookEventFromData(publishedEventData);

      // Act 2: Process event through SQS handler
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);

      // Assert 2: Event was processed successfully
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);

      // Assert 3: Publication email was sent
      expect(sesMock.calls()).toHaveLength(1);
      const emailCall = sesMock.calls()[0];
      const subject = emailCall.args[0].input.Message.Subject.Data;
      const htmlBody = emailCall.args[0].input.Message.Body.Html.Data;
      
      expect(subject).toContain('Book Published Successfully');
      expect(htmlBody).toContain('successfully published');
      expect(htmlBody).toContain('now available to readers');
    });
  });

  describe('Error Scenarios and Retry Mechanisms', () => {
    test('should retry transient SES errors and eventually succeed', async () => {
      // Arrange
      const previousStatus: BookStatus = 'DRAFT';
      const newStatus: BookStatus = 'SUBMITTED_FOR_EDITING';

      // Mock SES to fail first two times, then succeed
      sesMock
        .on(SendEmailCommand)
        .rejectsOnce(new Error('Throttling'))
        .rejectsOnce(new Error('ServiceUnavailable'))
        .resolvesOnce({
          MessageId: 'test-message-id-retry-success'
        });

      // Act 1: Publish event
      await workflowEventService.publishBookStatusChangeEvent(
        TEST_BOOK,
        previousStatus,
        newStatus,
        TEST_USER_ID
      );

      const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
      const publishedEvent = createBookEventFromData(publishedEventData);

      // Act 2: Process event with retry simulation
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent, '1'); // First attempt
      let context = createMockLambdaContext();
      
      let result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
      
      // Assert: First attempt should fail but be marked for retry
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(1);

      // Act 3: Simulate second retry
      const retryEvent = createSQSEventFromBookEvent(publishedEvent, '2'); // Second attempt
      context = createMockLambdaContext();
      
      result = await sqsEventHandler.handleSQSEvent(retryEvent, context);
      
      // Assert: Second attempt should also fail but be marked for retry
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(1);

      // Act 4: Simulate third retry (should succeed)
      const finalRetryEvent = createSQSEventFromBookEvent(publishedEvent, '3'); // Third attempt
      context = createMockLambdaContext();
      
      result = await sqsEventHandler.handleSQSEvent(finalRetryEvent, context);
      
      // Assert: Third attempt should succeed
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.batchItemFailures).toHaveLength(0);

      // Verify SES was called 3 times
      expect(sesMock.calls()).toHaveLength(3);
    });

    test('should send permanent SES errors to DLQ without retry', async () => {
      // Arrange
      const previousStatus: BookStatus = 'DRAFT';
      const newStatus: BookStatus = 'SUBMITTED_FOR_EDITING';

      // Mock SES to fail with permanent error
      sesMock.on(SendEmailCommand).rejects(new Error('Invalid email address'));

      // Act 1: Publish event
      await workflowEventService.publishBookStatusChangeEvent(
        TEST_BOOK,
        previousStatus,
        newStatus,
        TEST_USER_ID
      );

      const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
      const publishedEvent = createBookEventFromData(publishedEventData);

      // Act 2: Process event (should fail permanently)
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent, '4'); // Max retries exceeded
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
      
      // Assert: Should fail without retry (goes to DLQ)
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(0); // No retry, goes to DLQ
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.error).toContain('Invalid email address');
    });

    test('should handle invalid event schema and send to DLQ', async () => {
      // Arrange - Create invalid event
      const invalidEvent: any = {
        eventType: 'book_status_changed',
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: 'workflow-service',
        version: '1.0',
        data: {
          // Missing required fields
          bookId: '',
          title: '',
          // author: missing
          previousStatus: 'INVALID_STATUS',
          newStatus: 'ANOTHER_INVALID_STATUS',
          changedBy: ''
        }
      };

      // Act: Process invalid event
      const sqsEvent = createSQSEventFromBookEvent(invalidEvent as BookStatusChangeEvent);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
      
      // Assert: Should fail validation and go to DLQ
      expect(result.totalRecords).toBe(1);
      expect(result.successfullyProcessed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(0); // Validation errors go to DLQ
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.error).toContain('validation failed');

      // Verify no email was sent
      expect(sesMock.calls()).toHaveLength(0);
    });

    test('should handle batch processing with mixed success/failure', async () => {
      // Arrange
      const events = [
        // Valid event 1
        await createValidBookEvent('book-1', 'DRAFT', 'SUBMITTED_FOR_EDITING'),
        // Valid event 2  
        await createValidBookEvent('book-2', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION'),
        // Invalid event
        createInvalidBookEvent()
      ];

      // Mock SES to succeed for valid events
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'batch-test-message-id'
      });

      // Act: Process batch of events
      const sqsEvent = createBatchSQSEvent(events);
      const context = createMockLambdaContext();
      
      const result = await sqsEventHandler.handleSQSEvent(sqsEvent, context);
      
      // Assert: 2 should succeed, 1 should fail
      expect(result.totalRecords).toBe(3);
      expect(result.successfullyProcessed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.batchItemFailures).toHaveLength(1); // Only invalid event

      // Verify 2 emails were sent
      expect(sesMock.calls()).toHaveLength(2);
    });
  });

  describe('Email Content and Delivery Verification', () => {
    test('should generate correct email content for book submission', async () => {
      // Arrange
      const testBook = {
        ...TEST_BOOK,
        title: 'My Amazing Novel',
        authorId: 'author-john-doe'
      };
      const changeReason = 'Ready for editorial review';
      const metadata = { submissionNotes: 'First draft complete' };

      // Mock SES
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'content-test-message-id'
      });

      // Act
      await workflowEventService.publishBookStatusChangeEvent(
        testBook,
        'DRAFT',
        'SUBMITTED_FOR_EDITING',
        TEST_USER_ID,
        changeReason,
        metadata
      );

      const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
      const publishedEvent = createBookEventFromData(publishedEventData);
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
      const context = createMockLambdaContext();
      
      await sqsEventHandler.handleSQSEvent(sqsEvent, context);

      // Assert email content
      const emailCall = sesMock.calls()[0];
      const emailInput = emailCall.args[0].input;
      
      // Verify recipient
      expect(emailInput.Destination.ToAddresses).toContain(TEST_EMAIL);
      
      // Verify subject
      expect(emailInput.Message.Subject.Data).toBe('📚 Book Submitted for Review: "My Amazing Novel"');
      
      // Verify HTML content
      const htmlBody = emailInput.Message.Body.Html.Data;
      expect(htmlBody).toContain('My Amazing Novel');
      expect(htmlBody).toContain('author-john-doe');
      expect(htmlBody).toContain(testBook.bookId);
      expect(htmlBody).toContain('Submitted for Editing');
      expect(htmlBody).toContain(changeReason);
      expect(htmlBody).toContain('Review Book');
      
      // Verify text content
      const textBody = emailInput.Message.Body.Text.Data;
      expect(textBody).toContain('NEW BOOK SUBMITTED FOR REVIEW');
      expect(textBody).toContain('My Amazing Novel');
      expect(textBody).toContain('author-john-doe');
      expect(textBody).toContain(changeReason);
    });

    test('should include action URLs in email content', async () => {
      // Arrange
      process.env['FRONTEND_BASE_URL'] = 'https://bookmanagement.example.com';
      
      // Mock SES
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'action-url-test-message-id'
      });

      // Act - Test different status transitions
      const testCases = [
        {
          from: 'DRAFT' as BookStatus,
          to: 'SUBMITTED_FOR_EDITING' as BookStatus,
          expectedUrl: `https://bookmanagement.example.com/books/${TEST_BOOK.bookId}/review`
        },
        {
          from: 'SUBMITTED_FOR_EDITING' as BookStatus,
          to: 'READY_FOR_PUBLICATION' as BookStatus,
          expectedUrl: `https://bookmanagement.example.com/books/${TEST_BOOK.bookId}/publish`
        },
        {
          from: 'READY_FOR_PUBLICATION' as BookStatus,
          to: 'PUBLISHED' as BookStatus,
          expectedUrl: `https://bookmanagement.example.com/books/${TEST_BOOK.bookId}/view`
        }
      ];

      for (const testCase of testCases) {
        // Clear previous calls
        sesMock.reset();
        sesMock.on(SendEmailCommand).resolves({
          MessageId: `action-url-test-${testCase.to}`
        });
        mockEventPublisher.clearPublishedEvents();

        await workflowEventService.publishBookStatusChangeEvent(
          { ...TEST_BOOK, status: testCase.from },
          testCase.from,
          testCase.to,
          TEST_USER_ID
        );

        const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
        const publishedEvent = createBookEventFromData(publishedEventData);
        const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
        const context = createMockLambdaContext();
        
        await sqsEventHandler.handleSQSEvent(sqsEvent, context);

        // Assert action URL is included
        const emailCall = sesMock.calls()[0];
        const htmlBody = emailCall.args[0].input.Message.Body.Html.Data;
        const textBody = emailCall.args[0].input.Message.Body.Text.Data;
        
        expect(htmlBody).toContain(testCase.expectedUrl);
        expect(textBody).toContain(testCase.expectedUrl);
      }
    });

    test('should deliver emails to correct target address', async () => {
      // Arrange
      const customEmail = 'custom-target@example.com';
      process.env['NOTIFICATION_TARGET_EMAIL'] = customEmail;
      
      // Create new mapper with updated environment
      notificationMapper = new BookEventNotificationMapper();
      
      // Mock SES
      sesMock.on(SendEmailCommand).resolves({
        MessageId: 'target-email-test-message-id'
      });

      // Act
      await workflowEventService.publishBookStatusChangeEvent(
        TEST_BOOK,
        'DRAFT',
        'SUBMITTED_FOR_EDITING',
        TEST_USER_ID
      );

      const publishedEventData = mockEventPublisher.getPublishedEvents()[0];
      const publishedEvent = createBookEventFromData(publishedEventData);
      const sqsEvent = createSQSEventFromBookEvent(publishedEvent);
      const context = createMockLambdaContext();
      
      await sqsEventHandler.handleSQSEvent(sqsEvent, context);

      // Assert email was sent to custom target
      const emailCall = sesMock.calls()[0];
      expect(emailCall.args[0].input.Destination.ToAddresses).toContain(customEmail);
      expect(emailCall.args[0].input.Source).toBe('noreply@test.com');
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
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-book-events',
      Message: JSON.stringify(bookEvent),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1',
      Signature: 'test-signature',
      SigningCertURL: 'https://test.com/cert',
      UnsubscribeURL: 'https://test.com/unsubscribe'
    };

    return {
      Records: [{
        messageId: uuidv4(),
        receiptHandle: 'test-receipt-handle',
        body: JSON.stringify(snsMessage),
        attributes: {
          ApproximateReceiveCount: receiveCount,
          SentTimestamp: Date.now().toString(),
          SenderId: 'test-sender',
          ApproximateFirstReceiveTimestamp: Date.now().toString()
        },
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
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
          TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-book-events',
          Message: JSON.stringify(event),
          Timestamp: new Date().toISOString(),
          SignatureVersion: '1',
          Signature: 'test-signature',
          SigningCertURL: 'https://test.com/cert',
          UnsubscribeURL: 'https://test.com/unsubscribe'
        };

        return {
          messageId: `batch-message-${index}`,
          receiptHandle: `batch-receipt-${index}`,
          body: JSON.stringify(snsMessage),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: Date.now().toString(),
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: Date.now().toString()
          },
          messageAttributes: {},
          md5OfBody: `batch-md5-${index}`,
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
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
      title: `Test Book ${bookId}`,
      author: 'test-author',
      previousStatus,
      newStatus,
      changedBy: TEST_USER_ID,
      changeReason: 'Test transition',
      metadata: { test: true }
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

  function createInvalidBookEvent(): BookStatusChangeEvent {
    return {
      eventType: 'book_status_changed',
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      source: 'workflow-service',
      version: '1.0',
      data: {
        bookId: '', // Invalid: empty
        title: '', // Invalid: empty
        author: '', // Invalid: empty
        previousStatus: 'INVALID_STATUS' as any,
        newStatus: 'ANOTHER_INVALID_STATUS' as any,
        changedBy: '' // Invalid: empty
      }
    };
  }

  function createMockLambdaContext(): Context {
    return {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '128',
      awsRequestId: uuidv4(),
      logGroupName: '/aws/lambda/test',
      logStreamName: 'test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };
  }
});