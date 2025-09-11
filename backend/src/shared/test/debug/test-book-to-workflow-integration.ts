#!/usr/bin/env npx ts-node

/**
 * Test Book to Workflow Service Integration
 * Creates a book via book service, then transitions it via workflow service
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
    region: 'us-east-1'
});

const lambda = new AWS.Lambda();

async function testBookToWorkflowIntegration() {
    console.log('🔍 Testing Book to Workflow Service Integration...');

    try {
        // Step 1: Create a book via book service
        console.log('📚 Step 1: Creating book via book service...');

        const createBookEvent = {
            httpMethod: 'POST',
            path: '/api/books',
            resource: '/api/books',
            pathParameters: null,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: 'Test Book for Workflow Integration',
                description: 'Testing integration between book service and workflow service',
                genre: 'fiction',
                content: 'This is test content for workflow integration testing.'
            }),
            requestContext: {
                requestId: 'test-book-creation',
                stage: 'qa',
                authorizer: {
                    userId: 'test-author-integration',
                    role: 'AUTHOR',
                    email: 'test-author@example.com'
                }
            },
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            isBase64Encoded: false
        };

        const createResult = await lambda.invoke({
            FunctionName: 'qa-book-service',
            Payload: JSON.stringify(createBookEvent),
            InvocationType: 'RequestResponse'
        }).promise();

        if (!createResult.Payload) {
            throw new Error('No response from book service');
        }

        const createResponse = JSON.parse(createResult.Payload.toString());
        console.log('📚 Book creation response:');
        console.log('Status Code:', createResponse.statusCode);

        if (createResponse.statusCode !== 201) {
            console.log('❌ Book creation failed:', JSON.stringify(createResponse, null, 2));
            return;
        }

        const responseBody = JSON.parse(createResponse.body);
        console.log('📋 Full response body:', JSON.stringify(responseBody, null, 2));

        const bookId = responseBody.book?.bookId;
        if (!bookId) {
            console.log('❌ No bookId found in response');
            return;
        }
        console.log('✅ Book created successfully with ID:', bookId);

        // Step 2: Submit book via workflow service
        console.log('🔄 Step 2: Submitting book via workflow service...');

        const workflowEvent = {
            httpMethod: 'POST',
            path: `/api/workflow/books/${bookId}/transition`,
            resource: '/api/workflow/{proxy+}',
            pathParameters: {
                proxy: `books/${bookId}/transition`
            },
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'SUBMIT',
                comments: 'Testing workflow service integration after book creation'
            }),
            requestContext: {
                requestId: 'test-workflow-transition',
                stage: 'qa',
                authorizer: {
                    userId: 'test-author-integration',
                    role: 'AUTHOR',
                    email: 'test-author@example.com'
                }
            },
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            isBase64Encoded: false
        };

        console.log('📤 Invoking workflow service for transition...');

        const workflowResult = await lambda.invoke({
            FunctionName: 'qa-workflow-service',
            Payload: JSON.stringify(workflowEvent),
            InvocationType: 'RequestResponse'
        }).promise();

        if (workflowResult.Payload) {
            const workflowResponse = JSON.parse(workflowResult.Payload.toString());
            console.log('🔄 Workflow service response:');
            console.log('Status Code:', workflowResponse.statusCode);
            console.log('Response Body:', JSON.stringify(workflowResponse.body ? JSON.parse(workflowResponse.body) : workflowResponse, null, 2));

            if (workflowResponse.statusCode === 200) {
                console.log('🎉 Workflow transition successful!');
                console.log('⏳ Waiting 15 seconds for event processing...');

                // Wait for event processing
                await new Promise(resolve => setTimeout(resolve, 15000));

                console.log('🔍 Now check notification service logs for processing results');
                console.log('📋 You should see a book_status_changed event being processed');
            } else {
                console.log('❌ Workflow transition failed');
            }
        }

    } catch (error) {
        console.error('❌ Error testing book to workflow integration:', error);
    }
}

// Run the test
testBookToWorkflowIntegration().then(() => {
    console.log('🎯 Book to workflow integration test completed');
}).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});