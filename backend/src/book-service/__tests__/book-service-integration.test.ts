/**
 * Book Service Integration Test - Focused Unit Tests
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

describe('Book Service Integration Test', () => {
    it('should handle health check endpoint', async () => {
        const event = createMockEvent('GET', '/health');

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.status).toBe('healthy');
        expect(body.service).toBe('book-service');
    });

    it('should handle CORS preflight requests', async () => {
        const event = createMockEvent('OPTIONS', '/books');

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        expect(result.headers).toBeDefined();
        expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
        expect(result.headers!['Access-Control-Allow-Methods']).toContain('POST');
        expect(result.headers!['Access-Control-Allow-Headers']).toContain('Content-Type');
    });

    it('should handle invalid book creation', async () => {
        const invalidBookData = {
            title: '', // Invalid: empty title
            description: 'A test book',
            content: 'Content',
            genre: 'fiction',
            tags: []
        };

        const event = createMockEvent('POST', '/books', invalidBookData);

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.error.code).toBe('VALIDATION_FAILED');
        expect(body.error.details).toContain('Title is required');
    });

    it('should reject book creation by non-author', async () => {
        const bookData = {
            title: 'Test Book',
            description: 'A test book',
            content: 'Content',
            genre: 'fiction',
            tags: []
        };

        const event = createMockEvent('POST', '/books', bookData, null, null, {
            userId: 'reader-123',
            role: 'READER',
            email: 'reader@test.com'
        });

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(403);
        const body = JSON.parse(result.body);
        expect(body.error.code).toBe('FORBIDDEN');
        expect(body.error.message).toBe('Only authors can create books');
    });

    it('should handle unknown endpoints', async () => {
        const event = createMockEvent('GET', '/unknown-endpoint');

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(404);
        const body = JSON.parse(result.body);
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Endpoint not found: GET /unknown-endpoint');
    });
});