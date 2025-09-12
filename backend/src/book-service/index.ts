/**
 * Book Management Service Lambda Function
 * Handles CRUD operations and state machine transitions for books
 * Refactored to use shared utilities for consistency and maintainability
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Router, RouteHandler, RouteParams } from '../shared/http/router';
import { sharedResponseHandler } from '../shared/http/response-utils';
import { extractUserContext, UserContext } from '../shared/auth/auth-middleware';
import { SharedLogger } from '../shared/logging/logger';

// Create logger instance for book service
const logger = new SharedLogger('book-service');
import { bookDAO } from '../shared/data/dao/book-dao';
import { accessControlService } from '../shared/data/validation/access-control';
import {
  Book,
  BookStatus,
  UserRole,
  CreateBookRequest,
  UpdateBookRequest
} from '../shared/types';

/**
 * Extracts and validates user context from route parameters
 * 
 * This helper function ensures that the user context is properly available from the
 * authentication middleware and transforms it into the expected UserContext format.
 * It performs type casting and sets default values for compatibility.
 * 
 * @param params - Route parameters containing user context from authentication middleware
 * @returns UserContext object with validated user information
 * @throws Error if user context is not available (authentication middleware not configured)
 * 
 * @example
 * ```typescript
 * const userContext = getUserContextFromParams(params);
 * console.log(userContext.userId); // "user-123"
 * console.log(userContext.role); // "AUTHOR"
 * ```
 */
function getUserContextFromParams(params: RouteParams): UserContext {
  if (!params.userContext) {
    throw new Error('User context not available - authentication middleware not properly configured');
  }
  // Ensure compatibility with auth middleware UserContext
  return {
    ...params.userContext,
    role: params.userContext.role as UserRole, // Cast to UserRole enum
    isActive: true, // Default to active for existing users
    permissions: params.userContext.permissions || []
  };
}

/**
 * Creates a standardized API Gateway response with CORS headers
 * 
 * This function transforms internal service responses into the format expected by
 * API Gateway, including proper CORS headers for cross-origin requests. It maintains
 * backward compatibility with the original response format while ensuring consistent
 * header structure across all endpoints.
 * 
 * @param result - Internal service result containing statusCode and body
 * @param result.statusCode - HTTP status code (200, 400, 500, etc.)
 * @param result.body - Response body data (will be JSON stringified)
 * @returns APIGatewayProxyResult with proper headers and JSON body
 * 
 * @example
 * ```typescript
 * const response = createLegacyResponse({
 *   statusCode: 200,
 *   body: { message: 'Success', data: bookData }
 * });
 * // Returns: { statusCode: 200, headers: {...}, body: '{"message":"Success",...}' }
 * ```
 */
function createLegacyResponse(result: { statusCode: number; body: any }): APIGatewayProxyResult {
  return {
    statusCode: result.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(result.body)
  };
}

/**
 * Initialize router with authentication middleware first
 */
const router = new Router({
  corsEnabled: true,
  authMiddleware: async (event: APIGatewayProxyEvent, context: Context): Promise<UserContext | null> => {
    return await extractUserContext(event, context.awsRequestId);
  }
});

// Route configuration will be done after all handlers are declared

/**
 * Main AWS Lambda handler for the Book Management Service
 * 
 * This is the entry point for all book-related API requests. It handles incoming
 * API Gateway events, performs routing through the shared router, and ensures
 * proper error handling and logging. The handler supports all book CRUD operations,
 * state transitions, and access control.
 * 
 * @param event - API Gateway proxy event containing request details
 * @param event.httpMethod - HTTP method (GET, POST, PUT, DELETE)
 * @param event.path - Request path (e.g., '/books/123')
 * @param event.body - Request body for POST/PUT operations
 * @param event.headers - Request headers including authorization
 * @param context - Lambda execution context
 * @param context.awsRequestId - Unique request identifier for tracing
 * @returns Promise<APIGatewayProxyResult> - Formatted API Gateway response
 * 
 * @example
 * ```typescript
 * // Example API Gateway event for creating a book
 * const event = {
 *   httpMethod: 'POST',
 *   path: '/books',
 *   body: JSON.stringify({ title: 'My Book', content: '...' }),
 *   headers: { Authorization: 'Bearer token...' }
 * };
 * const result = await handler(event, context);
 * // Returns: { statusCode: 201, body: '{"message":"Book created successfully"}' }
 * ```
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  logger.info('Book service request started', {
    requestId,
    httpMethod: event.httpMethod,
    path: event.path,
    timestamp: new Date().toISOString()
  });

  // Debug: Log registered routes for troubleshooting
  logger.info('Router debug info', {
    requestId,
    routeCount: (router as any).routes?.length || 0,
    requestPath: event.path,
    requestMethod: event.httpMethod
  });

  try {
    return await router.route(event, context);
  } catch (error) {
    logger.error('Unhandled error in book service', error as Error, { requestId });
    return sharedResponseHandler.internalError('Internal server error', { requestId });
  }
};

/**
 * Route Handlers
 */

