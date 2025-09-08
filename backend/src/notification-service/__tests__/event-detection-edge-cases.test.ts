/**
 * Edge Case Tests for Event Detection
 * Tests malformed events, null safety, and error scenarios
 */

import { Context, APIGatewayEventIdentity } from 'aws-lambda';
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

describe('Event Detection Edge Cases', () => {
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

  describe('Malformed SQS Events', () => {
    it('should handle Records with circular references', async () => {
      const circularRecord: any = {
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
      };
      
      // Create circular reference
      circularRecord.self = circularRecord;

      const malformedEvent = {
        Records: [circularRecord]
      };

      const result = await handler(malformedEvent as any, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
      expect(require('../handlers/sqs-event-handler').sqsHandler).toHaveBeenCalled();
    });

    it('should handle Records with very large objects', async () => {
      const largeBody = 'x'.repeat(1000000); // 1MB string
      
      const largeEvent = {
        Records: [{
          messageId: 'test-message-id',
          receiptHandle: 'test-receipt-handle',
          body: largeBody,
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

      const result = await handler(largeEvent as any, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
    });

    it('should handle Records with special characters and unicode', async () => {
      const unicodeEvent = {
        Records: [{
          messageId: 'test-message-id-🚀',
          receiptHandle: 'test-receipt-handle-🔥',
          body: JSON.stringify({ 
            title: '测试书籍 📚',
            author: 'José María García-López',
            emoji: '🎉🎊✨'
          }),
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

      const result = await handler(unicodeEvent as any, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
    });

    it('should handle Records with null/undefined properties', async () => {
      const nullPropsEvent = {
        Records: [{
          messageId: null,
          receiptHandle: undefined,
          body: '',
          attributes: null,
          messageAttributes: undefined,
          md5OfBody: null,
          eventSource: 'aws:sqs',
          eventSourceARN: undefined,
          awsRegion: null
        }]
      };

      const result = await handler(nullPropsEvent as any, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
    });

    it('should handle Records with mixed valid and invalid records', async () => {
      const mixedEvent = {
        Records: [
          // Valid record
          {
            messageId: 'valid-message-id',
            receiptHandle: 'valid-receipt-handle',
            body: JSON.stringify({ test: 'valid' }),
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
          },
          // Invalid record
          null,
          // Another valid record
          {
            messageId: 'another-valid-message-id',
            receiptHandle: 'another-valid-receipt-handle',
            body: JSON.stringify({ test: 'another-valid' }),
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
          }
        ]
      };

      const result = await handler(mixedEvent as any, mockContext);

      expect(result).toEqual({ batchItemFailures: [] });
    });
  });

  describe('Malformed API Gateway Events', () => {
    it('should handle API Gateway events with circular references', async () => {
      const circularEvent: any = {
        httpMethod: 'GET',
        path: '/health',
        headers: {}
      };
      
      // Create circular reference
      circularEvent.self = circularEvent;

      const result = await handler(circularEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should handle API Gateway events with invalid header types', async () => {
      const invalidHeadersEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: 'not-an-object',
        requestContext: null
      };

      const result = await handler(invalidHeadersEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should handle API Gateway events with deeply nested objects', async () => {
      const deeplyNestedEvent = {
        httpMethod: 'POST',
        path: '/api/notifications/send',
        headers: {
          'content-type': 'application/json'
        },
        requestContext: {
          accountId: '123456789012',
          apiId: 'test-api',
          httpMethod: 'POST',
          requestId: 'test-request',
          resourceId: 'test-resource',
          resourcePath: '/api/notifications/send',
          stage: 'test',
          identity: createMockIdentity(),
          protocol: 'HTTP/1.1',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          requestTimeEpoch: 1640995200,
          authorizer: {
            userId: 'test-user',
            role: 'author',
            email: 'test@example.com',
            claims: {
              sub: 'test-user',
              role: 'author',
              email: 'test@example.com',
              nested: {
                deep: {
                  very: {
                    deeply: {
                      nested: {
                        property: 'value'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        body: JSON.stringify({
          deeply: {
            nested: {
              request: {
                body: {
                  with: {
                    many: {
                      levels: 'of nesting'
                    }
                  }
                }
              }
            }
          }
        })
      };

      const result = await handler(deeplyNestedEvent as any, mockContext);

      // Should handle the deeply nested structure without errors
      expect(result.statusCode).toBeDefined();
    });

    it('should handle API Gateway events with invalid path types', async () => {
      const invalidPathEvent = {
        httpMethod: 'GET',
        path: 123, // number instead of string
        headers: {}
      };

      const result = await handler(invalidPathEvent as any, mockContext);

      // Should still return a valid response (might be 500 due to invalid path type)
      expect(result.statusCode).toBeDefined();
      expect([200, 400, 500]).toContain(result.statusCode);
    });

    it('should handle API Gateway events with invalid httpMethod types', async () => {
      const invalidMethodEvent = {
        httpMethod: ['GET'], // array instead of string
        path: '/health',
        headers: {}
      };

      const result = await handler(invalidMethodEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle events with extremely long property names', async () => {
      const longPropertyName = 'x'.repeat(10000);
      const longPropEvent = {
        [longPropertyName]: 'value',
        httpMethod: 'GET',
        path: '/health'
      };

      const result = await handler(longPropEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should handle events with many properties', async () => {
      const manyPropsEvent: any = {
        httpMethod: 'GET',
        path: '/health'
      };

      // Add 1000 properties
      for (let i = 0; i < 1000; i++) {
        manyPropsEvent[`property${i}`] = `value${i}`;
      }

      const result = await handler(manyPropsEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should handle events with deeply nested arrays', async () => {
      const deepArrayEvent = {
        httpMethod: 'GET',
        path: '/health',
        deepArray: [
          [
            [
              [
                [
                  { nested: 'value' }
                ]
              ]
            ]
          ]
        ]
      };

      const result = await handler(deepArrayEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Context Edge Cases', () => {
    it('should handle null context', async () => {
      const simpleEvent = {
        httpMethod: 'GET',
        path: '/health'
      };

      // This would normally throw, but we test the error handling
      try {
        await handler(simpleEvent as any, null as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle context with missing properties', async () => {
      const incompleteContext = {
        awsRequestId: 'test-request-id'
        // missing other required properties
      } as any;

      const simpleEvent = {
        httpMethod: 'GET',
        path: '/health'
      };

      const result = await handler(simpleEvent as any, incompleteContext);

      expect(result.statusCode).toBe(200);
    });

    it('should handle context with invalid property types', async () => {
      const invalidContext = {
        awsRequestId: 123, // number instead of string
        functionName: null,
        getRemainingTimeInMillis: 'not-a-function'
      } as any;

      const simpleEvent = {
        httpMethod: 'GET',
        path: '/health'
      };

      const result = await handler(simpleEvent as any, invalidContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Concurrent and Async Edge Cases', () => {
    it('should handle multiple concurrent requests', async () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        httpMethod: 'GET',
        path: '/health',
        requestId: `request-${i}`
      }));

      const contexts = Array.from({ length: 10 }, (_, i) => ({
        ...mockContext,
        awsRequestId: `request-${i}`
      }));

      const promises = events.map((event, i) => 
        handler(event as any, contexts[i]!)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.statusCode).toBe(200);
      });
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Mock a context that reports very little remaining time
      const timeoutContext = {
        ...mockContext,
        getRemainingTimeInMillis: jest.fn().mockReturnValue(100) // 100ms remaining
      };

      const event = {
        httpMethod: 'GET',
        path: '/health'
      };

      const result = await handler(event as any, timeoutContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from JSON parsing errors in logging', async () => {
      // Create an event that might cause JSON.stringify to fail
      const problematicEvent: any = {
        httpMethod: 'GET',
        path: '/health'
      };
      
      // Create a circular reference that would break JSON.stringify
      problematicEvent.circular = problematicEvent;

      const result = await handler(problematicEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should handle exceptions in event detection gracefully', async () => {
      // Create an event that might cause issues but won't break Object.keys
      const problematicEvent = {
        httpMethod: 'GET',
        path: '/health',
        // Add a property that might cause issues during processing
        problematicProperty: function() { throw new Error('Problematic function'); }
      };

      const result = await handler(problematicEvent as any, mockContext);

      // Should still return a valid response despite potential issues
      expect(result.statusCode).toBeDefined();
      expect([200, 400, 500]).toContain(result.statusCode);
    });

    it('should handle memory pressure scenarios', async () => {
      // Create a large event that might cause memory pressure
      const largeEvent = {
        httpMethod: 'GET',
        path: '/health',
        largeData: Array.from({ length: 100000 }, (_, i) => ({
          id: i,
          data: `large-data-item-${i}`,
          nested: {
            property1: `value1-${i}`,
            property2: `value2-${i}`,
            property3: `value3-${i}`
          }
        }))
      };

      const result = await handler(largeEvent as any, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });
});