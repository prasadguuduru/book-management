#!/usr/bin/env ts-node

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });
const lambdaClient = new LambdaClient({ region: 'us-east-1' });

async function triggerApprovalAndCheckLogs() {
  console.log('🔍 Triggering Approval and Checking Logs...\n');

  // Step 1: Create a book first
  console.log('📚 Step 1: Creating a book...');
  const createBookPayload = {
    httpMethod: 'POST',
    path: '/api/books',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    requestContext: {
      authorizer: {
        userId: 'test-author-123',
        role: 'AUTHOR',
        email: 'author@test.com'
      }
    },
    body: JSON.stringify({
      title: 'Test Book for Approval',
      description: 'A test book to trigger approval workflow',
      genre: 'FICTION',
      content: 'This is test content for the book.',
      tags: ['test', 'approval']
    })
  };

  try {
    const createResult = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'qa-book-service',
      Payload: JSON.stringify(createBookPayload)
    }));

    const createResponse = JSON.parse(new TextDecoder().decode(createResult.Payload));
    console.log('Create Response:', JSON.stringify(createResponse, null, 2));

    if (createResponse.statusCode !== 201) {
      console.log('❌ Failed to create book, cannot proceed with approval test');
      return;
    }

    const responseBody = JSON.parse(createResponse.body);
    const bookId = responseBody.book?.bookId;

    if (!bookId) {
      console.log('❌ No book ID returned, cannot proceed with approval test');
      return;
    }

    console.log(`✅ Book created with ID: ${bookId}`);

    // Step 2: Submit the book for editing
    console.log('\n📝 Step 2: Submitting book for editing...');
    const submitPayload = {
      httpMethod: 'POST',
      path: `/api/workflow/books/${bookId}/transition`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      pathParameters: {
        proxy: `books/${bookId}/transition`
      },
      requestContext: {
        authorizer: {
          userId: 'test-author-123',
          role: 'AUTHOR',
          email: 'author@test.com'
        }
      },
      body: JSON.stringify({
        action: 'SUBMIT',
        comments: 'Ready for editorial review'
      })
    };

    const submitResult = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'qa-workflow-service',
      Payload: JSON.stringify(submitPayload)
    }));

    const submitResponse = JSON.parse(new TextDecoder().decode(submitResult.Payload));
    console.log('Submit Response:', JSON.stringify(submitResponse, null, 2));

    if (submitResponse.statusCode !== 200) {
      console.log('❌ Failed to submit book, cannot proceed with approval test');
      return;
    }

    console.log('✅ Book submitted for editing');

    // Step 3: Approve the book (this should trigger the event)
    console.log('\n✅ Step 3: Approving book (this should trigger event publishing)...');
    const approvePayload = {
      httpMethod: 'POST',
      path: `/api/workflow/books/${bookId}/transition`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      pathParameters: {
        proxy: `books/${bookId}/transition`
      },
      requestContext: {
        authorizer: {
          userId: 'test-editor-456',
          role: 'EDITOR',
          email: 'editor@test.com'
        }
      },
      body: JSON.stringify({
        action: 'APPROVE',
        comments: 'Book approved after editorial review'
      })
    };

    const approveResult = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'qa-workflow-service',
      Payload: JSON.stringify(approvePayload)
    }));

    const approveResponse = JSON.parse(new TextDecoder().decode(approveResult.Payload));
    console.log('Approve Response:', JSON.stringify(approveResponse, null, 2));

    if (approveResponse.statusCode !== 200) {
      console.log('❌ Failed to approve book');
      return;
    }

    console.log('✅ Book approved successfully!');

    // Step 4: Check CloudWatch logs for the workflow service
    console.log('\n📋 Step 4: Checking CloudWatch logs for event publishing...');
    
    // Wait a moment for logs to appear
    await new Promise(resolve => setTimeout(resolve, 5000));

    const logGroups = ['/aws/lambda/qa-workflow-service'];
    
    for (const logGroup of logGroups) {
      console.log(`\n🔍 Checking logs in ${logGroup}:`);
      
      try {
        // Look for our enhanced logging messages
        const logEvents = await logsClient.send(new FilterLogEventsCommand({
          logGroupName: logGroup,
          startTime: Date.now() - (5 * 60 * 1000), // Last 5 minutes
          filterPattern: '"🔧 ATTEMPTING TO CREATE SNS EVENT PUBLISHER" OR "❌ FAILED TO CREATE SNS EVENT PUBLISHER" OR "🚨 CRITICAL: USING MOCK PUBLISHER" OR "✅ SNS EVENT PUBLISHER CREATED SUCCESSFULLY"'
        }));

        if (logEvents.events && logEvents.events.length > 0) {
          console.log('📝 Found relevant log events:');
          logEvents.events.forEach(event => {
            console.log(`  ${new Date(event.timestamp!).toISOString()}: ${event.message}`);
          });
        } else {
          console.log('❌ No relevant log events found');
        }

        // Also check for general approval events
        const approvalEvents = await logsClient.send(new FilterLogEventsCommand({
          logGroupName: logGroup,
          startTime: Date.now() - (5 * 60 * 1000),
          filterPattern: `"${bookId}" AND ("APPROVE" OR "approved" OR "READY_FOR_PUBLICATION")`
        }));

        if (approvalEvents.events && approvalEvents.events.length > 0) {
          console.log('\n📝 Found approval-related events:');
          approvalEvents.events.forEach(event => {
            console.log(`  ${new Date(event.timestamp!).toISOString()}: ${event.message}`);
          });
        }

      } catch (error) {
        console.log(`⚠️  Could not check logs in ${logGroup}: ${error}`);
      }
    }

  } catch (error) {
    console.error('❌ Error during approval test:', error);
  }
}

// Run the test
triggerApprovalAndCheckLogs().catch(console.error);