/**
 * Unit Tests for Enhanced Event Detection
 * Tests event type detection, null safety, and validation logic
 */

import { APIGatewayProxyEvent, SQSEvent, Context, APIGatewayEventIdentity } from 'aws-lambda';
import { handler } from '../index';

// Helper to create a valid identity object
const createMockIdentity = (): APIGatewayEventIdentity => ({
  sourceIp: '127.0.0.1',
  userAgent: 'test-agent',
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
  user: null,
  userArn: null,
  clientCert: null
});

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../handlers/sqs-event-handler', () => ({
  sqsHandler: jest.fn().mockResolvedValue({ batchItemFailures: [] })
}));

jest.mock('../handlers/health', () => ({
  healthCheckHandler: jest.fn().mockResolvedValue({
    statusCode: 200,
    body: { status: 'healthy' }
  })
}));

jest.mock('../../utils/cors', () => ({
  getCorsHeaders: jest.fn().mockReturnValue({}),
  createOptionsResponse: jest.fn().mockReturnValue({
    statusCode: 200,
    headers: {},
    body: ''
  })
}));

describe('Enhanced Event Detection', () => {
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      getRemainingTimeInMillis: jest.fn().mockReturnValue(30000),
      callbackWaitsForEmptyEventLoop: false,
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: '2023/01/01/[$LATEST]test',
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('SQS Event Detection', () => {
    it('should detect valid SQS events with eventSource', async () => {
      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'test-message-id',
          receiptHandle: 'test-receipt-handle',
          body: JSON.stringify({ test: 'data' }),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      const result = await handler(sqsEvent, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
      expect(require('../handlers/sqs-event-handler').sqsHandler).toHaveBeenCalledWith(sqsEvent, mockContext);
    });

    it('should detect SQS events without eventSource but with receiptHandle', async () => {
      const sqsEvent = {
        Records: [{
          messageId: 'test-message-id',
          receiptHandle: 'test-receipt-handle',
          body: JSON.stringify({ test: 'data' }),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      const result = await handler(sqsEvent as any, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
      expect(require('../handlers/sqs-event-handler').sqsHandler).toHaveBeenCalledWith(sqsEvent, mockContext);
    });

    it('should handle empty SQS Records array', async () => {
      const sqsEvent = {
        Records: []
      };

      const result = await handler(sqsEvent as any, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
    });
  });

  describe('API Gateway Event Detection', () => {
    it('should detect API Gateway events with all properties', async () => {
      const apiEvent: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        resource: '/health',
        pathParameters: null,
        queryStringParameters: null,
        headers: {},
        multiValueHeaders: {},
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          httpMethod: 'GET',
          requestId: 'test-request',
          resourceId: 'test-resource',
          resourcePath: '/health',
          stage: 'test',
          path: '/health',
          identity: createMockIdentity(),
          protocol: 'HTTP/1.1',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1640995200,
          authorizer: null
        },
        body: null,
        isBase64Encoded: false,
        stageVariables: null,
        multiValueQueryStringParameters: null
      };

      const result = await handler(apiEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ status: 'healthy' });
    });

    it('should handle health check requests', async () => {
      const healthEvent = {
        httpMethod: 'GET',
        path: '/health'
      };

      const result = await handler(healthEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
      expect(require('../handlers/health').healthCheckHandler).toHaveBeenCalledWith('test-request-id');
    });

    it('should handle CORS preflight requests', async () => {
      const corsEvent = {
        httpMethod: 'OPTIONS',
        path: '/test',
        headers: {
          'origin': 'https://example.com'
        }
      };

      const result = await handler(corsEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
      expect(require('../../utils/cors').createOptionsResponse).toHaveBeenCalledWith('https://example.com');
    });

    it('should handle empty path gracefully', async () => {
      const emptyPathEvent = {
        httpMethod: 'GET',
        path: ''
      };

      const result = await handler(emptyPathEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
      expect(require('../handlers/health').healthCheckHandler).toHaveBeenCalledWith('test-request-id');
    });

    it('should handle null path gracefully', async () => {
      const nullPathEvent = {
        httpMethod: 'GET',
        path: null
      };

      const result = await handler(nullPathEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
      expect(require('../handlers/health').healthCheckHandler).toHaveBeenCalledWith('test-request-id');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null event', async () => {
      const result = await handler(null as any, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('INVALID_EVENT');
    });

    it('should handle undefined event', async () => {
      const result = await handler(undefined as any, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('INVALID_EVENT');
    });

    it('should handle non-object event', async () => {
      const result = await handler('not-an-object' as any, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('INVALID_EVENT');
    });

    it('should handle empty object event', async () => {
      const result = await handler({} as any, mockContext);

      expect(result.statusCode).toBe(400);
      // Empty object is detected as invalid (no recognizable properties), so returns INVALID_EVENT
      expect(JSON.parse(result.body).error.code).toBe('INVALID_EVENT');
    });

    it('should handle DynamoDB events', async () => {
      const dynamoEvent = {
        Records: [{
          eventSource: 'aws:dynamodb',
          eventName: 'INSERT',
          dynamodb: {
            Keys: { id: { S: 'test-id' } },
            NewImage: { name: { S: 'test-name' } }
          }
        }]
      };

      const result = await handler(dynamoEvent as any, mockContext);

      expect(result).toEqual({ statusCode: 200, body: 'DynamoDB event ignored' });
    });
  });

  describe('User Context Extraction', () => {
    it('should handle missing requestContext', async () => {
      const noRequestContextEvent = {
        httpMethod: 'POST',
        path: '/api/notifications/send'
      };

      const result = await handler(noRequestContextEvent as any, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error.code).toBe('UNAUTHORIZED');
    });

    it('should handle missing authorizer', async () => {
      const noAuthorizerEvent = {
        httpMethod: 'POST',
        path: '/api/notifications/send',
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          httpMethod: 'POST',
          requestId: 'test-request',
          resourceId: 'test-resource',
          resourcePath: '/api/notifications/send',
          stage: 'test',
          path: '/api/notifications/send',
          identity: createMockIdentity(),
          protocol: 'HTTP/1.1',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1640995200
        }
      };

      const result = await handler(noAuthorizerEvent as any, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Logging and Observability', () => {
    it('should log comprehensive event detection information', async () => {
      const sqsEvent: SQSEvent = {
        Records: [{
          messageId: 'test-message-id',
          receiptHandle: 'test-receipt-handle',
          body: JSON.stringify({ test: 'data' }),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1640995200000',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            ApproximateFirstReceiveTimestamp: '1640995200000'
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1'
        }]
      };

      await handler(sqsEvent, mockContext);

      const logger = require('../../utils/logger').logger;
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('STARTING EVENT TYPE DETECTION'),
        expect.objectContaining({
          requestId: 'test-request-id',
          eventKeys: expect.any(Array)
        })
      );
    });

    it('should log errors for invalid events', async () => {
      await handler(null as any, mockContext);

      const logger = require('../../utils/logger').logger;
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('INVALID EVENT OBJECT'),
        expect.any(Error),
        expect.objectContaining({
          requestId: 'test-request-id'
        })
      );
    });
  });
});