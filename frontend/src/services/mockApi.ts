// Mock API service for development and testing
import {
  Book,
  Review,
  CreateBookRequest,
  UpdateBookRequest,
  CreateReviewRequest,
  PaginatedResponse,
  WorkflowEntry,
  User,
} from '@/types';

// Mock data
const mockUsers: User[] = [
  {
    userId: 'author-1',
    email: 'author@example.com',
    firstName: 'John',
    lastName: 'Author',
    role: 'AUTHOR',
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    userId: 'editor-1',
    email: 'editor@example.com',
    firstName: 'Jane',
    lastName: 'Editor',
    role: 'EDITOR',
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    userId: 'publisher-1',
    email: 'publisher@example.com',
    firstName: 'Bob',
    lastName: 'Publisher',
    role: 'PUBLISHER',
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    userId: 'reader-1',
    email: 'reader@example.com',
    firstName: 'Alice',
    lastName: 'Reader',
    role: 'READER',
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockBooks: Book[] = [
  {
    bookId: 'book-1',
    authorId: 'author-1',
    title: 'The Great Adventure',
    description: 'An epic tale of courage and discovery.',
    content: 'Chapter 1: The Beginning\n\nIt was a dark and stormy night...',
    genre: 'fiction',
    status: 'DRAFT',
    tags: ['adventure', 'epic'],
    wordCount: 1250,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
  },
  {
    bookId: 'book-2',
    authorId: 'author-1',
    title: 'Mystery of the Lost Key',
    description: 'A thrilling mystery that will keep you guessing.',
    content:
      'Chapter 1: The Discovery\n\nThe old key was found in the attic...',
    genre: 'mystery',
    status: 'SUBMITTED_FOR_EDITING',
    tags: ['mystery', 'thriller'],
    wordCount: 2100,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    version: 1,
  },
  {
    bookId: 'book-3',
    authorId: 'author-1',
    title: 'Science and Wonder',
    description: 'Exploring the mysteries of the universe.',
    content: 'Chapter 1: The Cosmos\n\nIn the beginning, there was nothing...',
    genre: 'science-fiction',
    status: 'READY_FOR_PUBLICATION',
    tags: ['science', 'space'],
    wordCount: 3200,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    version: 2,
  },
  {
    bookId: 'book-4',
    authorId: 'author-1',
    title: 'Love in Paris',
    description: 'A romantic story set in the city of lights.',
    content: 'Chapter 1: The Meeting\n\nThe café was bustling with activity...',
    genre: 'romance',
    status: 'PUBLISHED',
    tags: ['romance', 'paris'],
    wordCount: 4500,
    publishedAt: '2024-01-04T00:00:00Z',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
    version: 3,
  },
];

let mockReviews: Review[] = [
  {
    reviewId: 'review-1',
    bookId: 'book-4',
    userId: 'reader-1',
    rating: 5,
    comment:
      'Absolutely loved this book! The characters were so well developed.',
    helpful: 12,
    reportCount: 0,
    isModerated: false,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
  },
  {
    reviewId: 'review-2',
    bookId: 'book-4',
    userId: 'reader-1',
    rating: 4,
    comment: 'Great story, though the pacing could be better in some parts.',
    helpful: 8,
    reportCount: 0,
    isModerated: false,
    createdAt: '2024-01-06T00:00:00Z',
    updatedAt: '2024-01-06T00:00:00Z',
  },
];

let mockWorkflow: WorkflowEntry[] = [
  {
    bookId: 'book-2',
    fromState: null,
    toState: 'DRAFT',
    actionBy: 'author-1',
    action: 'CREATE',
    timestamp: '2024-01-02T00:00:00Z',
  },
  {
    bookId: 'book-2',
    fromState: 'DRAFT',
    toState: 'SUBMITTED_FOR_EDITING',
    actionBy: 'author-1',
    action: 'SUBMIT',
    comments: 'Ready for editorial review',
    timestamp: '2024-01-02T12:00:00Z',
  },
];

// Utility functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getCurrentUser = (): User | null => {
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed.state?.user || null;
    }
  } catch (error) {
    console.error('Error getting current user:', error);
  }
  return null;
};