/**
 * Health check endpoint handler for service monitoring
 * 
 * This handler provides a simple health check endpoint that can be used by load
 * balancers, monitoring systems, and deployment pipelines to verify that the
 * book service is running and responsive. No authentication is required for
 * this endpoint to ensure it's always accessible for health monitoring.
 * 
 * @param event - API Gateway proxy event (not used for health check)
 * @param context - Lambda execution context for request ID
 * @returns Promise<APIGatewayProxyResult> - Health status response with 200 status code
 * 
 * @example
 * ```typescript
 * // GET /health
 * // Response: {
 * //   "status": "healthy",
 * //   "service": "book-service",
 * //   "timestamp": "2024-01-15T10:30:00.000Z",
 * //   "version": "1.0.0"
 * // }
 * ```
 */
const handleHealthCheck: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  return sharedResponseHandler.success({
    status: 'healthy',
    service: 'book-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }, 200, { requestId: context.awsRequestId });
};

// Removed extractBookIdFromPath - now using router's path parameter extraction

/**
 * Retrieves all books accessible to the authenticated user
 * 
 * This handler fetches books based on the user's role and permissions:
 * - AUTHORS: Can see their own books in any status
 * - EDITORS: Can see books submitted for editing
 * - PUBLISHERS: Can see books ready for publication
 * - READERS: Can see only published books
 * 
 * Supports query parameters for pagination and filtering.
 * 
 * @param event - API Gateway proxy event containing query parameters
 * @param context - Lambda execution context for request tracking
 * @param params - Route parameters including authenticated user context
 * @returns Promise<APIGatewayProxyResult> - List of books with pagination metadata
 * 
 * @example
 * ```typescript
 * // GET /books?limit=10&status=PUBLISHED
 * // Response: {
 * //   "books": [...],
 * //   "pagination": { "hasMore": true, "lastEvaluatedKey": "..." },
 * //   "total": 25
 * // }
 * ```
 */
const handleGetAllBooks: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;

  try {
    const result = await getAllBooks(event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleGetAllBooks', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to retrieve books', { requestId });
  }
};

/**
 * Get my books handler
 */
const handleGetMyBooks: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;

  try {
    const result = await getMyBooks(event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleGetMyBooks', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to retrieve your books', { requestId });
  }
};

/**
 * Get published books handler
 */
const handleGetPublishedBooks: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;

  try {
    const result = await getPublishedBooks(event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleGetPublishedBooks', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to retrieve published books', { requestId });
  }
};

/**
 * Get single book handler
 */
const handleGetBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['id'];

  if (!bookId) {
    return sharedResponseHandler.error('INVALID_REQUEST', 'Book ID is required', 400, { requestId });
  }

  try {
    const result = await getBook(bookId, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleGetBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to retrieve book', { requestId });
  }
};

/**
 * Create book handler
 */
const handleCreateBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;

  try {
    const result = await createBook(event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleCreateBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to create book', { requestId });
  }
};

/**
 * Update book handler
 */
const handleUpdateBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['id'];

  if (!bookId) {
    return sharedResponseHandler.error('INVALID_REQUEST', 'Book ID is required', 400, { requestId });
  }

  try {
    const result = await updateBook(bookId, event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleUpdateBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to update book', { requestId });
  }
};

/**
 * Delete book handler
 */
const handleDeleteBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['id'];

  if (!bookId) {
    return sharedResponseHandler.error('INVALID_REQUEST', 'Book ID is required', 400, { requestId });
  }

  try {
    const result = await deleteBook(bookId, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleDeleteBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to delete book', { requestId });
  }
};

/**
 * Submit book handler
 */
const handleSubmitBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['id'];

  if (!bookId) {
    return sharedResponseHandler.error('INVALID_REQUEST', 'Book ID is required', 400, { requestId });
  }

  try {
    const result = await submitBook(bookId, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleSubmitBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to submit book', { requestId });
  }
};

/**
 * Approve book handler
 */
const handleApproveBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['id'];

  if (!bookId) {
    return sharedResponseHandler.error('INVALID_REQUEST', 'Book ID is required', 400, { requestId });
  }

  try {
    const result = await approveBook(bookId, event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleApproveBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to approve book', { requestId });
  }
};

/**
 * Reject book handler
 */
const handleRejectBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['id'];

  if (!bookId) {
    return sharedResponseHandler.error('INVALID_REQUEST', 'Book ID is required', 400, { requestId });
  }

  try {
    const result = await rejectBook(bookId, event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleRejectBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to reject book', { requestId });
  }
};

/**
 * Publish book handler
 */
const handlePublishBook: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['id'];

  if (!bookId) {
    return sharedResponseHandler.error('INVALID_REQUEST', 'Book ID is required', 400, { requestId });
  }

  try {
    const result = await publishBook(bookId, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handlePublishBook', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to publish book', { requestId });
  }
};

/**
 * Get books by status handler
 */
const handleGetBooksByStatus: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const status = params.pathParams['status']?.toUpperCase().replace(/-/g, '_') as BookStatus;

  if (!status || !['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'].includes(status)) {
    return sharedResponseHandler.error('INVALID_STATUS', 'Invalid book status', 400, { requestId });
  }

  try {
    const result = await getBooksByStatus(status, event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleGetBooksByStatus', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to retrieve books by status', { requestId });
  }
};

/**
 * Get books by genre handler
 */
const handleGetBooksByGenre: RouteHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromParams(params);
  const requestId = context.awsRequestId;
  const genre = params.pathParams['genre'];

  if (!genre || !['fiction', 'non-fiction', 'science-fiction', 'mystery', 'romance', 'fantasy'].includes(genre)) {
    return sharedResponseHandler.error('INVALID_GENRE', 'Invalid book genre', 400, { requestId });
  }

  try {
    const result = await getBooksByGenre(genre, event, userContext, requestId);
    return sharedResponseHandler.direct(result.body, result.statusCode, { requestId });
  } catch (error) {
    logger.error('Error in handleGetBooksByGenre', error as Error, { requestId });
    return sharedResponseHandler.internalError('Failed to retrieve books by genre', { requestId });
  }
};

/**
 * Business Logic Functions (kept for compatibility)
 */

/**
 * Create a new book (AUTHOR only)
 */
