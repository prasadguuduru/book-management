#!/usr/bin/env ts-node

/**
 * Test script to invoke the notification Lambda directly with an SQS event
 */

import { Lambda } from 'aws-sdk';

const lambda = new Lambda({ region: 'us-east-1' });

async function testLambdaDirectSQS() {
  console.log('🧪 Testing Lambda with direct SQS event...');

  // Create a test SQS event that matches what would come from our queue
  const testSQSEvent = {
    Records: [
      {
        messageId: 'test-message-id',
        receiptHandle: 'test-receipt-handle',
        body: JSON.stringify({
          Type: 'Notification',
          MessageId: 'test-sns-message-id',
          TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events',
          Message: JSON.stringify({
            eventType: 'book_status_changed',
            eventId: 'test-event-id',
            timestamp: new Date().toISOString(),
            source: 'direct-lambda-test',
            version: '1.0',
            data: {
              bookId: 'test-book-id',
              title: 'Test Book',
              author: 'Test Author',
              previousStatus: 'DRAFT',
              newStatus: 'SUBMITTED_FOR_EDITING',
              changedBy: 'test-user',
              metadata: {
                notificationType: 'book_submitted'
              }
            }
          }),
          Timestamp: new Date().toISOString(),
          MessageAttributes: {
            eventType: {
              Type: 'String',
              Value: 'book_status_changed'
            }
          }
        }),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: Date.now().toString(),
          SenderId: 'test-sender',
          ApproximateFirstReceiveTimestamp: Date.now().toString()
        },
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue',
        awsRegion: 'us-east-1'
      }
    ]
  };

  try {
    console.log('📤 Invoking Lambda function...');
    console.log('Event structure:', JSON.stringify(testSQSEvent, null, 2));

    const result = await lambda.invoke({
      FunctionName: 'qa-notification-service',
      Payload: JSON.stringify(testSQSEvent),
      InvocationType: 'RequestResponse'
    }).promise();

    console.log('✅ Lambda invocation completed');
    console.log('Status Code:', result.StatusCode);
    
    if (result.Payload) {
      const payload = JSON.parse(result.Payload.toString());
      console.log('Response:', JSON.stringify(payload, null, 2));
    }

    if (result.LogResult) {
      const logs = Buffer.from(result.LogResult, 'base64').toString();
      console.log('📋 Lambda Logs:');
      console.log(logs);
    }

  } catch (error) {
    console.error('❌ Lambda invocation failed:', error);
  }
}

testLambdaDirectSQS().catch(console.error);