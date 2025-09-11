/**
 * Notification Flow Test
 * Tests the complete notification flow without external dependencies
 */

import { WorkflowEventService } from '../../../workflow-service/events/workflow-event-integration';
import { MockBookEventPublisher } from '../../../workflow-service/events/book-event-publisher';
import { Book, BookStatus } from '../../shared/types';

describe('Notification Flow Tests', () => {
  let workflowEventService: WorkflowEventService;
  let mockPublisher: MockBookEventPublisher;

  const TEST_BOOK: Book = {
    bookId: 'test-book-123',
    authorId: 'author-456',
    title: 'Test Book Title',
    description: 'A test book for notification testing',
    content: 'Test book content',
    genre: 'fiction',
    status: 'DRAFT' as BookStatus,
    tags: ['test'],
    wordCount: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };

  beforeEach(() => {
    mockPublisher = new MockBookEventPublisher();
    workflowEventService = new WorkflowEventService(mockPublisher);
  });

  test('should publish event when book is submitted for editing', async () => {
    // Act
    await workflowEventService.publishBookStatusChangeEvent(
      TEST_BOOK,
      'DRAFT',
      'SUBMITTED_FOR_EDITING',
      'user-123',
      'Ready for review'
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    
    const event = publishedEvents[0]!;
    expect(event.bookId).toBe(TEST_BOOK.bookId);
    expect(event.title).toBe(TEST_BOOK.title);
    expect(event.previousStatus).toBe('DRAFT');
    expect(event.newStatus).toBe('SUBMITTED_FOR_EDITING');
    expect(event.changedBy).toBe('user-123');
    expect(event.changeReason).toBe('Ready for review');
    expect(event.metadata?.['notificationType']).toBe('book_submitted');
  });

  test('should publish event when book is approved', async () => {
    // Act
    await workflowEventService.publishBookStatusChangeEvent(
      { ...TEST_BOOK, status: 'SUBMITTED_FOR_EDITING' },
      'SUBMITTED_FOR_EDITING',
      'READY_FOR_PUBLICATION',
      'editor-456',
      'Approved for publication'
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    
    const event = publishedEvents[0]!;
    expect(event.newStatus).toBe('READY_FOR_PUBLICATION');
    expect(event.metadata?.['notificationType']).toBe('book_approved');
  });

  test('should publish event when book is rejected', async () => {
    // Act
    await workflowEventService.publishBookStatusChangeEvent(
      { ...TEST_BOOK, status: 'READY_FOR_PUBLICATION' },
      'READY_FOR_PUBLICATION',
      'SUBMITTED_FOR_EDITING',
      'editor-456',
      'Needs revisions'
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    
    const event = publishedEvents[0];
    expect(event.previousStatus).toBe('READY_FOR_PUBLICATION');
    expect(event.newStatus).toBe('SUBMITTED_FOR_EDITING');
    expect(event.metadata?.['notificationType']).toBe('book_rejected');
  });

  test('should publish event when book is published', async () => {
    // Act
    await workflowEventService.publishBookStatusChangeEvent(
      { ...TEST_BOOK, status: 'READY_FOR_PUBLICATION' },
      'READY_FOR_PUBLICATION',
      'PUBLISHED',
      'publisher-789',
      'Book published successfully'
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    
    const event = publishedEvents[0];
    expect(event.newStatus).toBe('PUBLISHED');
    expect(event.metadata?.['notificationType']).toBe('book_published');
  });

  test('should not publish event for non-triggering transitions', async () => {
    // Act - DRAFT to DRAFT should not trigger notification
    await workflowEventService.publishBookStatusChangeEvent(
      TEST_BOOK,
      'DRAFT',
      'DRAFT',
      'user-123',
      'Just saving draft'
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(0);
  });

  test('should handle initial book creation correctly', async () => {
    // Act - Initial creation with DRAFT status should not trigger notification
    await workflowEventService.publishBookStatusChangeEvent(
      TEST_BOOK,
      null, // No previous status
      'DRAFT',
      'user-123',
      'Initial book creation'
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(0);
  });

  test('should handle initial creation with non-draft status', async () => {
    // Act - Initial creation with non-DRAFT status should trigger notification
    await workflowEventService.publishBookStatusChangeEvent(
      { ...TEST_BOOK, status: 'SUBMITTED_FOR_EDITING' },
      null, // No previous status
      'SUBMITTED_FOR_EDITING',
      'user-123',
      'Direct submission'
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    
    const event = publishedEvents[0];
    expect(event.previousStatus).toBeNull();
    expect(event.newStatus).toBe('SUBMITTED_FOR_EDITING');
    expect(event.metadata?.['notificationType']).toBe('book_submitted');
  });

  test('should include metadata in published events', async () => {
    // Act
    await workflowEventService.publishBookStatusChangeEvent(
      TEST_BOOK,
      'DRAFT',
      'SUBMITTED_FOR_EDITING',
      'user-123',
      'Ready for review',
      {
        userRole: 'AUTHOR',
        userEmail: 'author@example.com',
        requestId: 'req-123',
        customData: 'test-value'
      }
    );

    // Assert
    const publishedEvents = mockPublisher.getPublishedEvents();
    expect(publishedEvents).toHaveLength(1);
    
    const event = publishedEvents[0];
    expect(event.metadata).toMatchObject({
      notificationType: 'book_submitted',
      bookGenre: 'fiction',
      userRole: 'AUTHOR',
      userEmail: 'author@example.com',
      requestId: 'req-123',
      customData: 'test-value'
    });
  });
});