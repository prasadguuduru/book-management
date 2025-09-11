#!/usr/bin/env ts-node

/**
 * Test script to invoke the notification Lambda with a properly formatted event
 */

import { Lambda } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const lambda = new Lambda({ region: 'us-east-1' });

async function testLambdaWithValidEvent() {
  console.log('🧪 Testing Lambda with valid event format...');

  const timestamp = new Date().toISOString();
  const eventId = uuidv4();

  // Create a test SQS event with proper validation format
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
            eventId: eventId, // Valid UUID
            timestamp: timestamp,
            source: 'debug-script', // Valid source
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
          Timestamp: timestamp,
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
    console.log('📤 Invoking Lambda function with valid event...');
    console.log('Event ID:', eventId);
    console.log('Source: debug-script');
    console.log('Timestamp:', timestamp);

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
      
      if (payload.batchItemFailures && payload.batchItemFailures.length === 0) {
        console.log('🎉 SUCCESS: No batch failures - event processed successfully!');
      } else if (payload.batchItemFailures && payload.batchItemFailures.length > 0) {
        console.log('❌ FAILURE: Event processing failed');
      }
    }

  } catch (error) {
    console.error('❌ Lambda invocation failed:', error);
  }

  // Wait a moment then check logs
  console.log('⏳ Waiting 3 seconds then checking logs...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('🔍 Check the Lambda logs for detailed processing information');
}

testLambdaWithValidEvent().catch(console.error);