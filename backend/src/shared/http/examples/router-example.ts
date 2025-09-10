/**
 * Example usage of the Router utility
 * 
 * This demonstrates how to use the Router class to create a Lambda function
 * with consistent routing, authentication, and middleware support.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Router, routerUtils, RouteParams } from '../router';
import { sharedResponseHandler } from '../response-utils';

// Example: Create a router with authentication and logging
const router = new Router({
  corsEnabled: true,
  authMiddleware: routerUtils.createAuthMiddleware(),
  globalMiddleware: [
    routerUtils.createLoggingMiddleware()
  ]
});

// Example: Simple validation function
const validateBookData = (data: unknown) => {
  const book = data as any;
  const errors: string[] = [];
  
  if (!book.title || typeof book.title !== 'string') {
    errors.push('Title is required and must be a string');
  }
  
  if (!book.author || typeof book.author !== 'string') {
    errors.push('Author is required and must be a string');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    data: book
  } as { valid: boolean; errors?: string[]; data?: any };
};

// Example: Add validation middleware for POST/PUT requests
const validationMiddleware = routerUtils.createValidationMiddleware(validateBookData);

// Example: Define route handlers
const getBooks = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const { queryParams, userContext } = params;
  
  // Example: Use query parameters for filtering
  const limit = parseInt(queryParams['limit'] || '10');
  const offset = parseInt(queryParams['offset'] || '0');
  
  // Example: Access user context for authorization
  console.log('User requesting books:', userContext?.userId);
  
  // Mock response
  const books = [
    { id: '1', title: 'Example Book 1', author: 'Author 1' },
    { id: '2', title: 'Example Book 2', author: 'Author 2' }
  ];
  
  return sharedResponseHandler.success({
    books: books.slice(offset, offset + limit),
    pagination: { limit, offset, total: books.length }
  }, 200, { requestId: context.awsRequestId });
};

const getBookById = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const { pathParams, userContext } = params;
  const bookId = pathParams['id'];
  
  if (!bookId) {
    return sharedResponseHandler.error(
      'MISSING_PARAMETER',
      'Book ID is required',
      400,
      { requestId: context.awsRequestId }
    );
  }
  
  // Mock response
  const book = { id: bookId, title: `Book ${bookId}`, author: 'Example Author' };
  
  return sharedResponseHandler.success(book, 200, { requestId: context.awsRequestId });
};

const createBook = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const { userContext } = params;
  
  // Example: Access validated body data (set by validation middleware)
  const bookData = (event as any).validatedBody;
  
  // Example: Check user permissions
  if (userContext?.role !== 'AUTHOR') {
    return sharedResponseHandler.forbidden(
      'Only authors can create books',
      { requestId: context.awsRequestId }
    );
  }
  
  // Mock book creation
  const newBook = {
    id: `book-${Date.now()}`,
    ...bookData,
    authorId: userContext.userId,
    createdAt: new Date().toISOString()
  };
  
  return sharedResponseHandler.success(newBook, 201, { requestId: context.awsRequestId });
};

const updateBook = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const { pathParams, userContext } = params;
  const bookId = pathParams['id'];
  
  // Example: Access validated body data
  const updates = (event as any).validatedBody;
  
  // Mock book update
  const updatedBook = {
    id: bookId,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: userContext?.userId
  };
  
  return sharedResponseHandler.success(updatedBook, 200, { requestId: context.awsRequestId });
};

const deleteBook = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const { pathParams, userContext } = params;
  const bookId = pathParams['id'];
  
  // Example: Role-based authorization
  if (!['AUTHOR', 'ADMIN'].includes(userContext?.role || '')) {
    return sharedResponseHandler.forbidden(
      'Insufficient permissions to delete books',
      { requestId: context.awsRequestId }
    );
  }
  
  // Mock book deletion
  console.log(`Book ${bookId} deleted by ${userContext?.userId}`);
  
  return sharedResponseHandler.successWithMessage(
    'Book deleted successfully',
    undefined,
    204,
    { requestId: context.awsRequestId }
  );
};

// Example: Define routes with different configurations
router
  // Public routes (no authentication required)
  .get('/health', async (event, context) => {
    return sharedResponseHandler.success({
      status: 'healthy',
      timestamp: new Date().toISOString()
    }, 200, { requestId: context.awsRequestId });
  })
  
  // Protected routes (authentication required)
  .get('/books', getBooks, { requireAuth: true })
  .get('/books/{id}', getBookById, { requireAuth: true })
  
  // Routes with role requirements and validation
  .post('/books', createBook, {
    requireAuth: true,
    requiredRoles: ['AUTHOR'],
    middleware: [validationMiddleware]
  })
  .put('/books/{id}', updateBook, {
    requireAuth: true,
    requiredRoles: ['AUTHOR', 'EDITOR'],
    middleware: [validationMiddleware]
  })
  .delete('/books/{id}', deleteBook, {
    requireAuth: true,
    requiredRoles: ['AUTHOR', 'ADMIN']
  });

// Example: Lambda handler using the router
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  return await router.route(event, context);
};

// Example: Alternative syntax for adding routes
export const alternativeRouterSetup = () => {
  const altRouter = new Router();
  
  // Add global middleware
  altRouter.use(routerUtils.createLoggingMiddleware());
  
  // Set authentication middleware
  altRouter.setAuthMiddleware(routerUtils.createAuthMiddleware());
  
  // Add routes using method chaining
  return altRouter
    .get('/api/v1/books', getBooks)
    .post('/api/v1/books', createBook)
    .get('/api/v1/books/:id', getBookById)
    .put('/api/v1/books/:id', updateBook)
    .delete('/api/v1/books/:id', deleteBook);
};

// Example: Custom middleware
export const createCustomMiddleware = () => {
  return async (event: APIGatewayProxyEvent, context: Context, next: () => Promise<APIGatewayProxyResult>) => {
    // Add custom headers
    const result = await next();
    
    result.headers = {
      ...result.headers,
      'X-Custom-Header': 'Custom Value',
      'X-Request-ID': context.awsRequestId
    };
    
    return result;
  };
};

// Example: Usage patterns for different service types
export const serviceExamples = {
  // Simple service with basic routing
  simpleService: () => {
    const simple = new Router();
    simple.get('/health', async (event, context) => {
      return sharedResponseHandler.success({ status: 'ok' });
    });
    return simple;
  },
  
  // Service with authentication
  authService: () => {
    const auth = new Router({
      authMiddleware: routerUtils.createAuthMiddleware()
    });
    
    auth.get('/profile', async (event, context, params) => {
      return sharedResponseHandler.success({
        user: params.userContext
      });
    }, { requireAuth: true });
    
    return auth;
  },
  
  // Service with role-based access control
  adminService: () => {
    const admin = new Router({
      authMiddleware: routerUtils.createAuthMiddleware()
    });
    
    admin.get('/admin/users', async (event, context, params) => {
      return sharedResponseHandler.success({ users: [] });
    }, {
      requireAuth: true,
      requiredRoles: ['ADMIN']
    });
    
    return admin;
  }
};