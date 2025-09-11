#!/usr/bin/env npx ts-node

/**
 * Test Workflow Service Integration
 * Tests if calling the workflow service directly triggers notifications
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const lambda = new AWS.Lambda();

async function testWorkflowServiceIntegration() {
  console.log('🔍 Testing Workflow Service Integration...');

  try {
    // Test data for a workflow transition
    const testEvent = {
      httpMethod: 'POST',
      path: '/api/workflow/books/test-book-workflow/transition',
      resource: '/api/workflow/{proxy+}',
      pathParameters: {
        proxy: 'books/test-book-workflow/transition'
      },
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'SUBMIT',
        comments: 'Testing workflow service integration'
      }),
      requestContext: {
        requestId: 'test-workflow-integration',
        stage: 'qa',
        authorizer: {
          userId: 'test-author-workflow',
          role: 'AUTHOR',
          email: 'test-author@example.com'
        }
      },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      isBase64Encoded: false
    };

    console.log('📤 Invoking workflow service Lambda...');
    console.log('Event:', JSON.stringify(testEvent, null, 2));

    const result = await lambda.invoke({
      FunctionName: 'qa-workflow-service',
      Payload: JSON.stringify(testEvent),
      InvocationType: 'RequestResponse'
    }).promise();

    if (result.Payload) {
      const response = JSON.parse(result.Payload.toString());
      console.log('✅ Workflow service response:');
      console.log('Status Code:', response.statusCode);
      console.log('Response Body:', JSON.stringify(response.body ? JSON.parse(response.body) : response, null, 2));

      if (response.statusCode === 200 || response.statusCode === 201) {
        console.log('🎉 Workflow service call successful!');
        console.log('⏳ Waiting 10 seconds for event processing...');
        
        // Wait for event processing
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log('🔍 Check notification service logs for processing results');
      } else {
        console.log('❌ Workflow service call failed');
      }
    }

  } catch (error) {
    console.error('❌ Error testing workflow service integration:', error);
  }
}

// Run the test
testWorkflowServiceIntegration().then(() => {
  console.log('🎯 Workflow service integration test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});