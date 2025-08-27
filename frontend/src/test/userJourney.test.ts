// User Journey Test for Ebook Publishing Platform
import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiService } from '@/services/mockApi';
import { CreateBookRequest, CreateReviewRequest } from '@/types';

describe('Complete User Journey', () => {
  beforeEach(() => {
    // Set up mock authentication for tests
    const mockUser = mockApiService
      .getMockUsers()
      .find(u => u.role === 'AUTHOR');
    if (mockUser) {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            user: mockUser,
            token: 'mock-token',
            refreshToken: 'mock-refresh-token',
            isAuthenticated: true,
          },
        })
      );
    }
  });

  it('should complete the full book publishing workflow', async () => {
    // 1. Author creates a book
    const bookData: CreateBookRequest = {
      title: 'Test Journey Book',
      description: 'A book created during the user journey test',
      content:
        'Chapter 1: The Test\n\nThis is a test book created to verify the complete workflow.',
      genre: 'fiction',
      tags: ['test', 'journey', 'workflow'],
    };

    const createdBook = await mockApiService.createBook(bookData);
    expect(createdBook.title).toBe(bookData.title);
    expect(createdBook.status).toBe('DRAFT');
    expect(createdBook.tags).toEqual(bookData.tags);

    // 2. Author submits book for editing
    const submittedBook = await mockApiService.submitBookForEditing(
      createdBook.bookId
    );
    expect(submittedBook.status).toBe('SUBMITTED_FOR_EDITING');

    // 3. Editor approves the book
    const approvedBook = await mockApiService.approveBook(
      createdBook.bookId,
      'Great work!'
    );
    expect(approvedBook.status).toBe('READY_FOR_PUBLICATION');

    // 4. Publisher publishes the book
    const publishedBook = await mockApiService.publishBook(createdBook.bookId);
    expect(publishedBook.status).toBe('PUBLISHED');
    expect(publishedBook.publishedAt).toBeDefined();

    // 5. Reader creates a review
    const reviewData: CreateReviewRequest = {
      bookId: publishedBook.bookId,
      rating: 5,
      comment: 'Excellent book! Really enjoyed the test journey.',
    };

    const review = await mockApiService.createReview(reviewData);
    expect(review.rating).toBe(5);
    expect(review.comment).toBe(reviewData.comment);
    expect(review.bookId).toBe(publishedBook.bookId);

    // 6. Verify workflow history
    const workflow = await mockApiService.getBookWorkflow(createdBook.bookId);
    expect(workflow.length).toBeGreaterThan(0);

    const actions = workflow.map(entry => entry.action);
    expect(actions).toContain('CREATE');
    expect(actions).toContain('SUBMIT');
    expect(actions).toContain('APPROVE');
    expect(actions).toContain('PUBLISH');
  });

  it('should handle book rejection workflow', async () => {
    // 1. Author creates a book
    const bookData: CreateBookRequest = {
      title: 'Book to be Rejected',
      description: 'This book will be rejected for testing',
      content: 'Not very good content that needs improvement.',
      genre: 'mystery',
      tags: ['rejection', 'test'],
    };

    const createdBook = await mockApiService.createBook(bookData);

    // 2. Author submits book for editing
    const submittedBook = await mockApiService.submitBookForEditing(
      createdBook.bookId
    );
    expect(submittedBook.status).toBe('SUBMITTED_FOR_EDITING');

    // 3. Editor rejects the book
    const rejectedBook = await mockApiService.rejectBook(
      createdBook.bookId,
      'The content needs significant improvement. Please revise and resubmit.'
    );
    expect(rejectedBook.status).toBe('DRAFT');

    // 4. Verify workflow includes rejection
    const workflow = await mockApiService.getBookWorkflow(createdBook.bookId);
    const rejectEntry = workflow.find(entry => entry.action === 'REJECT');
    expect(rejectEntry).toBeDefined();
    expect(rejectEntry?.comments).toContain('improvement');
  });

  it('should filter books by status correctly', async () => {
    // Test filtering by different statuses
    const draftBooks = await mockApiService.getBooks('DRAFT');
    const submittedBooks = await mockApiService.getBooks(
      'SUBMITTED_FOR_EDITING'
    );
    const readyBooks = await mockApiService.getBooks('READY_FOR_PUBLICATION');
    const publishedBooks = await mockApiService.getBooks('PUBLISHED');

    // Verify each filter returns books with correct status
    draftBooks.items.forEach(book => {
      expect(book.status).toBe('DRAFT');
    });

    submittedBooks.items.forEach(book => {
      expect(book.status).toBe('SUBMITTED_FOR_EDITING');
    });

    readyBooks.items.forEach(book => {
      expect(book.status).toBe('READY_FOR_PUBLICATION');
    });

    publishedBooks.items.forEach(book => {
      expect(book.status).toBe('PUBLISHED');
    });
  });

  it('should filter books by genre correctly', async () => {
    const fictionBooks = await mockApiService.getBooks(undefined, 'fiction');
    const mysteryBooks = await mockApiService.getBooks(undefined, 'mystery');

    fictionBooks.items.forEach(book => {
      expect(book.genre).toBe('fiction');
    });

    mysteryBooks.items.forEach(book => {
      expect(book.genre).toBe('mystery');
    });
  });

  it('should handle book reviews correctly', async () => {
    // Get a published book
    const publishedBooks = await mockApiService.getBooks('PUBLISHED');
    if (publishedBooks.items.length === 0) {
      // Create and publish a book for testing
      const bookData: CreateBookRequest = {
        title: 'Book for Review Testing',
        description: 'A book to test reviews',
        content: 'Great content for testing reviews.',
        genre: 'romance',
        tags: ['review', 'test'],
      };

      const book = await mockApiService.createBook(bookData);
      await mockApiService.submitBookForEditing(book.bookId);
      await mockApiService.approveBook(book.bookId);
      const publishedBook = await mockApiService.publishBook(book.bookId);

      // Create multiple reviews
      const review1 = await mockApiService.createReview({
        bookId: publishedBook.bookId,
        rating: 5,
        comment: 'Amazing book!',
      });

      const review2 = await mockApiService.createReview({
        bookId: publishedBook.bookId,
        rating: 4,
        comment: 'Very good, but could be better.',
      });

      // Get reviews for the book
      const reviews = await mockApiService.getBookReviews(publishedBook.bookId);
      expect(reviews.items.length).toBeGreaterThanOrEqual(2);

      const reviewIds = reviews.items.map(r => r.reviewId);
      expect(reviewIds).toContain(review1.reviewId);
      expect(reviewIds).toContain(review2.reviewId);
    }
  });

  it('should handle version conflicts correctly', async () => {
    // Create a book
    const bookData: CreateBookRequest = {
      title: 'Version Conflict Test',
      description: 'Testing version conflicts',
      content: 'Original content',
      genre: 'science-fiction',
      tags: ['version', 'conflict'],
    };

    const book = await mockApiService.createBook(bookData);

    // Try to update with wrong version
    try {
      await mockApiService.updateBook({
        bookId: book.bookId,
        version: 999, // Wrong version
        title: 'Updated Title',
      });
      expect.fail('Should have thrown version conflict error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Version conflict');
    }
  });
});

describe('Mock Users and Authentication', () => {
  it('should provide mock users for all roles', () => {
    const mockUsers = mockApiService.getMockUsers();

    expect(mockUsers.length).toBe(4);

    const roles = mockUsers.map(user => user.role);
    expect(roles).toContain('AUTHOR');
    expect(roles).toContain('EDITOR');
    expect(roles).toContain('PUBLISHER');
    expect(roles).toContain('READER');

    // Verify each user has required properties
    mockUsers.forEach(user => {
      expect(user.userId).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.firstName).toBeDefined();
      expect(user.lastName).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.isActive).toBe(true);
      expect(user.emailVerified).toBe(true);
    });
  });
});
