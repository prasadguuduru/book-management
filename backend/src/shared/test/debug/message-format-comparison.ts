#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const sqs = new AWS.SQS();

async function getActualSQSMessage() {
  console.log('🔍 Getting actual SQS message from queue...\n');
  
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  try {
    // Receive a message from the queue (without deleting it)
    const result = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 1,
      VisibilityTimeout: 30 // Give us time to examine it
    }).promise();
    
    if (!result.Messages || result.Messages.length === 0) {
      console.log('❌ No messages in queue');
      return null;
    }
    
    const message = result.Messages[0];
    if (!message) {
      console.log('❌ Message is undefined');
      return null;
    }
    
    console.log('✅ Found SQS message:');
    console.log('📋 Message ID:', message.MessageId);
    console.log('� Receipt SHandle:', message.ReceiptHandle?.substring(0, 50) + '...');
    console.log('📋 Body length:', message.Body?.length);
    console.log('📋 Attributes:', JSON.stringify(message.Attributes, null, 2));
    console.log('📋 Message Attributes:', JSON.stringify(message.MessageAttributes, null, 2));
    
    console.log('\n📄 Raw SQS Body:');
    console.log(message.Body);
    
    if (message.Body) {
      try {
        const parsedBody = JSON.parse(message.Body);
        console.log('\n📄 Parsed SQS Body:');
        console.log(JSON.stringify(parsedBody, null, 2));
        
        if (parsedBody.Message) {
          console.log('\n📄 SNS Message Content:');
          try {
            const snsMessage = JSON.parse(parsedBody.Message);
            console.log(JSON.stringify(snsMessage, null, 2));
          } catch (e) {
            console.log('Raw SNS Message:', parsedBody.Message);
          }
        }
      } catch (e) {
        console.log('❌ Could not parse SQS body as JSON');
      }
    }
    
    // Make the message visible again by changing visibility timeout to 0
    if (message.ReceiptHandle) {
      await sqs.changeMessageVisibility({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle,
        VisibilityTimeout: 0
      }).promise();
    }
    
    return message;
    
  } catch (error) {
    console.error('❌ Error getting SQS message:', error);
    return null;
  }
}

async function showExpectedFormat() {
  console.log('\n📋 Expected format by notification service:');
  
  const expectedSQSRecord = {
    messageId: 'example-message-id',
    receiptHandle: 'example-receipt-handle',
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: 'sns-message-id',
      TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events',
      Message: JSON.stringify({
        eventType: 'book_status_changed',
        eventId: 'event-uuid',
        timestamp: '2025-09-07T10:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'book-123',
          title: 'Test Book',
          author: 'author-123',
          previousStatus: 'DRAFT',
          newStatus: 'SUBMITTED_FOR_EDITING',
          changedBy: 'user-123',
          metadata: {
            notificationType: 'book_submitted'
          }
        }
      }),
      Timestamp: '2025-09-07T10:00:00.000Z',
      MessageAttributes: {
        eventType: {
          Type: 'String',
          Value: 'book_status_changed'
        }
      }
    }),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1725710400000',
      SenderId: 'AIDACKCEVSQ6C2EXAMPLE',
      ApproximateFirstReceiveTimestamp: '1725710400000'
    },
    messageAttributes: {},
    md5OfBody: 'example-md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue',
    awsRegion: 'us-east-1'
  };
  
  console.log(JSON.stringify(expectedSQSRecord, null, 2));
}

async function testEventExtraction() {
  console.log('\n🧪 Testing event extraction logic...\n');
  
  // Simulate what the notification service receives
  const mockSQSRecord = {
    messageId: 'test-message-id',
    receiptHandle: 'test-receipt-handle',
    body: JSON.stringify({
      Type: 'Notification',
      MessageId: 'test-sns-message-id',
      TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events',
      Message: JSON.stringify({
        eventType: 'book_status_changed',
        eventId: 'test-event-uuid',
        timestamp: '2025-09-07T10:00:00.000Z',
        source: 'workflow-service',
        version: '1.0',
        data: {
          bookId: 'test-book-123',
          title: 'Test Book',
          author: 'test-author-123',
          previousStatus: 'DRAFT',
          newStatus: 'SUBMITTED_FOR_EDITING',
          changedBy: 'test-user-123',
          metadata: {
            notificationType: 'book_submitted'
          }
        }
      }),
      Timestamp: '2025-09-07T10:00:00.000Z',
      MessageAttributes: {
        eventType: {
          Type: 'String',
          Value: 'book_status_changed'
        }
      }
    }),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1725710400000',
      SenderId: 'AIDACKCEVSQ6C2EXAMPLE',
      ApproximateFirstReceiveTimestamp: '1725710400000'
    },
    messageAttributes: {},
    md5OfBody: 'test-md5',
    eventSource: 'aws:sqs' as const,
    eventSourceARN: 'arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue',
    awsRegion: 'us-east-1'
  };
  
  console.log('📋 Mock SQS Record:');
  console.log(JSON.stringify(mockSQSRecord, null, 2));
  
  try {
    // Step 1: Parse SQS body
    console.log('\n🔍 Step 1: Parsing SQS body...');
    const snsMessage = JSON.parse(mockSQSRecord.body);
    console.log('✅ SNS Message:', JSON.stringify(snsMessage, null, 2));
    
    // Step 2: Extract event from SNS message
    console.log('\n🔍 Step 2: Extracting event from SNS Message field...');
    const event = JSON.parse(snsMessage.Message);
    console.log('✅ Event:', JSON.stringify(event, null, 2));
    
    // Step 3: Validate event structure
    console.log('\n🔍 Step 3: Validating event structure...');
    const requiredFields = ['eventType', 'eventId', 'timestamp', 'source', 'version', 'data'];
    const requiredDataFields = ['bookId', 'title', 'author', 'newStatus', 'changedBy'];
    
    const missingFields = requiredFields.filter(field => !event[field]);
    const missingDataFields = requiredDataFields.filter(field => !event.data?.[field]);
    
    if (missingFields.length === 0 && missingDataFields.length === 0) {
      console.log('✅ Event structure is valid');
    } else {
      console.log('❌ Event structure is invalid:');
      if (missingFields.length > 0) {
        console.log('  Missing fields:', missingFields);
      }
      if (missingDataFields.length > 0) {
        console.log('  Missing data fields:', missingDataFields);
      }
    }
    
  } catch (error) {
    console.error('❌ Event extraction failed:', error);
  }
}

async function main() {
  console.log('🔍 Starting Message Format Comparison...\n');
  
  try {
    // 1. Get actual message from SQS
    const actualMessage = await getActualSQSMessage();
    
    // 2. Show expected format
    await showExpectedFormat();
    
    // 3. Test extraction logic
    await testEventExtraction();
    
    console.log('\n🎉 Message format comparison completed');
    
  } catch (error) {
    console.error('❌ Comparison failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}