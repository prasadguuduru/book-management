#!/usr/bin/env npx tsx

/**
 * Test SNS publishing directly to see if there are connectivity issues
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const region = 'us-east-1';
const sns = new SNSClient({ region });

async function testSNSDirectPublish() {
  console.log('📤 Testing Direct SNS Publishing');
  console.log('================================');

  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  const testMessage = {
    eventType: 'book_status_changed',
    eventId: 'test-' + Date.now(),
    timestamp: new Date().toISOString(),
    source: 'test-script',
    version: '1.0',
    data: {
      bookId: 'test-book-id',
      title: 'Test Book',
      previousStatus: 'READY_FOR_PUBLICATION',
      newStatus: 'PUBLISHED',
      changedBy: 'test-user',
      changedAt: new Date().toISOString(),
      comments: 'Test publish from debug script'
    }
  };

  try {
    console.log(`📡 Publishing to topic: ${topicArn}`);
    console.log(`📝 Message: ${JSON.stringify(testMessage, null, 2)}`);

    const startTime = Date.now();

    const result = await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(testMessage),
      Subject: 'Test Book Status Changed',
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: testMessage.eventType
        },
        bookId: {
          DataType: 'String',
          StringValue: testMessage.data.bookId
        },
        newStatus: {
          DataType: 'String',
          StringValue: testMessage.data.newStatus
        },
        source: {
          DataType: 'String',
          StringValue: testMessage.source
        }
      }
    }));

    const duration = Date.now() - startTime;

    console.log('✅ SNS Publish Successful!');
    console.log(`   Message ID: ${result.MessageId}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Topic ARN: ${topicArn}`);

    // Now check if the message appears in the SQS queue
    console.log('\n📬 Checking SQS Queue for Message...');
    
    // Wait a moment for message to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { SQSClient, ReceiveMessageCommand } = await import('@aws-sdk/client-sqs');
    const sqs = new SQSClient({ region });
    
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
    
    const messages = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      VisibilityTimeout: 1,
      WaitTimeSeconds: 2
    }));

    if (messages.Messages && messages.Messages.length > 0) {
      console.log('✅ Message found in SQS queue!');
      const message = messages.Messages[0];
      console.log(`   Message ID: ${message.MessageId}`);
      
      try {
        const parsedBody = JSON.parse(message.Body || '{}');
        if (parsedBody.Message) {
          const snsMessage = JSON.parse(parsedBody.Message);
          console.log(`   SNS Message: ${JSON.stringify(snsMessage, null, 2)}`);
        }
      } catch (e) {
        console.log(`   Raw Body: ${message.Body}`);
      }
    } else {
      console.log('❌ No messages found in SQS queue');
      console.log('   This could mean:');
      console.log('   1. Message hasn\'t propagated yet (try waiting longer)');
      console.log('   2. SNS-SQS subscription is not working');
      console.log('   3. Message was already consumed by notification service');
    }

  } catch (error) {
    console.error('❌ SNS Publish Failed:', error);
    
    if (error instanceof Error) {
      console.log(`   Error Type: ${error.name}`);
      console.log(`   Error Message: ${error.message}`);
      
      if (error.message.includes('timeout')) {
        console.log('\n🔍 TIMEOUT ANALYSIS:');
        console.log('   - This suggests network connectivity issues');
        console.log('   - SNS service might be slow to respond');
        console.log('   - Lambda might have network restrictions');
      }
    }
  }
}

// Run the test
testSNSDirectPublish().catch(console.error);