export class MockApiService {
  // Books API
  async getBooks(
    status?: Book['status'],
    genre?: Book['genre']
  ): Promise<PaginatedResponse<Book>> {
    await delay(500); // Simulate network delay

    let filteredBooks = [...mockBooks];

    if (status) {
      filteredBooks = filteredBooks.filter(book => book.status === status);
    }

    if (genre) {
      filteredBooks = filteredBooks.filter(book => book.genre === genre);
    }

    return {
      items: filteredBooks,
      totalCount: filteredBooks.length,
      hasMore: false,
    };
  }

  async getBook(bookId: string): Promise<Book> {
    await delay(300);

    const book = mockBooks.find(b => b.bookId === bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    return book;
  }

  async createBook(bookData: CreateBookRequest): Promise<Book> {
    await delay(800);

    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const newBook: Book = {
      bookId: `book-${Date.now()}`,
      authorId: currentUser.userId,
      ...bookData,
      status: 'DRAFT',
      wordCount: bookData.content.split(' ').length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    mockBooks.push(newBook);

    // Add workflow entry
    mockWorkflow.push({
      bookId: newBook.bookId,
      fromState: null,
      toState: 'DRAFT',
      actionBy: currentUser.userId,
      action: 'CREATE',
      timestamp: new Date().toISOString(),
    });

    return newBook;
  }

  async updateBook(bookData: UpdateBookRequest): Promise<Book> {
    await delay(600);

    const bookIndex = mockBooks.findIndex(b => b.bookId === bookData.bookId);
    if (bookIndex === -1) {
      throw new Error('Book not found');
    }

    const currentBook = mockBooks[bookIndex];
    if (!currentBook) {
      throw new Error('Book not found');
    }

    if (currentBook.version !== bookData.version) {
      throw new Error(
        'Version conflict - book has been modified by another user'
      );
    }

    const updatedBook: Book = {
      ...currentBook,
      title: bookData.title ?? currentBook.title,
      description: bookData.description ?? currentBook.description,
      content: bookData.content ?? currentBook.content,
      genre: bookData.genre ?? currentBook.genre,
      tags: bookData.tags ?? currentBook.tags,
      wordCount: bookData.content
        ? bookData.content.split(' ').length
        : currentBook.wordCount,
      updatedAt: new Date().toISOString(),
      version: currentBook.version + 1,
    };

    mockBooks[bookIndex] = updatedBook;
    return updatedBook;
  }

  async deleteBook(bookId: string): Promise<void> {
    await delay(400);

    const bookIndex = mockBooks.findIndex(b => b.bookId === bookId);
    if (bookIndex === -1) {
      throw new Error('Book not found');
    }

    mockBooks.splice(bookIndex, 1);

    // Remove related workflow entries
    mockWorkflow = mockWorkflow.filter(w => w.bookId !== bookId);

    // Remove related reviews
    mockReviews = mockReviews.filter(r => r.bookId !== bookId);
  }

  async submitBookForEditing(bookId: string): Promise<Book> {
    await delay(500);

    const book = await this.updateBookStatus(
      bookId,
      'SUBMITTED_FOR_EDITING',
      'SUBMIT'
    );
    return book;
  }

  async approveBook(bookId: string, comments?: string): Promise<Book> {
    await delay(600);

    const book = await this.updateBookStatus(
      bookId,
      'READY_FOR_PUBLICATION',
      'APPROVE',
      comments
    );
    return book;
  }

  async rejectBook(bookId: string, comments: string): Promise<Book> {
    await delay(500);

    const book = await this.updateBookStatus(
      bookId,
      'DRAFT',
      'REJECT',
      comments
    );
    return book;
  }

  async publishBook(bookId: string): Promise<Book> {
    await delay(700);

    await this.updateBookStatus(bookId, 'PUBLISHED', 'PUBLISH');

    // Set published date
    const bookIndex = mockBooks.findIndex(b => b.bookId === bookId);
    if (bookIndex !== -1 && mockBooks[bookIndex]) {
      mockBooks[bookIndex]!.publishedAt = new Date().toISOString();
    }

    const updatedBook = mockBooks[bookIndex];
    if (!updatedBook) {
      throw new Error('Book not found after publishing');
    }

    return updatedBook;
  }

  private async updateBookStatus(
    bookId: string,
    newStatus: Book['status'],
    action: WorkflowEntry['action'],
    comments?: string
  ): Promise<Book> {
    const bookIndex = mockBooks.findIndex(b => b.bookId === bookId);
    if (bookIndex === -1) {
      throw new Error('Book not found');
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const currentBook = mockBooks[bookIndex];
    if (!currentBook) {
      throw new Error('Book not found');
    }

    const updatedBook: Book = {
      ...currentBook,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      version: currentBook.version + 1,
    };

    mockBooks[bookIndex] = updatedBook;

    // Add workflow entry
    mockWorkflow.push({
      bookId,
      fromState: currentBook.status,
      toState: newStatus,
      actionBy: currentUser.userId,
      action,
      comments: comments || undefined,
      timestamp: new Date().toISOString(),
    });

    return updatedBook;
  }

  async getBookWorkflow(bookId: string): Promise<WorkflowEntry[]> {
    await delay(300);

    return mockWorkflow
      .filter(w => w.bookId === bookId)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }

  // Reviews API
  async getBookReviews(bookId: string): Promise<PaginatedResponse<Review>> {
    await delay(400);

    const reviews = mockReviews.filter(r => r.bookId === bookId);

    return {
      items: reviews,
      totalCount: reviews.length,
      hasMore: false,
    };
  }

  async createReview(reviewData: CreateReviewRequest): Promise<Review> {
    await delay(600);

    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const newReview: Review = {
      reviewId: `review-${Date.now()}`,
      userId: currentUser.userId,
      ...reviewData,
      helpful: 0,
      reportCount: 0,
      isModerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockReviews.push(newReview);
    return newReview;
  }

  async updateReview(
    reviewId: string,
    reviewData: Partial<CreateReviewRequest>
  ): Promise<Review> {
    await delay(500);

    const reviewIndex = mockReviews.findIndex(r => r.reviewId === reviewId);
    if (reviewIndex === -1) {
      throw new Error('Review not found');
    }

    const currentReview = mockReviews[reviewIndex];
    if (!currentReview) {
      throw new Error('Review not found');
    }

    const updatedReview: Review = {
      ...currentReview,
      rating: reviewData.rating ?? currentReview.rating,
      comment: reviewData.comment ?? currentReview.comment,
      updatedAt: new Date().toISOString(),
    };

    mockReviews[reviewIndex] = updatedReview;
    return updatedReview;
  }

  async deleteReview(reviewId: string): Promise<void> {
    await delay(400);

    const reviewIndex = mockReviews.findIndex(r => r.reviewId === reviewId);
    if (reviewIndex === -1) {
      throw new Error('Review not found');
    }

    mockReviews.splice(reviewIndex, 1);
  }

  // Mock user lookup for development - one user per role type
  getMockUsers(): User[] {
    // Return one representative user per role for clean testing
    return [
      {
        userId: 'author1-with-books',
        email: 'author1@example.com',
        firstName: 'Alice',
        lastName: 'Author',
        role: 'AUTHOR',
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        userId: 'editor-1',
        email: 'editor1@example.com',
        firstName: 'Carol',
        lastName: 'Editor',
        role: 'EDITOR',
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        userId: 'publisher-1',
        email: 'publisher1@example.com',
        firstName: 'David',
        lastName: 'Publisher',
        role: 'PUBLISHER',
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        userId: 'reader-1',
        email: 'reader1@example.com',
        firstName: 'Emma',
        lastName: 'Reader',
        role: 'READER',
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
  }
}

export const mockApiService = new MockApiService();