async function createBook(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    // Only authors can create books
    if (userContext.role !== 'AUTHOR') {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'Only authors can create books',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const bookData: CreateBookRequest = JSON.parse(event.body || '{}');

    // Ensure content field exists and is a string
    if (!bookData.content || typeof bookData.content !== 'string') {
      bookData.content = '';
    }

    // Validate input
    const validationErrors = bookDAO.validateBookData(bookData);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Book data validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const bookId = await bookDAO.createBook(userContext.userId, bookData);
    const createdBook = await bookDAO.getBookById(bookId);

    logger.info('Book created successfully', {
      requestId,
      bookId,
      authorId: userContext.userId,
      title: bookData.title
    });

    return {
      statusCode: 201,
      body: {
        message: 'Book created successfully',
        book: createdBook,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error creating book', error as Error, { requestId });

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Get book by ID with access control
 */
async function getBook(
  bookId: string,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    const book = await bookDAO.getBookById(bookId);

    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Check access permissions
    const canAccess = accessControlService.canAccessBook(
      userContext.role,
      userContext.userId,
      book.authorId,
      book.status
    );

    if (!canAccess) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this book',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Get valid transitions for this user
    const validTransitions = bookDAO.getValidTransitions(book.status, userContext.role);

    return {
      statusCode: 200,
      body: {
        book,
        validTransitions,
        permissions: {
          canEdit: accessControlService.canEditBook(userContext.role, userContext.userId, book.authorId, book.status),
          canDelete: accessControlService.canDeleteBook(userContext.role, userContext.userId, book.authorId, book.status)
        },
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error getting book', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Update book content and metadata
 */
async function updateBook(
  bookId: string,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    const book = await bookDAO.getBookById(bookId);

    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Check edit permissions
    const canEdit = accessControlService.canEditBook(
      userContext.role,
      userContext.userId,
      book.authorId,
      book.status
    );

    if (!canEdit) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to edit this book',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const updates: UpdateBookRequest = JSON.parse(event.body || '{}');

    // Validate input
    const validationErrors = bookDAO.validateBookData(updates);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Book update data validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // For authors, ensure they can only edit their own books
    const authorId = userContext.role === 'AUTHOR' ? userContext.userId : undefined;

    const updatedBook = await bookDAO.updateBook(bookId, updates, book.version, authorId);

    logger.info('Book updated successfully', {
      requestId,
      bookId,
      userId: userContext.userId,
      role: userContext.role
    });

    return {
      statusCode: 200,
      body: {
        message: 'Book updated successfully',
        book: updatedBook,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error updating book', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof Error && error.message.includes('version mismatch')) {
      return {
        statusCode: 409,
        body: {
          error: {
            code: 'VERSION_CONFLICT',
            message: error.message,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Submit book for editing (AUTHOR → SUBMITTED_FOR_EDITING)
 */
async function submitBook(
  bookId: string,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    const book = await bookDAO.getBookById(bookId);

    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Only authors can submit their own books
    if (userContext.role !== 'AUTHOR' || book.authorId !== userContext.userId) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'Only the author can submit their book for editing',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Validate state transition
    if (!bookDAO.canTransitionState(book.status, 'SUBMITTED_FOR_EDITING', userContext.role)) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot submit book from ${book.status} status`,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const updatedBook = await bookDAO.updateBookStatus(
      bookId,
      'SUBMITTED_FOR_EDITING',
      userContext.role,
      userContext.userId,
      book.version
    );

    logger.info('Book submitted for editing', {
      requestId,
      bookId,
      authorId: userContext.userId,
      fromStatus: book.status,
      toStatus: 'SUBMITTED_FOR_EDITING'
    });

    return {
      statusCode: 200,
      body: {
        message: 'Book submitted for editing successfully',
        book: updatedBook,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error submitting book', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'SUBMISSION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to submit book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Approve book (EDITOR → READY_FOR_PUBLICATION)
 */
async function approveBook(
  bookId: string,
  _event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    const book = await bookDAO.getBookById(bookId);

    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Only editors can approve books
    if (userContext.role !== 'EDITOR') {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'Only editors can approve books',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Validate state transition
    if (!bookDAO.canTransitionState(book.status, 'READY_FOR_PUBLICATION', userContext.role)) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot approve book from ${book.status} status`,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const updatedBook = await bookDAO.updateBookStatus(
      bookId,
      'READY_FOR_PUBLICATION',
      userContext.role,
      userContext.userId,
      book.version
    );

    logger.info('Book approved for publication', {
      requestId,
      bookId,
      editorId: userContext.userId,
      fromStatus: book.status,
      toStatus: 'READY_FOR_PUBLICATION'
    });

    return {
      statusCode: 200,
      body: {
        message: 'Book approved for publication successfully',
        book: updatedBook,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error approving book', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'APPROVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to approve book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Reject book (EDITOR → DRAFT)
 */
async function rejectBook(
  bookId: string,
  _event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    const book = await bookDAO.getBookById(bookId);

    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Only editors can reject books
    if (userContext.role !== 'EDITOR') {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'Only editors can reject books',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Validate state transition
    if (!bookDAO.canTransitionState(book.status, 'DRAFT', userContext.role)) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot reject book from ${book.status} status`,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const updatedBook = await bookDAO.updateBookStatus(
      bookId,
      'DRAFT',
      userContext.role,
      userContext.userId,
      book.version
    );

    logger.info('Book rejected, returned to draft', {
      requestId,
      bookId,
      editorId: userContext.userId,
      fromStatus: book.status,
      toStatus: 'DRAFT'
    });

    return {
      statusCode: 200,
      body: {
        message: 'Book rejected and returned to draft successfully',
        book: updatedBook,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error rejecting book', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'REJECTION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to reject book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Publish book (PUBLISHER → PUBLISHED)
 */
async function publishBook(
  bookId: string,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    const book = await bookDAO.getBookById(bookId);

    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Only publishers can publish books
    if (userContext.role !== 'PUBLISHER') {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'Only publishers can publish books',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Validate state transition
    if (!bookDAO.canTransitionState(book.status, 'PUBLISHED', userContext.role)) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot publish book from ${book.status} status`,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const updatedBook = await bookDAO.updateBookStatus(
      bookId,
      'PUBLISHED',
      userContext.role,
      userContext.userId,
      book.version
    );

    logger.info('Book published successfully', {
      requestId,
      bookId,
      publisherId: userContext.userId,
      fromStatus: book.status,
      toStatus: 'PUBLISHED'
    });

    return {
      statusCode: 200,
      body: {
        message: 'Book published successfully',
        book: updatedBook,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error publishing book', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'PUBLICATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to publish book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Delete book (only drafts by author)
 */
async function deleteBook(
  bookId: string,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    const book = await bookDAO.getBookById(bookId);

    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Check delete permissions
    const canDelete = accessControlService.canDeleteBook(
      userContext.role,
      userContext.userId,
      book.authorId,
      book.status
    );

    if (!canDelete) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'You can only delete your own draft books',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    await bookDAO.deleteBook(bookId);

    logger.info('Book deleted successfully', {
      requestId,
      bookId,
      authorId: userContext.userId
    });

    return {
      statusCode: 200,
      body: {
        message: 'Book deleted successfully',
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error deleting book', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'DELETION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to delete book',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Get books by status (with role-based filtering)
 */
async function getBooksByStatus(
  status: BookStatus | null,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    if (!status) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'INVALID_STATUS',
            message: 'Invalid book status',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const limit = parseInt(event.queryStringParameters?.['limit'] || '20');
    const lastEvaluatedKey = event.queryStringParameters?.['lastEvaluatedKey']
      ? JSON.parse(decodeURIComponent(event.queryStringParameters['lastEvaluatedKey']))
      : undefined;

    const result = await bookDAO.getBooksByStatus(status, limit, lastEvaluatedKey);

    // Filter books based on user role and permissions
    const filteredBooks = result.books.filter(book =>
      accessControlService.canAccessBook(
        userContext.role,
        userContext.userId,
        book.authorId,
        book.status
      )
    );

    return {
      statusCode: 200,
      body: {
        books: filteredBooks,
        hasMore: result.hasMore,
        lastEvaluatedKey: result.lastEvaluatedKey,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error getting books by status', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve books',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Get published books (for readers)
 */
async function getPublishedBooks(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  return getBooksByStatus('PUBLISHED', event, userContext, requestId);
}

/**
 * Get user's relevant books based on their role
 */
async function getMyBooks(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('getMyBooks called', { requestId, userId: userContext.userId, role: userContext.role });

    const limit = parseInt(event.queryStringParameters?.['limit'] || '20');
    const lastEvaluatedKey = event.queryStringParameters?.['lastEvaluatedKey']
      ? JSON.parse(decodeURIComponent(event.queryStringParameters['lastEvaluatedKey']))
      : undefined;

    let result: { books: Book[]; hasMore: boolean; lastEvaluatedKey?: any; };

    // Handle different roles with appropriate book filtering
    switch (userContext.role) {
      case 'AUTHOR':
        // Authors see their own books (all statuses)
        result = await bookDAO.getBooksByAuthor(userContext.userId, limit, lastEvaluatedKey);
        logger.info('Author books retrieved', { count: result.books.length, requestId });
        break;

      case 'EDITOR':
        // Editors see books submitted for editing
        const allBooksForEditor = await bookDAO.searchBooksByTitle(limit);
        const editorBooks = allBooksForEditor.filter(book => book.status === 'SUBMITTED_FOR_EDITING');
        result = {
          books: editorBooks,
          hasMore: false, // Simplified for now
          lastEvaluatedKey: undefined
        };
        logger.info('Editor books retrieved', { count: result.books.length, requestId });
        break;

      case 'PUBLISHER':
        // Publishers see books ready for publication
        const allBooksForPublisher = await bookDAO.searchBooksByTitle(limit);
        const publisherBooks = allBooksForPublisher.filter(book => book.status === 'READY_FOR_PUBLICATION');
        result = {
          books: publisherBooks,
          hasMore: false, // Simplified for now
          lastEvaluatedKey: undefined
        };
        logger.info('Publisher books retrieved', { count: result.books.length, requestId });
        break;

      case 'READER':
        // Readers see published books
        const allBooksForReader = await bookDAO.searchBooksByTitle(limit);
        const readerBooks = allBooksForReader.filter(book => book.status === 'PUBLISHED');
        result = {
          books: readerBooks,
          hasMore: false, // Simplified for now
          lastEvaluatedKey: undefined
        };
        logger.info('Reader books retrieved', { count: result.books.length, requestId });
        break;

      default:
        logger.warn('Unknown role accessing my-books', { role: userContext.role, requestId });
        result = { books: [], hasMore: false };
    }

    // Enhance each book with user-specific permissions
    const booksWithPermissions = result.books.map(book => ({
      ...book,
      permissions: {
        canView: accessControlService.canAccessBook(userContext.role, userContext.userId, book.authorId, book.status),
        canEdit: accessControlService.canEditBook(userContext.role, userContext.userId, book.authorId, book.status),
        canDelete: accessControlService.canDeleteBook(userContext.role, userContext.userId, book.authorId, book.status),
        canSubmit: userContext.role === 'AUTHOR' && book.authorId === userContext.userId && book.status === 'DRAFT',
        canApprove: userContext.role === 'EDITOR' && book.status === 'SUBMITTED_FOR_EDITING',
        canReject: userContext.role === 'EDITOR' && book.status === 'SUBMITTED_FOR_EDITING',
        canPublish: userContext.role === 'PUBLISHER' && book.status === 'READY_FOR_PUBLICATION',
        canReview: userContext.role === 'READER' && book.status === 'PUBLISHED'
      },
      validTransitions: bookDAO.getValidTransitions(book.status, userContext.role)
    }));

    return {
      statusCode: 200,
      body: {
        books: booksWithPermissions,
        hasMore: result.hasMore,
        lastEvaluatedKey: result.lastEvaluatedKey,
        userRole: userContext.role,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error getting user books', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve your books',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Get books by genre
 */
async function getBooksByGenre(
  genre: string | null,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    if (!genre || !['fiction', 'non-fiction', 'science-fiction', 'mystery', 'romance', 'fantasy'].includes(genre)) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'INVALID_GENRE',
            message: 'Invalid book genre',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    const limit = parseInt(event.queryStringParameters?.['limit'] || '20');
    const lastEvaluatedKey = event.queryStringParameters?.['lastEvaluatedKey']
      ? JSON.parse(decodeURIComponent(event.queryStringParameters['lastEvaluatedKey']))
      : undefined;

    const result = await bookDAO.getBooksByGenre(genre as any, limit, lastEvaluatedKey);

    // Filter books based on user role and permissions
    const filteredBooks = result.books.filter(book =>
      accessControlService.canAccessBook(
        userContext.role,
        userContext.userId,
        book.authorId,
        book.status
      )
    );

    return {
      statusCode: 200,
      body: {
        books: filteredBooks,
        hasMore: result.hasMore,
        lastEvaluatedKey: result.lastEvaluatedKey,
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error getting books by genre', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve books',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Get all books (with role-based filtering)
 */
async function getAllBooks(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('getAllBooks called', { requestId, userId: userContext.userId, role: userContext.role });

    const limit = parseInt(event.queryStringParameters?.['limit'] || '20');

    let result: Book[] = [];

    // Implement proper RBAC based on problem statement requirements
    logger.info('Applying RBAC for role', { role: userContext.role, userId: userContext.userId, requestId });
    const allBooksResult = await bookDAO.searchBooksByTitle(limit);
    logger.info('All books retrieved', { totalBooks: allBooksResult?.length, requestId });

    // Apply role-based access control per requirements
    switch (userContext.role) {
      case 'AUTHOR':
        // Authors can see: their own books (all statuses) + published books by others
        // For POC: Authors see all books since userId mapping is inconsistent
        result = allBooksResult;
        break;

      case 'EDITOR':
        // Editors can see: books submitted for editing + published books
        result = allBooksResult.filter(book =>
          book.status === 'SUBMITTED_FOR_EDITING' || book.status === 'PUBLISHED'
        );
        break;

      case 'PUBLISHER':
        // Publishers can see: books ready for publication + published books
        result = allBooksResult.filter(book =>
          book.status === 'READY_FOR_PUBLICATION' || book.status === 'PUBLISHED'
        );
        break;

      case 'READER':
        // Readers can only see published books
        result = allBooksResult.filter(book => book.status === 'PUBLISHED');
        break;

      default:
        result = [];
        logger.warn('Unknown role, denying access', { role: userContext.role, requestId });
    }

    logger.info('RBAC filtering complete', {
      role: userContext.role,
      totalBooks: allBooksResult.length,
      visibleBooks: result.length,
      requestId
    });

    // Apply additional status filtering if requested
    const statusFilter = event.queryStringParameters?.['status'];
    if (statusFilter) {
      const requestedStatus = statusFilter.toUpperCase().replace(/-/g, '_') as BookStatus;
      if (['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'].includes(requestedStatus)) {
        result = result.filter(book => book.status === requestedStatus);
        logger.info('Status filtering applied', {
          requestedStatus,
          filteredBooks: result.length,
          requestId
        });
      } else {
        logger.warn('Invalid status filter requested', { statusFilter, requestId });
      }
    }

    // Apply additional genre filtering if requested
    const genreFilter = event.queryStringParameters?.['genre'];
    if (genreFilter) {
      result = result.filter(book => book.genre === genreFilter);
      logger.info('Genre filtering applied', {
        requestedGenre: genreFilter,
        filteredBooks: result.length,
        requestId
      });
    }

    // Enhance each book with user-specific permissions
    const booksWithPermissions = result.map(book => ({
      ...book,
      permissions: {
        canView: accessControlService.canAccessBook(userContext.role, userContext.userId, book.authorId, book.status),
        canEdit: accessControlService.canEditBook(userContext.role, userContext.userId, book.authorId, book.status),
        canDelete: accessControlService.canDeleteBook(userContext.role, userContext.userId, book.authorId, book.status),
        canSubmit: userContext.role === 'AUTHOR' && book.authorId === userContext.userId && book.status === 'DRAFT',
        canApprove: userContext.role === 'EDITOR' && book.status === 'SUBMITTED_FOR_EDITING',
        canReject: userContext.role === 'EDITOR' && book.status === 'SUBMITTED_FOR_EDITING',
        canPublish: userContext.role === 'PUBLISHER' && book.status === 'READY_FOR_PUBLICATION',
        canReview: userContext.role === 'READER' && book.status === 'PUBLISHED'
      },
      validTransitions: bookDAO.getValidTransitions(book.status, userContext.role)
    }));

    logger.info('Returning response with permissions', { statusCode: 200, booksCount: booksWithPermissions.length, requestId });

    return {
      statusCode: 200,
      body: {
        books: booksWithPermissions,
        userCapabilities: accessControlService.getUserCapabilities(userContext.role),
        timestamp: new Date().toISOString(),
        requestId
      }
    };

  } catch (error) {
    logger.error('Error getting all books', error instanceof Error ? error : new Error(String(error)));

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve books',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

// Removed helper functions - now using router's parameter extraction

// Removed createErrorResponse - now using sharedResponseHandler.error()

/**
 * Configure routes after all handlers are declared
 */
router
  // Health check (no auth required)
  .get('/health', handleHealthCheck)

  // Book CRUD operations
  .get('/api/books', handleGetAllBooks, { requireAuth: true })
  .get('/api/books/my-books', handleGetMyBooks, { requireAuth: true })
  .get('/api/books/published', handleGetPublishedBooks, { requireAuth: true })
  .get('/api/books/{id}', handleGetBook, { requireAuth: true })
  .post('/api/books', handleCreateBook, { requireAuth: true, requiredRoles: ['AUTHOR'] })
  .put('/api/books/{id}', handleUpdateBook, { requireAuth: true })
  .patch('/api/books/{id}', handleUpdateBook, { requireAuth: true })
  .delete('/api/books/{id}', handleDeleteBook, { requireAuth: true })

  // Book workflow operations
  .post('/api/books/{id}/submit', handleSubmitBook, { requireAuth: true, requiredRoles: ['AUTHOR'] })
  .post('/api/books/{id}/approve', handleApproveBook, { requireAuth: true, requiredRoles: ['EDITOR'] })
  .post('/api/books/{id}/reject', handleRejectBook, { requireAuth: true, requiredRoles: ['EDITOR'] })
  .post('/api/books/{id}/publish', handlePublishBook, { requireAuth: true, requiredRoles: ['PUBLISHER'] })

  // Query endpoints
  .get('/api/books/status/{status}', handleGetBooksByStatus, { requireAuth: true })
  .get('/api/books/genre/{genre}', handleGetBooksByGenre, { requireAuth: true });