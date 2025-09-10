/**
 * Tests for the shared router utility
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Router, routerUtils, RouteParams, UserContext } from '../router';

// Mock the shared utilities
jest.mock('../response-utils', () => ({
  sharedResponseHandler: {
    error: jest.fn((code: string, message: string, statusCode: number, options?: any) => ({
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { code, message, timestamp: '2023-01-01T00:00:00.000Z', requestId: options?.requestId }
      })
    })),
    unauthorized: jest.fn((message: string, options?: any) => ({
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { code: 'UNAUTHORIZED', message, timestamp: '2023-01-01T00:00:00.000Z', requestId: options?.requestId }
      })
    })),
    forbidden: jest.fn((message: string, options?: any) => ({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { code: 'FORBIDDEN', message, timestamp: '2023-01-01T00:00:00.000Z', requestId: options?.requestId }
      })
    })),
    internalError: jest.fn((message: string, options?: any) => ({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message, timestamp: '2023-01-01T00:00:00.000Z', requestId: options?.requestId }
      })
    })),
    validationError: jest.fn((errors: string[], options?: any) => ({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', details: errors, timestamp: '2023-01-01T00:00:00.000Z', requestId: options?.requestId }
      })
    }))
  }
}));

jest.mock('../cors-utils', () => ({
  sharedCorsHandler: {
    createOptionsResponse: jest.fn((origin?: string) => ({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'CORS preflight successful' })
    })),
    getHeaders: jest.fn((origin?: string) => ({
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    }))
  }
}));

// Helper function to create mock API Gateway event
const createMockEvent = (
  httpMethod: string,
  path: string,
  body?: string,
  queryStringParameters?: Record<string, string>,
  pathParameters?: Record<string, string>,
  headers?: Record<string, string>,
  authorizer?: Record<string, any>
): APIGatewayProxyEvent => ({
  httpMethod,
  path,
  body: body || null,
  queryStringParameters: queryStringParameters || null,
  pathParameters: pathParameters || null,
  headers: headers || {},
  requestContext: {
    requestId: 'test-request-id',
    authorizer: authorizer || null
  } as any,
  resource: '',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  stageVariables: null
});

// Helper function to create mock Lambda context
const createMockContext = (): Context => ({
  awsRequestId: 'test-request-id',
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  memoryLimitInMB: '128',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
});

describe('Router', () => {
  let router: Router;
  let mockContext: Context;

  beforeEach(() => {
    router = new Router();
    mockContext = createMockContext();
    jest.clearAllMocks();
  });

  describe('Basic Routing', () => {
    it('should handle GET requests', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: JSON.stringify({ message: 'success' })
      });

      router.get('/test', handler);

      const event = createMockEvent('GET', '/test');
      const result = await router.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: {},
        queryParams: {}
      });
      expect(result.statusCode).toBe(200);
    });

    it('should handle POST requests', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 201,
        headers: {},
        body: JSON.stringify({ message: 'created' })
      });

      router.post('/test', handler);

      const event = createMockEvent('POST', '/test', JSON.stringify({ data: 'test' }));
      const result = await router.route(event, mockContext);

      expect(handler).toHaveBeenCalled();
      expect(result.statusCode).toBe(201);
    });

    it('should handle PUT, PATCH, and DELETE requests', async () => {
      const putHandler = jest.fn().mockResolvedValue({ statusCode: 200, headers: {}, body: '{}' });
      const patchHandler = jest.fn().mockResolvedValue({ statusCode: 200, headers: {}, body: '{}' });
      const deleteHandler = jest.fn().mockResolvedValue({ statusCode: 204, headers: {}, body: '' });

      router.put('/test', putHandler);
      router.patch('/test', patchHandler);
      router.delete('/test', deleteHandler);

      await router.route(createMockEvent('PUT', '/test'), mockContext);
      await router.route(createMockEvent('PATCH', '/test'), mockContext);
      await router.route(createMockEvent('DELETE', '/test'), mockContext);

      expect(putHandler).toHaveBeenCalled();
      expect(patchHandler).toHaveBeenCalled();
      expect(deleteHandler).toHaveBeenCalled();
    });

    it('should return 404 for unmatched routes', async () => {
      const event = createMockEvent('GET', '/nonexistent');
      const result = await router.route(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Endpoint not found');
    });
  });

  describe('Path Parameters', () => {
    it('should extract path parameters with curly brace syntax', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/users/{id}', handler);

      const event = createMockEvent('GET', '/users/123');
      await router.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: { id: '123' },
        queryParams: {}
      });
    });

    it('should extract path parameters with colon syntax', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/users/:id', handler);

      const event = createMockEvent('GET', '/users/456');
      await router.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: { id: '456' },
        queryParams: {}
      });
    });

    it('should extract multiple path parameters', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/users/{userId}/books/{bookId}', handler);

      const event = createMockEvent('GET', '/users/123/books/456');
      await router.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: { userId: '123', bookId: '456' },
        queryParams: {}
      });
    });

    it('should decode URL-encoded path parameters', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/search/{query}', handler);

      const event = createMockEvent('GET', '/search/hello%20world');
      await router.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: { query: 'hello world' },
        queryParams: {}
      });
    });
  });

  describe('Query Parameters', () => {
    it('should extract query parameters', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/search', handler);

      const event = createMockEvent('GET', '/search', undefined, {
        q: 'test',
        limit: '10',
        offset: '0'
      });
      await router.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: {},
        queryParams: { q: 'test', limit: '10', offset: '0' }
      });
    });

    it('should handle empty query parameters', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/test', handler);

      const event = createMockEvent('GET', '/test');
      await router.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: {},
        queryParams: {}
      });
    });
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const event = createMockEvent('OPTIONS', '/test', undefined, undefined, undefined, {
        'Origin': 'https://example.com'
      });
      const result = await router.route(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
    });

    it('should add CORS headers to responses', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: { 'Custom-Header': 'value' },
        body: '{}'
      });

      router.get('/test', handler);

      const event = createMockEvent('GET', '/test', undefined, undefined, undefined, {
        'Origin': 'https://example.com'
      });
      const result = await router.route(event, mockContext);

      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Custom-Header', 'value');
    });

    it('should allow disabling CORS', async () => {
      const routerWithoutCors = new Router({ corsEnabled: false });
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      routerWithoutCors.get('/test', handler);

      const event = createMockEvent('OPTIONS', '/test');
      const result = await routerWithoutCors.route(event, mockContext);

      expect(result.statusCode).toBe(404); // Should not handle OPTIONS when CORS is disabled
    });
  });

  describe('Authentication', () => {
    const mockUserContext: UserContext = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'AUTHOR',
      permissions: ['read', 'write']
    };

    it('should require authentication when specified', async () => {
      const authMiddleware = jest.fn().mockResolvedValue(null);
      const routerWithAuth = new Router({ authMiddleware });

      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      routerWithAuth.get('/protected', handler, { requireAuth: true });

      const event = createMockEvent('GET', '/protected');
      const result = await routerWithAuth.route(event, mockContext);

      expect(authMiddleware).toHaveBeenCalled();
      expect(result.statusCode).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass user context to handler when authenticated', async () => {
      const authMiddleware = jest.fn().mockResolvedValue(mockUserContext);
      const routerWithAuth = new Router({ authMiddleware });

      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      routerWithAuth.get('/protected', handler, { requireAuth: true });

      const event = createMockEvent('GET', '/protected');
      await routerWithAuth.route(event, mockContext);

      expect(handler).toHaveBeenCalledWith(event, mockContext, {
        pathParams: {},
        queryParams: {},
        userContext: mockUserContext
      });
    });

    it('should check role requirements', async () => {
      const authMiddleware = jest.fn().mockResolvedValue(mockUserContext);
      const routerWithAuth = new Router({ authMiddleware });

      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      routerWithAuth.get('/admin', handler, {
        requireAuth: true,
        requiredRoles: ['ADMIN']
      });

      const event = createMockEvent('GET', '/admin');
      const result = await routerWithAuth.route(event, mockContext);

      expect(result.statusCode).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow access with correct role', async () => {
      const authMiddleware = jest.fn().mockResolvedValue(mockUserContext);
      const routerWithAuth = new Router({ authMiddleware });

      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      routerWithAuth.get('/author-only', handler, {
        requireAuth: true,
        requiredRoles: ['AUTHOR']
      });

      const event = createMockEvent('GET', '/author-only');
      const result = await routerWithAuth.route(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Middleware', () => {
    it('should execute global middleware', async () => {
      const globalMiddleware = jest.fn().mockImplementation(async (event, context, next) => {
        const result = await next();
        result.headers = { ...result.headers, 'X-Global': 'true' };
        return result;
      });

      const routerWithMiddleware = new Router({ globalMiddleware: [globalMiddleware] });

      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      routerWithMiddleware.get('/test', handler);

      const event = createMockEvent('GET', '/test');
      const result = await routerWithMiddleware.route(event, mockContext);

      expect(globalMiddleware).toHaveBeenCalled();
      expect(result.headers).toHaveProperty('X-Global', 'true');
    });

    it('should execute route-specific middleware', async () => {
      const routeMiddleware = jest.fn().mockImplementation(async (event, context, next) => {
        const result = await next();
        result.headers = { ...result.headers, 'X-Route': 'true' };
        return result;
      });

      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/test', handler, { middleware: [routeMiddleware] });

      const event = createMockEvent('GET', '/test');
      const result = await router.route(event, mockContext);

      expect(routeMiddleware).toHaveBeenCalled();
      expect(result.headers).toHaveProperty('X-Route', 'true');
    });

    it('should execute middleware in correct order', async () => {
      const executionOrder: string[] = [];

      const middleware1 = jest.fn().mockImplementation(async (event, context, next) => {
        executionOrder.push('middleware1-before');
        const result = await next();
        executionOrder.push('middleware1-after');
        return result;
      });

      const middleware2 = jest.fn().mockImplementation(async (event, context, next) => {
        executionOrder.push('middleware2-before');
        const result = await next();
        executionOrder.push('middleware2-after');
        return result;
      });

      const handler = jest.fn().mockImplementation(async () => {
        executionOrder.push('handler');
        return { statusCode: 200, headers: {}, body: '{}' };
      });

      router.use(middleware1);
      router.get('/test', handler, { middleware: [middleware2] });

      const event = createMockEvent('GET', '/test');
      await router.route(event, mockContext);

      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after'
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));

      router.get('/error', handler);

      const event = createMockEvent('GET', '/error');
      const result = await router.route(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle middleware errors gracefully', async () => {
      const errorMiddleware = jest.fn().mockRejectedValue(new Error('Middleware error'));

      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/test', handler, { middleware: [errorMiddleware] });

      const event = createMockEvent('GET', '/test');
      const result = await router.route(event, mockContext);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Path Normalization', () => {
    it('should handle paths with trailing slashes', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/test', handler);

      const event = createMockEvent('GET', '/test/');
      const result = await router.route(event, mockContext);

      expect(handler).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
    });

    it('should handle paths without leading slashes', async () => {
      const handler = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      router.get('/test', handler);

      const event = createMockEvent('GET', 'test');
      const result = await router.route(event, mockContext);

      expect(handler).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
    });
  });
});

describe('Router Utils', () => {
  describe('extractUserContext', () => {
    it('should extract user context from authorizer', () => {
      const event = createMockEvent('GET', '/test', undefined, undefined, undefined, undefined, {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR',
        permissions: JSON.stringify(['read', 'write'])
      });

      const userContext = routerUtils.extractUserContext(event);

      expect(userContext).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR',
        permissions: ['read', 'write']
      });
    });

    it('should return null for missing authorizer data', () => {
      const event = createMockEvent('GET', '/test');
      const userContext = routerUtils.extractUserContext(event);

      expect(userContext).toBeNull();
    });

    it('should handle missing permissions gracefully', () => {
      const event = createMockEvent('GET', '/test', undefined, undefined, undefined, undefined, {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR'
      });

      const userContext = routerUtils.extractUserContext(event);

      expect(userContext).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR',
        permissions: []
      });
    });
  });

  describe('createAuthMiddleware', () => {
    it('should create auth middleware that extracts user context', async () => {
      const authMiddleware = routerUtils.createAuthMiddleware();
      const event = createMockEvent('GET', '/test', undefined, undefined, undefined, undefined, {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR'
      });
      const context = createMockContext();

      const userContext = await authMiddleware(event, context);

      expect(userContext).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR',
        permissions: []
      });
    });
  });

  describe('createLoggingMiddleware', () => {
    it('should log request start and completion', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const loggingMiddleware = routerUtils.createLoggingMiddleware();
      
      const mockNext = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      const event = createMockEvent('GET', '/test');
      const context = createMockContext();

      await loggingMiddleware(event, context, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith('Request started:', expect.objectContaining({
        requestId: 'test-request-id',
        method: 'GET',
        path: '/test'
      }));

      expect(consoleSpy).toHaveBeenCalledWith('Request completed:', expect.objectContaining({
        requestId: 'test-request-id',
        statusCode: 200
      }));

      consoleSpy.mockRestore();
    });
  });

  describe('createValidationMiddleware', () => {
    it('should validate request body and pass validated data', async () => {
      const validator = jest.fn().mockReturnValue({
        valid: true,
        data: { name: 'test', age: 25 }
      });

      const validationMiddleware = routerUtils.createValidationMiddleware(validator);
      
      const mockNext = jest.fn().mockResolvedValue({
        statusCode: 200,
        headers: {},
        body: '{}'
      });

      const event = createMockEvent('POST', '/test', JSON.stringify({ name: 'test', age: 25 }));
      const context = createMockContext();

      await validationMiddleware(event, context, mockNext);

      expect(validator).toHaveBeenCalledWith({ name: 'test', age: 25 });
      expect((event as any).validatedBody).toEqual({ name: 'test', age: 25 });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return validation error for invalid data', async () => {
      const validator = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Name is required', 'Age must be a number']
      });

      const validationMiddleware = routerUtils.createValidationMiddleware(validator);
      
      const mockNext = jest.fn();

      const event = createMockEvent('POST', '/test', JSON.stringify({ invalid: 'data' }));
      const context = createMockContext();

      const result = await validationMiddleware(event, context, mockNext);

      expect(result.statusCode).toBe(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const validator = jest.fn();
      const validationMiddleware = routerUtils.createValidationMiddleware(validator);
      
      const mockNext = jest.fn();

      const event = createMockEvent('POST', '/test', 'invalid json');
      const context = createMockContext();

      const result = await validationMiddleware(event, context, mockNext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_JSON');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});