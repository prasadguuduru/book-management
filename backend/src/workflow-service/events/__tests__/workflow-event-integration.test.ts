/**
 * Unit tests for Workflow Event Integration
 */

import { WorkflowEventService, getWorkflowEventService, initializeWorkflowEventService, resetWorkflowEventService } from '../workflow-event-integration';
import { MockBookEventPublisher } from '../book-event-publisher';
import { Book, BookStatus } from '../../../types';
import { BookStatusEnum } from '../../../shared/events/event-types';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('WorkflowEventService', () => {
  let mockPublisher: MockBookEventPublisher;
  let workflowEventService: WorkflowEventService;
  let mockBook: Book;

  beforeEach(() => {
    mockPublisher = new MockBookEventPublisher();
    workflowEventService = new WorkflowEventService(mockPublisher);
    
    mockBook = {
      bookId: 'book-123',
      authorId: 'user-456',
      title: 'Test Book',
      description: 'A test book for unit testing',
      content: 'Test content',
      genre: 'fiction',
      status: BookStatusEnum.DRAFT,
      tags: ['test'],
      wordCount: 1000,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      version: 1
    };
  });

  afterEach(() => {
    mockPublisher.clearPublishedEvents();
  });

  describe('publishBookStatusChangeEvent', () => {
    it('should publish event for valid status transition', async () => {
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        BookStatusEnum.DRAFT,
        BookStatusEnum.SUBMITTED_FOR_EDITING,
        'user-456',
        'Ready for review',
        { action: 'SUBMIT' }
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const event = publishedEvents[0];
      expect(event).toEqual({
        bookId: 'book-123',
        title: 'Test Book',
        author: 'user-456',
        previousStatus: BookStatusEnum.DRAFT,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456',
        changeReason: 'Ready for review',
        metadata: {
          action: 'SUBMIT',
          notificationType: 'book_submitted',
          bookGenre: 'fiction',
          bookDescription: 'A test book for unit testing'
        }
      });
    });

    it('should publish event for approval transition', async () => {
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        BookStatusEnum.SUBMITTED_FOR_EDITING,
        BookStatusEnum.READY_FOR_PUBLICATION,
        'editor-789',
        'Book approved for publication',
        { action: 'APPROVE', reviewComments: 'Excellent work' }
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const event = publishedEvents[0]!;
      expect(event.metadata?.['notificationType']).toBe('book_approved');
      expect(event.metadata?.['reviewComments']).toBe('Excellent work');
    });

    it('should publish event for rejection transition', async () => {
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        BookStatusEnum.READY_FOR_PUBLICATION,
        BookStatusEnum.SUBMITTED_FOR_EDITING,
        'publisher-101',
        'Needs more work',
        { action: 'REJECT', rejectionReason: 'Grammar issues' }
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const event = publishedEvents[0]!;
      expect(event.metadata?.['notificationType']).toBe('book_rejected');
      expect(event.metadata?.['rejectionReason']).toBe('Grammar issues');
    });

    it('should publish event for publication transition', async () => {
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        BookStatusEnum.READY_FOR_PUBLICATION,
        BookStatusEnum.PUBLISHED,
        'publisher-101',
        'Book published successfully',
        { action: 'PUBLISH', publicationDate: '2025-01-15' }
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const event = publishedEvents[0]!;
      expect(event.metadata?.['notificationType']).toBe('book_published');
      expect(event.metadata?.['publicationDate']).toBe('2025-01-15');
    });

    it('should not publish event for non-triggering transitions', async () => {
      // DRAFT to DRAFT (no change)
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        BookStatusEnum.DRAFT,
        BookStatusEnum.DRAFT,
        'user-456',
        'No change'
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(0);
    });

    it('should not publish event when no previous status (initial creation to DRAFT)', async () => {
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        null,
        BookStatusEnum.DRAFT,
        'user-456',
        'Initial creation'
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(0);
    });

    it('should publish event when initial creation to non-DRAFT status', async () => {
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        null,
        BookStatusEnum.SUBMITTED_FOR_EDITING,
        'user-456',
        'Direct submission'
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const event = publishedEvents[0]!;
      expect(event.previousStatus).toBeNull();
      expect(event.newStatus).toBe(BookStatusEnum.SUBMITTED_FOR_EDITING);
    });

    it('should handle missing optional parameters', async () => {
      await workflowEventService.publishBookStatusChangeEvent(
        mockBook,
        BookStatusEnum.DRAFT,
        BookStatusEnum.SUBMITTED_FOR_EDITING,
        'user-456'
        // No changeReason or metadata
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const event = publishedEvents[0]!;
      expect(event.changeReason).toBeUndefined();
      expect(event.metadata?.['notificationType']).toBe('book_submitted');
    });

    it('should truncate long book descriptions', async () => {
      const longDescription = 'A'.repeat(300); // 300 characters
      const bookWithLongDescription = {
        ...mockBook,
        description: longDescription
      };

      await workflowEventService.publishBookStatusChangeEvent(
        bookWithLongDescription,
        BookStatusEnum.DRAFT,
        BookStatusEnum.SUBMITTED_FOR_EDITING,
        'user-456'
      );

      const publishedEvents = mockPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      
      const event = publishedEvents[0]!;
      expect(event.metadata?.['bookDescription']).toHaveLength(200);
      expect(event.metadata?.['bookDescription']).toBe('A'.repeat(200));
    });

    it('should handle publisher errors gracefully', async () => {
      // Create a publisher that throws errors
      const errorPublisher = {
        publishStatusChange: jest.fn().mockRejectedValue(new Error('Publisher error'))
      };
      
      const serviceWithErrorPublisher = new WorkflowEventService(errorPublisher as any);

      // Should not throw error
      await expect(
        serviceWithErrorPublisher.publishBookStatusChangeEvent(
          mockBook,
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          'user-456'
        )
      ).resolves.not.toThrow();

      expect(errorPublisher.publishStatusChange).toHaveBeenCalled();
    });
  });

  describe('getEventPublisher', () => {
    it('should return the configured event publisher', () => {
      const publisher = workflowEventService.getEventPublisher();
      expect(publisher).toBe(mockPublisher);
    });
  });
});

describe('Singleton functions', () => {
  beforeEach(() => {
    resetWorkflowEventService();
  });

  afterEach(() => {
    resetWorkflowEventService();
  });

  describe('getWorkflowEventService', () => {
    it('should return singleton instance', () => {
      const service1 = getWorkflowEventService();
      const service2 = getWorkflowEventService();
      
      expect(service1).toBe(service2);
      expect(service1).toBeInstanceOf(WorkflowEventService);
    });

    it('should create new instance after reset', () => {
      const service1 = getWorkflowEventService();
      resetWorkflowEventService();
      const service2 = getWorkflowEventService();
      
      expect(service1).not.toBe(service2);
      expect(service2).toBeInstanceOf(WorkflowEventService);
    });
  });

  describe('initializeWorkflowEventService', () => {
    it('should initialize with custom publisher', () => {
      const mockPublisher = new MockBookEventPublisher();
      initializeWorkflowEventService(mockPublisher);
      
      const service = getWorkflowEventService();
      expect(service.getEventPublisher()).toBe(mockPublisher);
    });

    it('should replace existing instance', () => {
      const service1 = getWorkflowEventService();
      
      const mockPublisher = new MockBookEventPublisher();
      initializeWorkflowEventService(mockPublisher);
      
      const service2 = getWorkflowEventService();
      expect(service1).not.toBe(service2);
      expect(service2.getEventPublisher()).toBe(mockPublisher);
    });
  });

  describe('resetWorkflowEventService', () => {
    it('should reset singleton instance', () => {
      const service1 = getWorkflowEventService();
      resetWorkflowEventService();
      
      // Next call should create new instance
      const service2 = getWorkflowEventService();
      expect(service1).not.toBe(service2);
    });
  });
});