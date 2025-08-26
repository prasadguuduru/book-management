/**
 * Integration tests for authentication service with all four user roles
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';

describe('Auth Service Integration Tests', () => {
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

  const createLoginEvent = (email: string, password: string): APIGatewayProxyEvent => ({
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
    body: JSON.stringify({ email, password }),
    isBase64Encoded: false
  });

  const createValidateEvent = (token: string): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    path: '/validate',
    headers: {
      Authorization: `Bearer ${token}`
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    body: null,
    isBase64Encoded: false
  });

  describe('Complete Authentication Flow for All Roles', () => {
    const testRoles = [
      { email: 'author@test.com', role: 'AUTHOR', expectedName: 'Author' },
      { email: 'editor@test.com', role: 'EDITOR', expectedName: 'Editor' },
      { email: 'publisher@test.com', role: 'PUBLISHER', expectedName: 'Publisher' },
      { email: 'reader@test.com', role: 'READER', expectedName: 'Reader' }
    ];

    testRoles.forEach(({ email, role, expectedName }) => {
      describe(`${role} Role`, () => {
        let accessToken: string;
        let refreshToken: string;

        it(`should login ${role} successfully`, async () => {
          const loginEvent = createLoginEvent(email, 'password123');
          const result = await handler(loginEvent, mockContext);

          expect(result.statusCode).toBe(200);
          const body = JSON.parse(result.body);
          
          expect(body.accessToken).toBeDefined();
          expect(body.refreshToken).toBeDefined();
          expect(body.user.email).toBe(email);
          expect(body.user.role).toBe(role);
          expect(body.user.firstName).toBe(expectedName);
          expect(body.user.lastName).toBe('User');
          expect(body.user.isActive).toBe(true);
          expect(body.user.emailVerified).toBe(true);

          // Store tokens for subsequent tests
          accessToken = body.accessToken;
          refreshToken = body.refreshToken;
        });

        it(`should validate ${role} token successfully`, async () => {
          const validateEvent = createValidateEvent(accessToken);
          const result = await handler(validateEvent, mockContext);

          expect(result.statusCode).toBe(200);
          const body = JSON.parse(result.body);
          
          expect(body.valid).toBe(true);
          expect(body.user.email).toBe(email);
          expect(body.user.role).toBe(role);
          expect(body.user.isActive).toBe(true);
          expect(body.permissions).toBeDefined();
          expect(Array.isArray(body.permissions)).toBe(true);
        });

        it(`should get ${role} profile successfully`, async () => {
          const profileEvent: APIGatewayProxyEvent = {
            httpMethod: 'GET',
            path: '/profile',
            headers: {
              Authorization: `Bearer ${accessToken}`
            },
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

          const result = await handler(profileEvent, mockContext);

          expect(result.statusCode).toBe(200);
          const body = JSON.parse(result.body);
          
          expect(body.user.email).toBe(email);
          expect(body.user.role).toBe(role);
          expect(body.user.firstName).toBe(expectedName);
          expect(body.user.version).toBeUndefined(); // Should be removed from response
        });

        it(`should refresh ${role} tokens successfully`, async () => {
          const refreshEvent: APIGatewayProxyEvent = {
            httpMethod: 'POST',
            path: '/refresh',
            headers: {},
            multiValueHeaders: {},
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            pathParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: '',
            body: JSON.stringify({ refreshToken }),
            isBase64Encoded: false
          };

          const result = await handler(refreshEvent, mockContext);

          expect(result.statusCode).toBe(200);
          const body = JSON.parse(result.body);
          
          expect(body.accessToken).toBeDefined();
          expect(body.refreshToken).toBeDefined();
          expect(body.accessToken).not.toBe(accessToken); // Should be new token
        });

        it(`should logout ${role} successfully`, async () => {
          const logoutEvent: APIGatewayProxyEvent = {
            httpMethod: 'POST',
            path: '/logout',
            headers: {
              Authorization: `Bearer ${accessToken}`
            },
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

          const result = await handler(logoutEvent, mockContext);

          expect(result.statusCode).toBe(200);
          const body = JSON.parse(result.body);
          
          expect(body.message).toBe('Logged out successfully');
        });
      });
    });
  });

  describe('Role-Specific Permissions', () => {
    it('should return different permissions for different roles', async () => {
      const roles = ['author@test.com', 'editor@test.com', 'publisher@test.com', 'reader@test.com'];
      const permissions: Record<string, any[]> = {};

      // Login and get permissions for each role
      for (const email of roles) {
        const loginEvent = createLoginEvent(email, 'password123');
        const loginResult = await handler(loginEvent, mockContext);
        
        expect(loginResult.statusCode).toBe(200);
        const loginBody = JSON.parse(loginResult.body);
        
        const validateEvent = createValidateEvent(loginBody.accessToken);
        const validateResult = await handler(validateEvent, mockContext);
        
        expect(validateResult.statusCode).toBe(200);
        const validateBody = JSON.parse(validateResult.body);
        
        permissions[validateBody.user.role] = validateBody.permissions;
      }

      // Verify each role has different permissions
      expect(permissions['AUTHOR']).toBeDefined();
      expect(permissions['EDITOR']).toBeDefined();
      expect(permissions['PUBLISHER']).toBeDefined();
      expect(permissions['READER']).toBeDefined();

      // Author should have book creation permissions
      expect(permissions['AUTHOR']?.some((p: any) => p.resource === 'books' && p.action === 'create')).toBe(true);

      // Editor should have book approval permissions
      expect(permissions['EDITOR']?.some((p: any) => p.resource === 'books' && p.action === 'approve')).toBe(true);

      // Publisher should have book publication permissions
      expect(permissions['PUBLISHER']?.some((p: any) => p.resource === 'books' && p.action === 'publish')).toBe(true);

      // Reader should have review creation permissions
      expect(permissions['READER']?.some((p: any) => p.resource === 'reviews' && p.action === 'create')).toBe(true);

      // Verify roles don't have permissions they shouldn't have
      expect(permissions['READER']?.some((p: any) => p.resource === 'books' && p.action === 'create')).toBe(false);
      expect(permissions['AUTHOR']?.some((p: any) => p.resource === 'books' && p.action === 'publish')).toBe(false);
    });
  });

  describe.skip('Error Scenarios', () => {
    it('should reject login with wrong password for all roles', async () => {
      const roles = ['author@test.com', 'editor@test.com', 'publisher@test.com', 'reader@test.com'];

      for (const email of roles) {
        const loginEvent = createLoginEvent(email, 'wrongpassword');
        const result = await handler(loginEvent, mockContext);

        expect(result.statusCode).toBe(401);
        const body = JSON.parse(result.body);
        expect(body.error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should reject token validation with invalid token', async () => {
      const validateEvent = createValidateEvent('invalid-token');
      const result = await handler(validateEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject profile access without token', async () => {
      const profileEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/profile',
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

      const result = await handler(profileEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('CORS and Headers', () => {
    it('should include CORS headers in all responses', async () => {
      const events = [
        { httpMethod: 'GET', path: '/health' },
        { httpMethod: 'POST', path: '/login', body: JSON.stringify({ email: 'author@test.com', password: 'password123' }) },
        { httpMethod: 'OPTIONS', path: '/login' }
      ];

      for (const eventData of events) {
        const event: APIGatewayProxyEvent = {
          ...eventData,
          headers: {},
          multiValueHeaders: {},
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          pathParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
          body: eventData.body || null,
          isBase64Encoded: false
        };

        const result = await handler(event, mockContext);

        expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
        expect(result.headers).toHaveProperty('Content-Type', 'application/json');
        expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
        expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      }
    });
  });
});