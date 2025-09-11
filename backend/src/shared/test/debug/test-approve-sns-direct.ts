#!/usr/bin/env npx ts-node

/**
 * Test Approve SNS Direct
 * Creates a book, submits it, then approves it to test SNS event publishing
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const lambda = new AWS.Lambda();

async function testApprovalSNSFlow() {
  console.log('🔍 Testing Approval SNS Flow...');

  try {
    const timestamp = Date.now();

    // Step 1: Create a book as AUTHOR
    console.log('📚 Step 1: Creating book as AUTHOR...');
    
    const createBookEvent = {
      httpMethod: 'POST',
      path: '/api/books',
      resource: '/api/books',
      pathParameters: null,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Approval Test Book ${timestamp}`,
        description: 'Testing approval flow with SNS events',
        genre: 'fiction',
        content: 'This book will test the approval workflow and SNS event publishing.'
      }),
      requestContext: {
        requestId: `test-create-${timestamp}`,
        stage: 'qa',
        authorizer: {
          userId: `test-author-${timestamp}`,
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
    console.log('Create Response Status:', createResponse.statusCode);
    
    if (createResponse.statusCode !== 201) {
      console.log('❌ Book creation failed:', JSON.stringify(createResponse, null, 2));
      return;
    }

    const responseBody = JSON.parse(createResponse.body);
    const bookId = responseBody.book?.bookId;
    
    if (!bookId) {
      console.log('❌ No bookId in response');
      return;
    }

    console.log('✅ Book created:', bookId);

    // Step 2: Submit book for editing
    console.log('🔄 Step 2: Submitting book for editing...');
    
    const submitEvent = {
      httpMethod: 'POST',
      path: `/api/workflow/books/${bookId}/transition`,
      resource: '/api/workflow/{proxy+}',
      pathParameters: {
        proxy: `books/${bookId}/transition`
      },
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SUBMIT',
        comments: 'Submitting for approval test'
      }),
      requestContext: {
        requestId: `test-submit-${timestamp}`,
        stage: 'qa',
        authorizer: {
          userId: `test-author-${timestamp}`,
          role: 'AUTHOR',
          email: 'test-author@example.com'
        }
      },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      isBase64Encoded: false
    };

    const submitResult = await lambda.invoke({
      FunctionName: 'qa-workflow-service',
      Payload: JSON.stringify(submitEvent),
      InvocationType: 'RequestResponse'
    }).promise();

    if (submitResult.Payload) {
      const submitResponse = JSON.parse(submitResult.Payload.toString());
      console.log('Submit Response Status:', submitResponse.statusCode);
      
      if (submitResponse.statusCode !== 200) {
        console.log('❌ Book submission failed:', JSON.stringify(submitResponse, null, 2));
        return;
      }
    }

    console.log('✅ Book submitted for editing');
    console.log('⏳ Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Approve book as EDITOR
    console.log('✅ Step 3: Approving book as EDITOR...');
    
    const approveEvent = {
      httpMethod: 'POST',
      path: `/api/workflow/books/${bookId}/transition`,
      resource: '/api/workflow/{proxy+}',
      pathParameters: {
        proxy: `books/${bookId}/transition`
      },
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'APPROVE',
        comments: 'Approving for SNS test'
      }),
      requestContext: {
        requestId: `test-approve-${timestamp}`,
        stage: 'qa',
        authorizer: {
          userId: `test-editor-${timestamp}`,
          role: 'EDITOR',
          email: 'test-editor@example.com'
        }
      },
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      isBase64Encoded: false
    };

    console.log('📤 Invoking workflow service for approval...');
    
    const approveResult = await lambda.invoke({
      FunctionName: 'qa-workflow-service',
      Payload: JSON.stringify(approveEvent),
      InvocationType: 'RequestResponse'
    }).promise();

    if (approveResult.Payload) {
      const approveResponse = JSON.parse(approveResult.Payload.toString());
      console.log('Approve Response Status:', approveResponse.statusCode);
      console.log('Approve Response Body:', JSON.stringify(approveResponse.body ? JSON.parse(approveResponse.body) : approveResponse, null, 2));

      if (approveResponse.statusCode === 200) {
        console.log('✅ Book approved successfully!');
        console.log('⏳ Waiting 15 seconds for SNS event processing...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        console.log('🔍 Now check:');
        console.log('1. SNS CloudWatch metrics for NumberOfMessagesPublished');
        console.log('2. Notification service logs for event processing');
        console.log('3. Workflow service logs for event publishing attempts');
        
      } else {
        console.log('❌ Book approval failed');
      }
    }

    console.log(`📖 Book ID for reference: ${bookId}`);

  } catch (error) {
    console.error('❌ Error in approval SNS test:', error);
  }
}

// Run the test
testApprovalSNSFlow().then(() => {
  console.log('🎯 Approval SNS test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});