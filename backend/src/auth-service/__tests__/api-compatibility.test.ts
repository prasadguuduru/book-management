/**
 * API Compatibility Tests for Auth Service Refactoring
 * Ensures that the refactored auth service maintains backward compatibility
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';

describe('Auth Service API Compatibility', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'auth-service',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:auth-service',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/auth-service',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn()
  };

  describe('Response Format Compatibility', () => {
    it('should maintain health check response format', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('service', 'auth-service');
      expect(body).toHaveProperty('version', '2.0.0');
      expect(body).toHaveProperty('features');
      expect(body).toHaveProperty('diagnostics');
      expect(body.features).toEqual({
        registration: true,
        mockLogin: true,
        jwtTokens: true,
        roleBasedAuth: true,
        profileManagement: true
      });
    });

    it('should maintain login response format', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({
          email: 'author@test.com',
          password: 'password123'
        }),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('userId');
      expect(body.user).toHaveProperty('email', 'author@test.com');
      expect(body.user).toHaveProperty('role', 'AUTHOR');
      expect(body.user).toHaveProperty('firstName', 'Author');
      expect(body.user).toHaveProperty('lastName', 'User');
      expect(body.user).toHaveProperty('isActive', true);
      expect(body.user).toHaveProperty('emailVerified', true);
      expect(body.user).toHaveProperty('preferences');
      expect(body.user).not.toHaveProperty('version'); // Should be removed
    });

    it('should maintain error response format', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null, // Missing body should cause error
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'MISSING_BODY');
      expect(body.error).toHaveProperty('message', 'Request body is required');
      expect(body).toHaveProperty('timestamp');
    });

    it('should maintain CORS headers in all responses', async () => {
      const testCases = [
        { method: 'GET', path: '/health' },
        { method: 'POST', path: '/login', body: JSON.stringify({ email: 'test@test.com', password: 'test' }) },
        { method: 'OPTIONS', path: '/login' },
        { method: 'GET', path: '/unknown' }
      ];

      for (const testCase of testCases) {
        const event: APIGatewayProxyEvent = {
          httpMethod: testCase.method,
          path: testCase.path,
          headers: {},
          multiValueHeaders: {},
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          pathParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
          body: testCase.body || null,
          isBase64Encoded: false
        };

        const result = await handler(event, mockContext);

        expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
        expect(result.headers).toHaveProperty('Content-Type', 'application/json');
        expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
        expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      }
    });
  });

  describe('Endpoint Compatibility', () => {
    it('should support all original endpoints', async () => {
      const endpoints = [
        { method: 'GET', path: '/health', expectedStatus: 200 },
        { method: 'POST', path: '/login', body: JSON.stringify({ email: 'author@test.com', password: 'password123' }), expectedStatus: 200 },
        { method: 'POST', path: '/register', body: JSON.stringify({ email: 'new@test.com', password: 'password123', firstName: 'Test', lastName: 'User', role: 'AUTHOR' }), expectedStatus: 201 },
        { method: 'OPTIONS', path: '/login', expectedStatus: 200 },
        { method: 'GET', path: '/api/auth', expectedStatus: 200 }, // Service info endpoint
      ];

      for (const endpoint of endpoints) {
        const event: APIGatewayProxyEvent = {
          httpMethod: endpoint.method,
          path: endpoint.path,
          headers: {},
          multiValueHeaders: {},
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          pathParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
          body: endpoint.body || null,
          isBase64Encoded: false
        };

        const result = await handler(event, mockContext);
        expect(result.statusCode).toBe(endpoint.expectedStatus);
      }
    });

    it('should maintain frontend compatibility route', async () => {
      // Test the /api/auth POST route that the frontend uses
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/api/auth',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({
          email: 'editor@test.com',
          password: 'password123'
        }),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.user.role).toBe('EDITOR');
    });
  });

  describe('Shared Utilities Integration', () => {
    it('should use shared CORS handler consistently', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'OPTIONS',
        path: '/login',
        headers: { origin: 'https://example.com' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(result.headers).toHaveProperty('Access-Control-Max-Age');
    });

    it('should use shared response format', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      // Verify consistent response structure
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('headers');
      expect(result).toHaveProperty('body');
      expect(typeof result.body).toBe('string');
      
      // Verify headers are consistent
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
    });
  });

  describe('Performance and Bundle Size', () => {
    it('should have reasonable response times', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const startTime = Date.now();
      const result = await handler(event, mockContext);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(result.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should validate shared utilities are being used', async () => {
      // This test ensures that the refactored service is actually using shared utilities
      // by checking that the response format matches what the shared utilities produce
      
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({
          email: 'publisher@test.com',
          password: 'password123'
        }),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      
      // Verify CORS headers match shared utility format
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      
      // Verify response body structure
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('user');
      expect(body.user).not.toHaveProperty('version'); // Should be stripped by shared utilities
    });
  });
});