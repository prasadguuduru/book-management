/**
 * Book Service Lambda Function Tests
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';
import { bookDAO } from '@/data/dao/book-dao';
import { accessControlService } from '@/data/validation/access-control';
import { Book, BookStatus, CreateBookRequest, UpdateBookRequest } from '@/types';

// Mock dependencies
jest.mock('@/data/dao/book-dao');
jest.mock('@/data/validation/access-control');
jest.mock('@/utils/logger');

const mockBookDAO = bookDAO as jest.Mocked<typeof bookDAO>;
const mockAccessControlService = accessControlService as jest.Mocked<typeof accessControlService>;

// Test data
const mockBook: Book = {
  bookId: 'book-123',
  authorId: 'author-123',
  title: 'Test Book',
  description: 'A test book',
  content: 'This is test content',
  genre: 'fiction',
  status: 'DRAFT',
  tags: ['test', 'fiction'],
  wordCount: 4,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  version: 1
};

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'book-service',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:book-service',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/book-service',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn()
};

const createMockEvent = (
  httpMethod: string,
  path: string,
  body?: any,
  pathParameters?: any,
  queryStringParameters?: any,
  authorizer?: any
): APIGatewayProxyEvent => ({
  httpMethod,
  path,
  body: body ? JSON.stringify(body) : null,
  pathParameters: pathParameters || null,
  queryStringParameters: queryStringParameters || null,
  headers: {},
  multiValueHeaders: {},
  isBase64Encoded: false,
  resource: '',
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    authorizer: authorizer !== null ? (authorizer || {
      userId: 'author-123',
      role: 'AUTHOR',
      email: 'author@test.com'
    }) : null,
    httpMethod,
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
      clientCert: null
    },
    path,
    protocol: 'HTTP/1.1',
    requestId: 'test-request',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: 1704067200,
    resourceId: 'test-resource',
    resourcePath: path,
    stage: 'test'
  },
  multiValueQueryStringParameters: null
});

describe('Book Service Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const event = createMockEvent('GET', '/health');
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        status: 'healthy',
        service: 'book-service'
      });
    });
  });

  describe('CORS Preflight', () => {
    it('should handle OPTIONS request', async () => {
      const event = createMockEvent('OPTIONS', '/books');
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.body).toBe('');
    });
  });

  describe('Create Book', () => {
    const createBookRequest: CreateBookRequest = {
      title: 'New Book',
      description: 'A new book',
      content: 'New book content',
      genre: 'fiction',
      tags: ['new', 'fiction']
    };

    it('should create book successfully for author', async () => {
      const event = createMockEvent('POST', '/books', createBookRequest);
      
      mockBookDAO.validateBookData.mockReturnValue([]);
      mockBookDAO.createBook.mockResolvedValue('book-123');
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(201);
      expect(mockBookDAO.createBook).toHaveBeenCalledWith('author-123', createBookRequest);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Book created successfully');
      expect(responseBody.book).toEqual(mockBook);
    });

    it('should reject book creation for non-author', async () => {
      const event = createMockEvent('POST', '/books', createBookRequest, null, null, {
        userId: 'reader-123',
        role: 'READER',
        email: 'reader@test.com'
      });
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.createBook).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('should return validation errors for invalid data', async () => {
      const event = createMockEvent('POST', '/books', createBookRequest);
      
      mockBookDAO.validateBookData.mockReturnValue(['Title is required']);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(400);
      expect(mockBookDAO.createBook).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('VALIDATION_FAILED');
      expect(responseBody.error.details).toEqual(['Title is required']);
    });
  });

  describe('Get Book', () => {
    it('should return book with permissions for authorized user', async () => {
      const event = createMockEvent('GET', '/books/book-123', null, { bookId: 'book-123' });
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockAccessControlService.canAccessBook.mockReturnValue(true);
      mockAccessControlService.canEditBook.mockReturnValue(true);
      mockAccessControlService.canDeleteBook.mockReturnValue(true);
      mockBookDAO.getValidTransitions.mockReturnValue(['SUBMITTED_FOR_EDITING']);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.getBookById).toHaveBeenCalledWith('book-123');
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.book).toEqual(mockBook);
      expect(responseBody.validTransitions).toEqual(['SUBMITTED_FOR_EDITING']);
      expect(responseBody.permissions.canEdit).toBe(true);
      expect(responseBody.permissions.canDelete).toBe(true);
    });

    it('should return 404 for non-existent book', async () => {
      const event = createMockEvent('GET', '/books/nonexistent', null, { bookId: 'nonexistent' });
      
      mockBookDAO.getBookById.mockResolvedValue(null);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(404);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for unauthorized access', async () => {
      const event = createMockEvent('GET', '/books/book-123', null, { bookId: 'book-123' });
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockAccessControlService.canAccessBook.mockReturnValue(false);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Update Book', () => {
    const updateRequest: UpdateBookRequest = {
      title: 'Updated Title',
      content: 'Updated content'
    };

    it('should update book successfully for authorized user', async () => {
      const event = createMockEvent('PUT', '/books/book-123', updateRequest, { bookId: 'book-123' });
      
      const updatedBook = { ...mockBook, title: 'Updated Title', version: 2 };
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockAccessControlService.canEditBook.mockReturnValue(true);
      mockBookDAO.validateBookData.mockReturnValue([]);
      mockBookDAO.updateBook.mockResolvedValue(updatedBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.updateBook).toHaveBeenCalledWith('book-123', updateRequest, 1, 'author-123');
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Book updated successfully');
      expect(responseBody.book).toEqual(updatedBook);
    });

    it('should return 403 for unauthorized edit', async () => {
      const event = createMockEvent('PUT', '/books/book-123', updateRequest, { bookId: 'book-123' });
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockAccessControlService.canEditBook.mockReturnValue(false);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.updateBook).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('should handle version conflicts', async () => {
      const event = createMockEvent('PUT', '/books/book-123', updateRequest, { bookId: 'book-123' });
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockAccessControlService.canEditBook.mockReturnValue(true);
      mockBookDAO.validateBookData.mockReturnValue([]);
      mockBookDAO.updateBook.mockRejectedValue(new Error('Book version mismatch - please refresh and try again'));
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(409);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('VERSION_CONFLICT');
    });
  });

  describe('Submit Book', () => {
    it('should submit book for editing successfully', async () => {
      const event = createMockEvent('POST', '/books/book-123/submit', null, { bookId: 'book-123' });
      
      const submittedBook = { ...mockBook, status: 'SUBMITTED_FOR_EDITING' as BookStatus, version: 2 };
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockBookDAO.canTransitionState.mockReturnValue(true);
      mockBookDAO.updateBookStatus.mockResolvedValue(submittedBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.updateBookStatus).toHaveBeenCalledWith(
        'book-123',
        'SUBMITTED_FOR_EDITING',
        'AUTHOR',
        'author-123',
        1
      );
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Book submitted for editing successfully');
      expect(responseBody.book).toEqual(submittedBook);
    });

    it('should reject submission by non-author', async () => {
      const event = createMockEvent('POST', '/books/book-123/submit', null, { bookId: 'book-123' }, null, {
        userId: 'editor-123',
        role: 'EDITOR',
        email: 'editor@test.com'
      });
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.updateBookStatus).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('should reject submission of non-owned book', async () => {
      const event = createMockEvent('POST', '/books/book-123/submit', null, { bookId: 'book-123' });
      
      const otherAuthorBook = { ...mockBook, authorId: 'other-author' };
      mockBookDAO.getBookById.mockResolvedValue(otherAuthorBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.updateBookStatus).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('should reject invalid state transition', async () => {
      const event = createMockEvent('POST', '/books/book-123/submit', null, { bookId: 'book-123' });
      
      const publishedBook = { ...mockBook, status: 'PUBLISHED' as BookStatus };
      mockBookDAO.getBookById.mockResolvedValue(publishedBook);
      mockBookDAO.canTransitionState.mockReturnValue(false);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(400);
      expect(mockBookDAO.updateBookStatus).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('Approve Book', () => {
    it('should approve book successfully by editor', async () => {
      const event = createMockEvent('POST', '/books/book-123/approve', null, { bookId: 'book-123' }, null, {
        userId: 'editor-123',
        role: 'EDITOR',
        email: 'editor@test.com'
      });
      
      const submittedBook = { ...mockBook, status: 'SUBMITTED_FOR_EDITING' as BookStatus };
      const approvedBook = { ...mockBook, status: 'READY_FOR_PUBLICATION' as BookStatus, version: 2 };
      
      mockBookDAO.getBookById.mockResolvedValue(submittedBook);
      mockBookDAO.canTransitionState.mockReturnValue(true);
      mockBookDAO.updateBookStatus.mockResolvedValue(approvedBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.updateBookStatus).toHaveBeenCalledWith(
        'book-123',
        'READY_FOR_PUBLICATION',
        'EDITOR',
        'editor-123',
        1
      );
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Book approved for publication successfully');
      expect(responseBody.book).toEqual(approvedBook);
    });

    it('should reject approval by non-editor', async () => {
      const event = createMockEvent('POST', '/books/book-123/approve', null, { bookId: 'book-123' });
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.updateBookStatus).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Reject Book', () => {
    it('should reject book successfully by editor', async () => {
      const event = createMockEvent('POST', '/books/book-123/reject', null, { bookId: 'book-123' }, null, {
        userId: 'editor-123',
        role: 'EDITOR',
        email: 'editor@test.com'
      });
      
      const submittedBook = { ...mockBook, status: 'SUBMITTED_FOR_EDITING' as BookStatus };
      const rejectedBook = { ...mockBook, status: 'DRAFT' as BookStatus, version: 2 };
      
      mockBookDAO.getBookById.mockResolvedValue(submittedBook);
      mockBookDAO.canTransitionState.mockReturnValue(true);
      mockBookDAO.updateBookStatus.mockResolvedValue(rejectedBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.updateBookStatus).toHaveBeenCalledWith(
        'book-123',
        'DRAFT',
        'EDITOR',
        'editor-123',
        1
      );
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Book rejected and returned to draft successfully');
      expect(responseBody.book).toEqual(rejectedBook);
    });

    it('should reject rejection by non-editor', async () => {
      const event = createMockEvent('POST', '/books/book-123/reject', null, { bookId: 'book-123' });
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.updateBookStatus).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Publish Book', () => {
    it('should publish book successfully by publisher', async () => {
      const event = createMockEvent('POST', '/books/book-123/publish', null, { bookId: 'book-123' }, null, {
        userId: 'publisher-123',
        role: 'PUBLISHER',
        email: 'publisher@test.com'
      });
      
      const readyBook = { ...mockBook, status: 'READY_FOR_PUBLICATION' as BookStatus };
      const publishedBook = { ...mockBook, status: 'PUBLISHED' as BookStatus, version: 2, publishedAt: '2024-01-01T00:00:00Z' };
      
      mockBookDAO.getBookById.mockResolvedValue(readyBook);
      mockBookDAO.canTransitionState.mockReturnValue(true);
      mockBookDAO.updateBookStatus.mockResolvedValue(publishedBook);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.updateBookStatus).toHaveBeenCalledWith(
        'book-123',
        'PUBLISHED',
        'PUBLISHER',
        'publisher-123',
        1
      );
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Book published successfully');
      expect(responseBody.book).toEqual(publishedBook);
    });

    it('should reject publication by non-publisher', async () => {
      const event = createMockEvent('POST', '/books/book-123/publish', null, { bookId: 'book-123' });
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.updateBookStatus).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Delete Book', () => {
    it('should delete draft book by author', async () => {
      const event = createMockEvent('DELETE', '/books/book-123', null, { bookId: 'book-123' });
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockAccessControlService.canDeleteBook.mockReturnValue(true);
      mockBookDAO.deleteBook.mockResolvedValue();
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.deleteBook).toHaveBeenCalledWith('book-123');
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.message).toBe('Book deleted successfully');
    });

    it('should reject deletion when not allowed', async () => {
      const event = createMockEvent('DELETE', '/books/book-123', null, { bookId: 'book-123' });
      
      mockBookDAO.getBookById.mockResolvedValue(mockBook);
      mockAccessControlService.canDeleteBook.mockReturnValue(false);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.deleteBook).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Get Books by Status', () => {
    it('should return filtered books by status', async () => {
      const event = createMockEvent('GET', '/books/status/published', null, null, { limit: '10' });
      
      const publishedBooks = [
        { ...mockBook, status: 'PUBLISHED' as BookStatus },
        { ...mockBook, bookId: 'book-456', status: 'PUBLISHED' as BookStatus }
      ];
      
      mockBookDAO.getBooksByStatus.mockResolvedValue({
        books: publishedBooks,
        hasMore: false,
        lastEvaluatedKey: undefined
      });
      mockAccessControlService.canAccessBook.mockReturnValue(true);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.getBooksByStatus).toHaveBeenCalledWith('PUBLISHED', 10, undefined);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.books).toHaveLength(2);
      expect(responseBody.hasMore).toBe(false);
    });

    it('should return 400 for invalid status', async () => {
      const event = createMockEvent('GET', '/books/status/invalid', null, null, { limit: '10' });
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(400);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('INVALID_STATUS');
    });
  });

  describe('Get My Books', () => {
    it('should return author\'s own books', async () => {
      const event = createMockEvent('GET', '/books/my-books', null, null, { limit: '10' });
      
      const authorBooks = [mockBook, { ...mockBook, bookId: 'book-456' }];
      
      mockBookDAO.getBooksByAuthor.mockResolvedValue({
        books: authorBooks,
        hasMore: false,
        lastEvaluatedKey: undefined
      });
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(mockBookDAO.getBooksByAuthor).toHaveBeenCalledWith(10, undefined);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.books).toHaveLength(2);
    });

    it('should reject non-author access to my-books', async () => {
      const event = createMockEvent('GET', '/books/my-books', null, null, { limit: '10' }, {
        userId: 'reader-123',
        role: 'READER',
        email: 'reader@test.com'
      });
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(403);
      expect(mockBookDAO.getBooksByAuthor).not.toHaveBeenCalled();
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing authorization', async () => {
      const event = createMockEvent('GET', '/books', null, null, null, null);
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(401);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle unknown endpoints', async () => {
      const event = createMockEvent('GET', '/unknown-endpoint');
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(404);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('NOT_FOUND');
    });

    it('should handle unexpected errors', async () => {
      const event = createMockEvent('GET', '/books/book-123', null, { bookId: 'book-123' });
      
      mockBookDAO.getBookById.mockRejectedValue(new Error('Database connection failed'));
      
      const result = await handler(event, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const responseBody = JSON.parse(result.body);
      expect(responseBody.error.code).toBe('RETRIEVAL_FAILED');
    });
  });
});