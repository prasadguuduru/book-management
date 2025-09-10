/**
 * Basic functionality tests for refactored book-service
 * These tests verify that core functionality still works after refactoring
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Create a mock context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'book-service',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:book-service',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id-123',
  logGroupName: '/aws/lambda/book-service',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

describe('Book Service Functionality Tests', () => {
  // Mock the dependencies before importing the handler
  beforeAll(() => {
    // Mock the shared utilities to avoid import errors
    jest.doMock('../shared/http/router', () => ({
      Router: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockReturnThis(),
        post: jest.fn().mockReturnThis(),
        put: jest.fn().mockReturnThis(),
        patch: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        route: jest.fn().mockResolvedValue({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'healthy' })
        })
      }))
    }));

    jest.doMock('../shared/http/response-utils', () => ({
      sharedResponseHandler: {
        success: jest.fn().mockReturnValue({
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true })
        }),
        error: jest.fn().mockReturnValue({
          statusCode: 400,
          headers: {},
          body: JSON.stringify({ error: 'Bad request' })
        }),
        internalError: jest.fn().mockReturnValue({
          statusCode: 500,
          headers: {},
          body: JSON.stringify({ error: 'Internal error' })
        })
      }
    }));

    jest.doMock('../shared/auth/auth-middleware', () => ({
      extractUserContext: jest.fn().mockResolvedValue({
        userId: 'test-user',
        email: 'test@example.com',
        role: 'AUTHOR',
        permissions: [],
        isActive: true
      }),
      UserContext: {}
    }));

    jest.doMock('../shared/logging/logger', () => ({
      SharedLogger: jest.fn().mockImplementation(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }))
    }));

    // Mock the data layer
    jest.doMock('../../data/dao/book-dao', () => ({
      bookDAO: {
        createBook: jest.fn().mockResolvedValue('book-123'),
        getBookById: jest.fn().mockResolvedValue({
          id: 'book-123',
          title: 'Test Book',
          status: 'DRAFT',
          authorId: 'test-user'
        }),
        updateBook: jest.fn().mockResolvedValue({
          id: 'book-123',
          title: 'Updated Book',
          status: 'DRAFT'
        }),
        deleteBook: jest.fn().mockResolvedValue(undefined),
        validateBookData: jest.fn().mockReturnValue([])
      }
    }));

    jest.doMock('../../data/validation/access-control', () => ({
      accessControlService: {
        canAccessBook: jest.fn().mockReturnValue(true),
        canEditBook: jest.fn().mockReturnValue(true),
        canDeleteBook: jest.fn().mockReturnValue(true)
      }
    }));
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('Handler Integration', () => {
    it('should export a handler function', async () => {
      const { handler } = await import('../index');
      expect(typeof handler).toBe('function');
    });

    it('should handle requests through the router', async () => {
      const { handler } = await import('../index');
      
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

      const result = await handler(mockEvent, mockContext);
      
      expect(result).toBeDefined();
      expect(result.statusCode).toBeDefined();
      expect(result.body).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // Mock router to throw an error
      const mockRouter = {
        get: jest.fn().mockReturnThis(),
        post: jest.fn().mockReturnThis(),
        put: jest.fn().mockReturnThis(),
        patch: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        route: jest.fn().mockRejectedValue(new Error('Test error'))
      };

      jest.doMock('../shared/http/router', () => ({
        Router: jest.fn().mockImplementation(() => mockRouter)
      }));

      // Re-import to get the updated mock
      jest.resetModules();
      const { handler } = await import('../index');
      
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

      const result = await handler(mockEvent, mockContext);
      
      // Should return an error response
      expect(result).toBeDefined();
      expect(result.statusCode).toBe(500);
    });
  });

  describe('Code Structure Validation', () => {
    it('should have proper TypeScript types', async () => {
      const { handler } = await import('../index');
      
      // Verify handler has correct signature
      expect(handler.length).toBe(2); // Should accept event and context
    });

    it('should use shared utilities', async () => {
      // Import the module to trigger shared utility usage
      await import('../index');
      
      const { Router } = require('../shared/http/router');
      const { SharedLogger } = require('../shared/logging/logger');
      
      // Verify shared utilities were instantiated
      expect(Router).toHaveBeenCalled();
      expect(SharedLogger).toHaveBeenCalledWith('book-service');
    });
  });
});