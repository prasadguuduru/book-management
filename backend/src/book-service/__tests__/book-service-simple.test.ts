/**
 * Simple Book Service Test
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'book-service',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:book-service',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/book-service',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn()
};

const createMockEvent = (
  httpMethod: string,
  path: string,
  body?: any,
  pathParameters?: any,
  queryStringParameters?: any,
  authorizer?: any
): APIGatewayProxyEvent => ({
  httpMethod,
  path,
  body: body ? JSON.stringify(body) : null,
  pathParameters: pathParameters || null,
  queryStringParameters: queryStringParameters || null,
  headers: {},
  multiValueHeaders: {},
  isBase64Encoded: false,
  resource: '',
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    authorizer: authorizer !== null ? (authorizer || {
      userId: 'author-123',
      role: 'AUTHOR',
      email: 'author@test.com'
    }) : null,
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
    requestId: 'test-request',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: 1704067200,
    resourceId: 'test-resource',
    resourcePath: path,
    stage: 'test'
  },
  multiValueQueryStringParameters: null
});

describe('Book Service Simple Test', () => {
  it('should return health status', async () => {
    const event = createMockEvent('GET', '/health');
    
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('book-service');
  });

  it('should handle CORS preflight', async () => {
    const event = createMockEvent('OPTIONS', '/books');
    
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.body).toBe('');
  });

  it('should handle missing authorization', async () => {
    const event = createMockEvent('GET', '/books', null, null, null, null);
    
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});