/**
 * Book Service Integration Test with LocalStack
 * 
 * These tests require LocalStack to be running:
 * docker run --rm -it -p 4566:4566 -p 4571:4571 localstack/localstack
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';
import { dynamoDBClient } from '@/data/dynamodb-client';
import { DynamoDB } from 'aws-sdk';

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

describe('Book Service Integration Test (LocalStack)', () => {
    let dynamoDB: DynamoDB;
    let createdBookId: string;

    beforeAll(async () => {
        // Create raw DynamoDB client for table operations
        dynamoDB = new DynamoDB({
            region: 'us-west-2',
            endpoint: 'http://localhost:4566', // LocalStack endpoint
            accessKeyId: 'test',
            secretAccessKey: 'test'
        });

        // Create table for testing
        try {
            const params: DynamoDB.CreateTableInput = {
                TableName: dynamoDBClient.getTableName(),
                KeySchema: [
                    { AttributeName: 'PK', KeyType: 'HASH' },
                    { AttributeName: 'SK', KeyType: 'RANGE' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'PK', AttributeType: 'S' },
                    { AttributeName: 'SK', AttributeType: 'S' },
                    { AttributeName: 'GSI1PK', AttributeType: 'S' },
                    { AttributeName: 'GSI1SK', AttributeType: 'S' },
                    { AttributeName: 'GSI2PK', AttributeType: 'S' },
                    { AttributeName: 'GSI2SK', AttributeType: 'S' }
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'GSI1',
                        KeySchema: [
                            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
                            { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' }
                    },
                    {
                        IndexName: 'GSI2',
                        KeySchema: [
                            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
                            { AttributeName: 'GSI2SK', KeyType: 'RANGE' }
                        ],
                        Projection: { ProjectionType: 'ALL' }
                    }
                ],
                BillingMode: 'PAY_PER_REQUEST'
            };
            
            await dynamoDB.createTable(params).promise();

            // Wait for table to be active
            await dynamoDB.waitFor('tableExists', {
                TableName: dynamoDBClient.getTableName()
            }).promise();
            
            console.log('DynamoDB table created successfully for integration tests');
        } catch (error) {
            console.log('Table creation failed or table already exists:', error);
        }
    }, 60000); // 60 second timeout for table creation

    afterAll(async () => {
        // Clean up table
        try {
            await dynamoDB.deleteTable({
                TableName: dynamoDBClient.getTableName()
            }).promise();
            console.log('DynamoDB table deleted successfully');
        } catch (error) {
            console.log('Table deletion failed:', error);
        }
    }, 30000); // 30 second timeout for table deletion

    it('should create a book successfully with real DynamoDB', async () => {
        const bookData = {
            title: 'Integration Test Book',
            description: 'A book created during integration testing',
            content: 'This is the content of the integration test book.',
            genre: 'fiction',
            tags: ['integration', 'test', 'localstack']
        };

        const event = createMockEvent('POST', '/books', bookData);

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Book created successfully');
        expect(body.book).toBeDefined();
        expect(body.book.title).toBe('Integration Test Book');
        expect(body.book.status).toBe('DRAFT');
        expect(body.book.authorId).toBe('author-123');
        
        // Store the created book ID for cleanup
        createdBookId = body.book.bookId;
    }, 30000);

    it('should retrieve books by status from real DynamoDB', async () => {
        const event = createMockEvent('GET', '/books/status/draft');

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.books).toBeDefined();
        expect(Array.isArray(body.books)).toBe(true);
        
        // Should find at least the book we created
        const createdBook = body.books.find((book: any) => book.bookId === createdBookId);
        expect(createdBook).toBeDefined();
        expect(createdBook.title).toBe('Integration Test Book');
    }, 15000);

    it('should get a specific book by ID from real DynamoDB', async () => {
        if (!createdBookId) {
            throw new Error('No book ID available - previous test may have failed');
        }

        const event = createMockEvent('GET', `/books/${createdBookId}`);

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.book).toBeDefined();
        expect(body.book.bookId).toBe(createdBookId);
        expect(body.book.title).toBe('Integration Test Book');
        expect(body.book.status).toBe('DRAFT');
    }, 15000);

    it('should update a book in real DynamoDB', async () => {
        if (!createdBookId) {
            throw new Error('No book ID available - previous test may have failed');
        }

        const updateData = {
            title: 'Updated Integration Test Book',
            description: 'Updated description for integration testing'
        };

        const event = createMockEvent('PUT', `/books/${createdBookId}`, updateData);

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.message).toBe('Book updated successfully');
        expect(body.book.title).toBe('Updated Integration Test Book');
        expect(body.book.description).toBe('Updated description for integration testing');
    }, 15000);
});