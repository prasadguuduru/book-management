// Integration tests for real API backend
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authService } from '@/services/authService';
import { apiService } from '@/services/api';

describe('API Integration Tests', () => {
  let authToken: string;
  let testBookId: string;

  beforeAll(async () => {
    // Test authentication with mock user
    try {
      const loginResponse = await authService.login({
        email: 'author@test.com',
        password: 'password123',
      });
      authToken = loginResponse.accessToken;
      expect(authToken).toBeDefined();
      expect(loginResponse.user).toBeDefined();
      expect(loginResponse.user.role).toBe('AUTHOR');
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  });

  describe('Authentication Service', () => {
    it('should login with valid credentials', async () => {
      const response = await authService.login({
        email: 'author@test.com',
        password: 'password123',
      });

      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe('author@test.com');
      expect(response.user.role).toBe('AUTHOR');
    });

    it('should fail login with invalid credentials', async () => {
      await expect(
        authService.login({
          email: 'invalid@test.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow();
    });

    it.skip('should register a new user', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;

      const response = await authService.register({
        email: uniqueEmail,
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'READER',
      });

      expect(response.accessToken).toBeDefined();
      expect(response.user.email).toBe(uniqueEmail);
      expect(response.user.role).toBe('READER');
    });
  });

  describe.skip('Book Service', () => {
    it('should create a new book', async () => {
      const bookData = {
        title: 'Test Book Integration',
        description: 'A test book for integration testing',
        content:
          'This is the content of the test book for integration testing.',
        genre: 'fiction' as const,
        tags: ['test', 'integration'],
      };

      const createdBook = await apiService.createBook(bookData);
      testBookId = createdBook.bookId;

      expect(createdBook.bookId).toBeDefined();
      expect(createdBook.title).toBe(bookData.title);
      expect(createdBook.status).toBe('DRAFT');
      expect(createdBook.authorId).toBeDefined();
    });

    it('should fetch books', async () => {
      const response = await apiService.getBooks();

      expect(response.items).toBeDefined();
      expect(Array.isArray(response.items)).toBe(true);
      expect(response.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should fetch a specific book', async () => {
      if (!testBookId) {
        throw new Error('Test book not created');
      }

      const book = await apiService.getBook(testBookId);

      expect(book.bookId).toBe(testBookId);
      expect(book.title).toBe('Test Book Integration');
    });

    it('should update a book', async () => {
      if (!testBookId) {
        throw new Error('Test book not created');
      }

      const book = await apiService.getBook(testBookId);
      const updatedBook = await apiService.updateBook({
        bookId: testBookId,
        title: 'Updated Test Book',
        description: book.description,
        content: book.content,
        genre: book.genre,
        tags: book.tags,
        version: book.version,
      });

      expect(updatedBook.title).toBe('Updated Test Book');
      expect(updatedBook.version).toBe(book.version + 1);
    });

    it('should submit book for editing', async () => {
      if (!testBookId) {
        throw new Error('Test book not created');
      }

      const submittedBook = await apiService.submitBookForEditing(testBookId);

      expect(submittedBook.status).toBe('SUBMITTED_FOR_EDITING');
    });

    it('should fetch book workflow', async () => {
      if (!testBookId) {
        throw new Error('Test book not created');
      }

      const workflow = await apiService.getBookWorkflow(testBookId);

      expect(Array.isArray(workflow)).toBe(true);
      expect(workflow.length).toBeGreaterThan(0);
      expect(workflow[0]?.action).toBe('CREATE');
    });
  });

  describe.skip('Review Service', () => {
    it('should handle reviews for published books', async () => {
      // First get published books
      const publishedBooks = await apiService.getBooks('PUBLISHED');

      if (publishedBooks.items.length > 0) {
        const bookId = publishedBooks.items[0]?.bookId;
        if (bookId) {
          const reviews = await apiService.getBookReviews(bookId);

          expect(reviews.items).toBeDefined();
          expect(Array.isArray(reviews.items)).toBe(true);
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up test book if created
    if (testBookId) {
      try {
        await apiService.deleteBook(testBookId);
      } catch (error) {
        console.warn('Failed to clean up test book:', error);
      }
    }
  });
});
