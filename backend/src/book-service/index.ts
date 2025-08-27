/**
 * Book Management Service Lambda Function
 * Handles CRUD operations and state machine transitions for books
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { bookDAO } from '@/data/dao/book-dao';
import { accessControlService } from '@/data/validation/access-control';
import { logger } from '@/utils/logger';
import { getCorsHeaders, createOptionsResponse } from '@/utils/cors';
import { 
  BookStatus, 
  UserRole, 
  CreateBookRequest, 
  UpdateBookRequest
} from '@/types';

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  
  logger.info('Book service request', {
    requestId,
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters
  });

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createOptionsResponse(event.headers?.['origin'] || event.headers?.['Origin']);
    }

    // Handle health check (no auth required)
    if (event.path === '/health' || event.path.endsWith('/health')) {
      return {
        statusCode: 200,
        headers: getCorsHeaders(event.headers?.['origin'] || event.headers?.['Origin']),
        body: JSON.stringify({
          status: 'healthy',
          service: 'book-service',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        })
      };
    }

    // Extract user context from authorizer
    const userContext = extractUserContext(event);
    if (!userContext) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'Authentication required', requestId);
    }

    // Route to appropriate handler
    const result = await routeRequest(event, userContext, requestId);
    
    return {
      statusCode: result.statusCode,
      headers: getCorsHeaders(event.headers?.['origin'] || event.headers?.['Origin']),
      body: JSON.stringify(result.body)
    };

  } catch (error) {
    logger.error('Unhandled error in book service', error instanceof Error ? error : new Error(String(error)));

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * Extract user context from API Gateway authorizer
 */
function extractUserContext(event: APIGatewayProxyEvent): {
  userId: string;
  role: UserRole;
  email: string;
} | null {
  try {
    const authContext = event.requestContext.authorizer;
    if (!authContext || !authContext['userId'] || !authContext['role']) {
      return null;
    }

    return {
      userId: authContext['userId'],
      role: authContext['role'] as UserRole,
      email: authContext['email'] || ''
    };
  } catch (error) {
    logger.error('Error extracting user context:', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Route request to appropriate handler
 */
async function routeRequest(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
  const { httpMethod, path, pathParameters } = event;
  const bookId = pathParameters?.['bookId'];



  // Route based on HTTP method and path
  switch (httpMethod) {
    case 'GET':
      if (bookId) {
        return await getBook(bookId, userContext, requestId);
      } else if (path.includes('/my-books')) {
        return await getMyBooks(event, userContext, requestId);
      } else if (path.includes('/status/')) {
        const status = extractStatusFromPath(path);
        return await getBooksByStatus(status, event, userContext, requestId);
      } else if (path.includes('/genre/')) {
        const genre = extractGenreFromPath(path);
        return await getBooksByGenre(genre, event, userContext, requestId);
      } else if (path.includes('/published')) {
        return await getPublishedBooks(event, userContext, requestId);
      } else if (path === '/books' || path.endsWith('/books')) {
        return await getAllBooks(event, userContext, requestId);
      }
      break;

    case 'POST':
      if (path.includes('/books') && !bookId) {
        return await createBook(event, userContext, requestId);
      } else if (bookId && path.includes('/submit')) {
        return await submitBook(bookId, userContext, requestId);
      } else if (bookId && path.includes('/approve')) {
        return await approveBook(bookId, event, userContext, requestId);
      } else if (bookId && path.includes('/reject')) {
        return await rejectBook(bookId, event, userContext, requestId);
      } else if (bookId && path.includes('/publish')) {
        return await publishBook(bookId, userContext, requestId);
      }
      break;

    case 'PUT':
    case 'PATCH':
      if (bookId) {
        return await updateBook(bookId, event, userContext, requestId);
      }
      break;

    case 'DELETE':
      if (bookId) {
        return await deleteBook(bookId, userContext, requestId);
      }
      break;
  }

  return {
    statusCode: 404,
    body: {
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint not found: ${httpMethod} ${path}`,
        timestamp: new Date().toISOString(),
        requestId
      }
    }
  };
}

/**
 * Create a new book (AUTHOR only)
 */
async function createBook(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
    logger.error('Error creating book', error instanceof Error ? error : new Error(String(error)));

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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
  return getBooksByStatus('PUBLISHED', event, userContext, requestId);
}

/**
 * Get user's own books (for authors)
 */
async function getMyBooks(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
  try {
    // Only authors can get their own books
    if (userContext.role !== 'AUTHOR') {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'FORBIDDEN',
            message: 'Only authors can access their own books',
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

    const result = await bookDAO.getBooksByAuthor(limit, lastEvaluatedKey);

    // Filter to only books by this author
    const myBooks = result.books.filter(book => book.authorId === userContext.userId);

    return {
      statusCode: 200,
      body: {
        books: myBooks,
        hasMore: result.hasMore,
        lastEvaluatedKey: result.lastEvaluatedKey,
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
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
  userContext: { userId: string; role: UserRole },
  requestId: string
): Promise<{ statusCode: number; body: any }> {
  try {
    const limit = parseInt(event.queryStringParameters?.['limit'] || '20');
    
    const result = await bookDAO.searchBooksByTitle(limit);

    // Filter books based on user role and permissions
    const filteredBooks = result.filter(book => 
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

/**
 * Helper functions
 */
function extractStatusFromPath(path: string): BookStatus | null {
  const match = path.match(/\/status\/([^\/]+)/);
  if (!match || !match[1]) return null;
  
  const status = match[1].toUpperCase().replace(/-/g, '_');
  return ['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'].includes(status) 
    ? status as BookStatus 
    : null;
}

function extractGenreFromPath(path: string): string | null {
  const match = path.match(/\/genre\/([^\/]+)/);
  return match && match[1] ? match[1] : null;
}

function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: getCorsHeaders(),
    body: JSON.stringify({
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        requestId
      }
    })
  };
}