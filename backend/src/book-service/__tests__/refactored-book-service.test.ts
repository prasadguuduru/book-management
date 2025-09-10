/**
 * Tests for the refactored book-service using shared utilities
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '..';
import { handler } from '..';

// Mock the dependencies that the handler uses
jest.mock('../../data/dao/book-dao');
jest.mock('../../data/validation/access-control');
jest.mock('../../utils/logger');

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'book-service',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:book-service',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/book-service',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

describe('Refactored Book Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Handler Integration', () => {
    it('should handle requests using the router', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          protocol: 'HTTP/1.1',
          httpMethod: 'GET',
          path: '/health',
          stage: 'test',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200,
          resourceId: 'test-resource',
          resourcePath: '/health',
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
          authorizer: null
        },
        resource: '/health',
        body: null,
        isBase64Encoded: false
      };

      // Mock the router to return a successful response
      const { Router } = require('../shared/http/router');
      const mockRouter = {
        route: jest.fn().mockResolvedValue({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'healthy' })
        })
      };
      Router.mockImplementation(() => mockRouter);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockRouter.route).toHaveBeenCalledWith(mockEvent, mockContext);
    });

    it('should handle router errors gracefully', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/books',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          protocol: 'HTTP/1.1',
          httpMethod: 'GET',
          path: '/books',
          stage: 'test',
          requestId: 'test-request-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1672531200,
          resourceId: 'test-resource',
          resourcePath: '/books',
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
          authorizer: null
        },
        resource: '/books',
        body: null,
        isBase64Encoded: false
      };

      // Mock the router to throw an error
      const { Router } = require('../shared/http/router');
      const mockRouter = {
        route: jest.fn().mockRejectedValue(new Error('Router error'))
      };
      Router.mockImplementation(() => mockRouter);

      // Mock the shared response handler
      const { sharedResponseHandler } = require('../shared/http/response-utils');
      sharedResponseHandler.internalError = jest.fn().mockReturnValue({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' })
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(sharedResponseHandler.internalError).toHaveBeenCalledWith(
        'Internal server error',
        { requestId: mockContext.awsRequestId }
      );
    });
  });

  describe('Shared Utilities Integration', () => {
    it('should use shared CORS handler', () => {
      const { Router } = require('../shared/http/router');
      
      // Verify that Router is instantiated with CORS enabled
      expect(Router).toHaveBeenCalledWith({
        corsEnabled: true,
        authMiddleware: expect.any(Function)
      });
    });

    it('should use shared authentication middleware', () => {
      const { extractUserContext } = require('../shared/auth/auth-middleware');
      const { Router } = require('../shared/http/router');
      
      // Get the auth middleware function passed to Router
      const routerCall = Router.mock.calls[0];
      const authMiddleware = routerCall[0].authMiddleware;
      
      expect(authMiddleware).toBeDefined();
      expect(typeof authMiddleware).toBe('function');
    });

    it('should use shared logger', () => {
      const { SharedLogger } = require('../shared/logging/logger');
      
      expect(SharedLogger).toHaveBeenCalledWith('book-service');
    });
  });

  describe('Route Configuration', () => {
    it('should configure all required routes', () => {
      const { Router } = require('../shared/http/router');
      const mockRouter = {
        get: jest.fn().mockReturnThis(),
        post: jest.fn().mockReturnThis(),
        put: jest.fn().mockReturnThis(),
        patch: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis()
      };
      Router.mockImplementation(() => mockRouter);

      // Re-import to trigger route configuration
      jest.resetModules();
      require('../index');

      // Verify health check route (no auth)
      expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function));
      
      // Verify book CRUD routes (with auth)
      expect(mockRouter.get).toHaveBeenCalledWith('/books', expect.any(Function), { requireAuth: true });
      expect(mockRouter.get).toHaveBeenCalledWith('/books/my-books', expect.any(Function), { requireAuth: true });
      expect(mockRouter.get).toHaveBeenCalledWith('/books/published', expect.any(Function), { requireAuth: true });
      expect(mockRouter.get).toHaveBeenCalledWith('/books/{id}', expect.any(Function), { requireAuth: true });
      
      expect(mockRouter.post).toHaveBeenCalledWith('/books', expect.any(Function), { requireAuth: true, requiredRoles: ['AUTHOR'] });
      expect(mockRouter.put).toHaveBeenCalledWith('/books/{id}', expect.any(Function), { requireAuth: true });
      expect(mockRouter.patch).toHaveBeenCalledWith('/books/{id}', expect.any(Function), { requireAuth: true });
      expect(mockRouter.delete).toHaveBeenCalledWith('/books/{id}', expect.any(Function), { requireAuth: true });
      
      // Verify workflow routes (with role-based auth)
      expect(mockRouter.post).toHaveBeenCalledWith('/books/{id}/submit', expect.any(Function), { requireAuth: true, requiredRoles: ['AUTHOR'] });
      expect(mockRouter.post).toHaveBeenCalledWith('/books/{id}/approve', expect.any(Function), { requireAuth: true, requiredRoles: ['EDITOR'] });
      expect(mockRouter.post).toHaveBeenCalledWith('/books/{id}/reject', expect.any(Function), { requireAuth: true, requiredRoles: ['EDITOR'] });
      expect(mockRouter.post).toHaveBeenCalledWith('/books/{id}/publish', expect.any(Function), { requireAuth: true, requiredRoles: ['PUBLISHER'] });
      
      // Verify query routes
      expect(mockRouter.get).toHaveBeenCalledWith('/books/status/{status}', expect.any(Function), { requireAuth: true });
      expect(mockRouter.get).toHaveBeenCalledWith('/books/genre/{genre}', expect.any(Function), { requireAuth: true });
    });
  });
});

describe('Bundle Size Optimization', () => {
  it('should not include unused helper functions', () => {
    const fs = require('fs');
    const path = require('path');
    const indexContent = fs.readFileSync(path.join(__dirname, '../index.ts'), 'utf8');
    
    // Verify removed functions are not present
    expect(indexContent).not.toContain('extractBookIdFromPath');
    expect(indexContent).not.toContain('extractStatusFromPath');
    expect(indexContent).not.toContain('extractGenreFromPath');
    expect(indexContent).not.toContain('createErrorResponse');
  });

  it('should use shared utilities instead of custom implementations', () => {
    const fs = require('fs');
    const path = require('path');
    const indexContent = fs.readFileSync(path.join(__dirname, '../index.ts'), 'utf8');
    
    // Verify shared utilities are imported
    expect(indexContent).toContain('Router');
    expect(indexContent).toContain('sharedResponseHandler');
    expect(indexContent).toContain('extractUserContext');
    expect(indexContent).toContain('SharedLogger');
  });
});