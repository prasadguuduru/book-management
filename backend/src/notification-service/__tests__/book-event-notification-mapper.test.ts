/**
 * Unit Tests for Book Event Notification Mapper
 * Tests event-to-notification mapping and email content generation
 */

import { BookEventNotificationMapper } from '../services/book-event-notification-mapper';
import { BookStatusChangeEvent } from '../../shared/events/book-workflow-events';
import { BookStatusEnum, BookNotificationType } from '../../shared/events/event-types';

// Mock logger
jest.mock('../../utils/logger');

describe('BookEventNotificationMapper', () => {
  let mapper: BookEventNotificationMapper;

  beforeEach(() => {
    // Set environment variables
    process.env['NOTIFICATION_TARGET_EMAIL'] = 'test@yopmail.com';
    process.env['FRONTEND_BASE_URL'] = 'https://test.example.com';
    
    mapper = new BookEventNotificationMapper();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env['NOTIFICATION_TARGET_EMAIL'];
    delete process.env['FRONTEND_BASE_URL'];
  });

  describe('mapEventToNotification', () => {
    it('should map book submitted event to notification request', () => {
      // Arrange
      const event: BookStatusChangeEvent = {
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

      // Act
      const result = mapper.mapEventToNotification(event);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.type).toBe(BookNotificationType.BOOK_SUBMITTED);
      expect(result!.recipientEmail).toBe('test@yopmail.com');
      expect(result!.variables).toEqual({
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Ready for review',
        actionUrl: 'https://test.example.com/books/book-123/review'
      });
    });

    it('should map book approved event to notification request', () => {
      // Arrange
      const event: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          newStatus: BookStatusEnum.READY_FOR_PUBLICATION,
          changedBy: 'editor-456',
          changeReason: 'Excellent work',
          metadata: {
            reviewComments: 'Great story and well written',
            nextSteps: 'Ready for publication'
          }
        }
      };

      // Act
      const result = mapper.mapEventToNotification(event);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.type).toBe(BookNotificationType.BOOK_APPROVED);
      expect(result!.recipientEmail).toBe('test@yopmail.com');
      expect(result!.variables).toEqual({
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Excellent work\n\nNext Steps: Ready for publication',
        actionUrl: 'https://test.example.com/books/book-123/publish'
      });
    });

    it('should map book rejected event to notification request', () => {
      // Arrange
      const event: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.READY_FOR_PUBLICATION,
          newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
          changedBy: 'editor-456',
          changeReason: 'Needs revision'
        }
      };

      // Act
      const result = mapper.mapEventToNotification(event);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.type).toBe(BookNotificationType.BOOK_REJECTED);
      expect(result!.recipientEmail).toBe('test@yopmail.com');
      expect(result!.variables).toEqual({
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Needs revision',
        actionUrl: 'https://test.example.com/books/book-123/edit'
      });
    });

    it('should map book published event to notification request', () => {
      // Arrange
      const event: BookStatusChangeEvent = {
        eventType: 'book_status_changed',
        eventId: '12345678-1234-4123-8123-123456789012',
        timestamp: '2025-01-01T12:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'Test Author',
          previousStatus: BookStatusEnum.READY_FOR_PUBLICATION,
          newStatus: BookStatusEnum.PUBLISHED,
          changedBy: 'publisher-456',
          changeReason: 'Published successfully'
        }
      };

      // Act
      const result = mapper.mapEventToNotification(event);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.type).toBe(BookNotificationType.BOOK_PUBLISHED);
      expect(result!.recipientEmail).toBe('test@yopmail.com');
      expect(result!.variables).toEqual({
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Published successfully',
        actionUrl: 'https://test.example.com/books/book-123/view'
      });
    });

    it('should return null for events that do not require notifications', () => {
      // Arrange
      const event: BookStatusChangeEvent = {
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

      // Act
      const result = mapper.mapEventToNotification(event);

      // Assert
      expect(result).toBeNull();
    });

    it('should use default email when environment variable is not set', () => {
      // Arrange
      delete process.env['NOTIFICATION_TARGET_EMAIL'];
      const mapperWithDefaults = new BookEventNotificationMapper();

      const event: BookStatusChangeEvent = {
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

      // Act
      const result = mapperWithDefaults.mapEventToNotification(event);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.recipientEmail).toBe('bookmanagement@yopmail.com');
    });
  });

  describe('generateEmailContent', () => {
    it('should generate book submitted email content', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Ready for review',
        actionUrl: 'https://test.example.com/books/book-123/review'
      };

      // Act
      const result = mapper.generateEmailContent(BookNotificationType.BOOK_SUBMITTED, variables);

      // Assert
      expect(result.subject).toBe('📚 Book Submitted for Review: "Test Book"');
      expect(result.htmlBody).toContain('Test Book');
      expect(result.htmlBody).toContain('Test Author');
      expect(result.htmlBody).toContain('book-123');
      expect(result.htmlBody).toContain('Ready for review');
      expect(result.htmlBody).toContain('https://test.example.com/books/book-123/review');
      expect(result.textBody).toContain('Test Book');
      expect(result.textBody).toContain('Test Author');
      expect(result.textBody).toContain('Ready for review');
    });

    it('should generate book approved email content', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Excellent work',
        actionUrl: 'https://test.example.com/books/book-123/publish'
      };

      // Act
      const result = mapper.generateEmailContent(BookNotificationType.BOOK_APPROVED, variables);

      // Assert
      expect(result.subject).toBe('✅ Book Approved for Publication: "Test Book"');
      expect(result.htmlBody).toContain('Test Book');
      expect(result.htmlBody).toContain('Test Author');
      expect(result.htmlBody).toContain('book-123');
      expect(result.htmlBody).toContain('Excellent work');
      expect(result.htmlBody).toContain('https://test.example.com/books/book-123/publish');
      expect(result.textBody).toContain('Test Book');
      expect(result.textBody).toContain('Test Author');
      expect(result.textBody).toContain('Excellent work');
    });

    it('should generate book rejected email content', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Needs revision',
        actionUrl: 'https://test.example.com/books/book-123/edit'
      };

      // Act
      const result = mapper.generateEmailContent(BookNotificationType.BOOK_REJECTED, variables);

      // Assert
      expect(result.subject).toBe('❌ Book Requires Revision: "Test Book"');
      expect(result.htmlBody).toContain('Test Book');
      expect(result.htmlBody).toContain('Test Author');
      expect(result.htmlBody).toContain('book-123');
      expect(result.htmlBody).toContain('Needs revision');
      expect(result.htmlBody).toContain('https://test.example.com/books/book-123/edit');
      expect(result.textBody).toContain('Test Book');
      expect(result.textBody).toContain('Test Author');
      expect(result.textBody).toContain('Needs revision');
    });

    it('should generate book published email content', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Published successfully',
        actionUrl: 'https://test.example.com/books/book-123/view'
      };

      // Act
      const result = mapper.generateEmailContent(BookNotificationType.BOOK_PUBLISHED, variables);

      // Assert
      expect(result.subject).toBe('🎉 Book Published Successfully: "Test Book"');
      expect(result.htmlBody).toContain('Test Book');
      expect(result.htmlBody).toContain('Test Author');
      expect(result.htmlBody).toContain('book-123');
      expect(result.htmlBody).toContain('Published successfully');
      expect(result.htmlBody).toContain('https://test.example.com/books/book-123/view');
      expect(result.textBody).toContain('Test Book');
      expect(result.textBody).toContain('Test Author');
      expect(result.textBody).toContain('Published successfully');
    });

    it('should handle email content without comments', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        actionUrl: 'https://test.example.com/books/book-123/review'
      };

      // Act
      const result = mapper.generateEmailContent(BookNotificationType.BOOK_SUBMITTED, variables);

      // Assert
      expect(result.subject).toBe('📚 Book Submitted for Review: "Test Book"');
      expect(result.htmlBody).toContain('Test Book');
      expect(result.htmlBody).toContain('Test Author');
      expect(result.htmlBody).toContain('book-123');
      expect(result.htmlBody).not.toContain('Submission Notes');
      expect(result.textBody).toContain('Test Book');
      expect(result.textBody).toContain('Test Author');
    });

    it('should handle email content without action URL', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Ready for review'
      };

      // Act
      const result = mapper.generateEmailContent(BookNotificationType.BOOK_SUBMITTED, variables);

      // Assert
      expect(result.subject).toBe('📚 Book Submitted for Review: "Test Book"');
      expect(result.htmlBody).toContain('Test Book');
      expect(result.htmlBody).toContain('Test Author');
      expect(result.htmlBody).toContain('book-123');
      expect(result.htmlBody).toContain('Ready for review');
      expect(result.htmlBody).not.toContain('Review Book');
      expect(result.textBody).toContain('Test Book');
      expect(result.textBody).toContain('Ready for review');
    });

    it('should throw error for unknown notification type', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123'
      };

      // Act & Assert
      expect(() => {
        mapper.generateEmailContent('unknown_type' as any, variables);
      }).toThrow('Unknown notification type: unknown_type');
    });

    it('should handle multiline comments in HTML', () => {
      // Arrange
      const variables = {
        userName: 'Test Author',
        bookTitle: 'Test Book',
        bookId: 'book-123',
        comments: 'Line 1\nLine 2\nLine 3',
        actionUrl: 'https://test.example.com/books/book-123/review'
      };

      // Act
      const result = mapper.generateEmailContent(BookNotificationType.BOOK_SUBMITTED, variables);

      // Assert
      expect(result.htmlBody).toContain('Line 1<br>Line 2<br>Line 3');
      expect(result.textBody).toContain('Line 1\nLine 2\nLine 3');
    });
  });
});