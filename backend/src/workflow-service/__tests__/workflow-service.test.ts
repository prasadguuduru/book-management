/**
 * Workflow Service Tests
 */

import { handler } from '../index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock dependencies
jest.mock('../../data/dao/workflow-dao');
jest.mock('../../data/dao/book-dao');
jest.mock('../../utils/logger');

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'workflow-service',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:workflow-service',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/workflow-service',
  logStreamName: '2023/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

describe('Workflow Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        requestContext: {} as any
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('workflow-service');
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS request', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'OPTIONS',
        path: '/workflow/books/123/status',
        headers: { origin: 'http://localhost:3000' },
        requestContext: {} as any
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
    });
  });

  describe('Authentication', () => {
    it('should return 401 for missing authentication', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/workflow/books/123/status',
        headers: {},
        requestContext: {} as any
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Route Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/workflow/unknown',
        headers: {},
        requestContext: {
          authorizer: {
            userId: 'user-123',
            role: 'AUTHOR',
            email: 'test@example.com'
          }
        } as any
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});

describe('Workflow Validation Functions', () => {
  // These would test the helper functions directly
  // For now, we'll focus on integration tests
});