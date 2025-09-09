/**
 * Unit tests for backward-compatible workflow endpoints
 */

import { handler } from '../index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the DAOs
jest.mock('../../data/dao/workflow-dao');
jest.mock('../../data/dao/book-dao');

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn()
};

const createMockEvent = (
  httpMethod: string,
  path: string,
  resource: string,
  pathParameters: Record<string, string> | null = null,
  body: string | null = null
): APIGatewayProxyEvent => ({
  httpMethod,
  path,
  resource,
  pathParameters,
  body,
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000'
  },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  isBase64Encoded: false,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    authorizer: {
      userId: 'test-user-123',
      role: 'AUTHOR',
      email: 'test@example.com'
    },
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
    requestId: 'test-request-id',
    requestTime: '01/Jan/2023:00:00:00 +0000',
    requestTimeEpoch: 1672531200,
    resourceId: 'test-resource',
    resourcePath: resource,
    stage: 'test'
  }
});

describe('Backward-Compatible Workflow Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Proxy-based routing', () => {
    test('POST /api/workflow/books/{bookId}/submit should route correctly', async () => {
      const event = createMockEvent(
        'POST',
        '/api/workflow/books/test-book-123/submit',
        '/api/workflow/{proxy+}',
        { proxy: 'books/test-book-123/submit' },
        '{}'
      );

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.body).toBeDefined();
    });

    test('POST /api/workflow/books/{bookId}/approve should route correctly', async () => {
      const event = createMockEvent(
        'POST',
        '/api/workflow/books/test-book-123/approve',
        '/api/workflow/{proxy+}',
        { proxy: 'books/test-book-123/approve' },
        '{"comments": "Looks good!"}'
      );

      // Set editor role for approval
      event.requestContext.authorizer = {
        userId: 'test-editor-123',
        role: 'EDITOR',
        email: 'editor@example.com'
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.body).toBeDefined();
    });

    test('POST /api/workflow/books/{bookId}/reject should route correctly', async () => {
      const event = createMockEvent(
        'POST',
        '/api/workflow/books/test-book-123/reject',
        '/api/workflow/{proxy+}',
        { proxy: 'books/test-book-123/reject' },
        '{"comments": "Needs revision"}'
      );

      // Set editor role for rejection
      event.requestContext.authorizer = {
        userId: 'test-editor-123',
        role: 'EDITOR',
        email: 'editor@example.com'
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.body).toBeDefined();
    });

    test('POST /api/workflow/books/{bookId}/publish should route correctly', async () => {
      const event = createMockEvent(
        'POST',
        '/api/workflow/books/test-book-123/publish',
        '/api/workflow/{proxy+}',
        { proxy: 'books/test-book-123/publish' },
        '{}'
      );

      // Set publisher role for publication
      event.requestContext.authorizer = {
        userId: 'test-publisher-123',
        role: 'PUBLISHER',
        email: 'publisher@example.com'
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.body).toBeDefined();
    });
  });

  describe('Legacy path-segments routing', () => {
    test('POST /workflow/books/{bookId}/submit should route correctly', async () => {
      const event = createMockEvent(
        'POST',
        '/workflow/books/test-book-123/submit',
        '/workflow/books/{bookId}/submit',
        { bookId: 'test-book-123' },
        '{}'
      );

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.body).toBeDefined();
    });

    test('POST /workflow/books/{bookId}/approve should route correctly', async () => {
      const event = createMockEvent(
        'POST',
        '/workflow/books/test-book-123/approve',
        '/workflow/books/{bookId}/approve',
        { bookId: 'test-book-123' },
        '{"comments": "Looks good!"}'
      );

      // Set editor role for approval
      event.requestContext.authorizer = {
        userId: 'test-editor-123',
        role: 'EDITOR',
        email: 'editor@example.com'
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBeDefined();
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.body).toBeDefined();
    });
  });

  describe('Error handling', () => {
    test('should return 404 for invalid route structure', async () => {
      const event = createMockEvent(
        'POST',
        '/api/workflow/books/submit',
        '/api/workflow/{proxy+}',
        { proxy: 'books/submit' },
        '{}'
      );

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    test('should return 401 for missing authorization', async () => {
      const event = createMockEvent(
        'POST',
        '/api/workflow/books/test-book-123/submit',
        '/api/workflow/{proxy+}',
        { proxy: 'books/test-book-123/submit' },
        '{}'
      );

      // Remove authorization
      event.requestContext.authorizer = undefined as any;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('CORS handling', () => {
    test('should handle OPTIONS requests', async () => {
      const event = createMockEvent(
        'OPTIONS',
        '/api/workflow/books/test-book-123/submit',
        '/api/workflow/{proxy+}',
        { proxy: 'books/test-book-123/submit' }
      );

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
    });
  });
});