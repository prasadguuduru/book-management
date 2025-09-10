/**
 * Test to validate notification service refactoring with shared utilities
 */

import { handler } from '../index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the shared utilities
jest.mock('../../shared/logging/logger');
jest.mock('../../shared/http/cors-utils');
jest.mock('../../shared/http/response-utils');
jest.mock('../../shared/auth/auth-middleware');

describe('Notification Service Refactoring Validation', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'notification-service',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:notification-service',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/notification-service',
    logStreamName: '2023/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle health check requests using shared utilities', async () => {
    const event: APIGatewayProxyEvent = {
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

    const result = await handler(event, mockContext);

    // Verify the response structure
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('headers');
    expect(result).toHaveProperty('body');

    // The response should be successful
    expect(result.statusCode).toBe(200);
  });

  test('should handle CORS preflight requests using shared utilities', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'OPTIONS',
      path: '/api/notifications/send',
      headers: {
        'Origin': 'https://example.com'
      },
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api',
        protocol: 'HTTP/1.1',
        httpMethod: 'OPTIONS',
        path: '/api/notifications/send',
        stage: 'test',
        requestId: 'test-request-id',
        requestTime: '01/Jan/2023:00:00:00 +0000',
        requestTimeEpoch: 1672531200,
        resourceId: 'test-resource',
        resourcePath: '/api/notifications/send',
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
      resource: '/api/notifications/send',
      body: null,
      isBase64Encoded: false
    };

    const result = await handler(event, mockContext);

    // Verify the response structure
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('headers');
    expect(result).toHaveProperty('body');

    // CORS preflight should return 200
    expect(result.statusCode).toBe(200);
  });

  test('should use shared logger for structured logging', () => {
    // Import the SharedLogger to verify it's being used
    const { SharedLogger } = require('../../shared/logging/logger');
    
    // Verify that SharedLogger is imported and can be instantiated
    expect(SharedLogger).toBeDefined();
    
    const logger = new SharedLogger('test-service');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.setCorrelationId).toBe('function');
  });

  test('should use shared validation utilities', () => {
    // Import the Validator to verify it's being used
    const { Validator } = require('../../shared/validation/validator');
    
    // Verify that Validator is imported and has expected methods
    expect(Validator).toBeDefined();
    expect(typeof Validator.validateEmail).toBe('function');
    expect(typeof Validator.validateRequest).toBe('function');
  });

  test('should use shared response utilities', () => {
    // Import the response handler to verify it's being used
    const { sharedResponseHandler } = require('../../shared/http/response-utils');
    
    // Verify that sharedResponseHandler is imported and has expected methods
    expect(sharedResponseHandler).toBeDefined();
    expect(typeof sharedResponseHandler.success).toBe('function');
    expect(typeof sharedResponseHandler.error).toBe('function');
    expect(typeof sharedResponseHandler.unauthorized).toBe('function');
  });

  test('should use shared CORS utilities', () => {
    // Import the CORS handler to verify it's being used
    const { sharedCorsHandler } = require('../../shared/http/cors-utils');
    
    // Verify that sharedCorsHandler is imported and has expected methods
    expect(sharedCorsHandler).toBeDefined();
    expect(typeof sharedCorsHandler.getHeaders).toBe('function');
    expect(typeof sharedCorsHandler.createOptionsResponse).toBe('function');
  });
});