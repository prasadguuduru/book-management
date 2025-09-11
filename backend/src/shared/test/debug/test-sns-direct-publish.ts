#!/usr/bin/env ts-node

/**
 * Test SNS Direct Publish
 * 
 * This script directly publishes a test message to SNS to see if it reaches SQS.
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSClient, ReceiveMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function testSNSDirectPublish() {
  console.log('🧪 Testing direct SNS publish to SQS...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  try {
    // 1. Check initial queue state
    console.log('\n📊 Initial queue state:');
    await checkQueueState(queueUrl);
    
    // 2. Publish a test message to SNS
    console.log('\n📤 Publishing test message to SNS...');
    const testMessage = {
      eventType: 'BOOK_PUBLISHED',
      bookId: 'test-book-123',
      userId: 'test-user-456',
      timestamp: new Date().toISOString(),
      metadata: {
        bookTitle: 'Test Book',
        authorName: 'Test Author',
        newStatus: 'published'
      }
    };
    
    const publishResult = await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(testMessage),
      Subject: 'Test Book Notification',
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: 'BOOK_PUBLISHED'
        },
        bookId: {
          DataType: 'String', 
          StringValue: 'test-book-123'
        }
      }
    }));
    
    console.log(`✅ Message published to SNS`);
    console.log(`📋 Message ID: ${publishResult.MessageId}`);
    
    // 3. Wait a moment for delivery
    console.log('\n⏳ Waiting 5 seconds for message delivery...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Check queue state after publish
    console.log('\n📊 Queue state after publish:');
    await checkQueueState(queueUrl);
    
    // 5. Try to receive messages
    console.log('\n📨 Attempting to receive messages from SQS...');
    const messages = await sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 2,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All']
    }));
    
    if (messages.Messages && messages.Messages.length > 0) {
      console.log(`✅ Found ${messages.Messages.length} message(s) in SQS!`);
      messages.Messages.forEach((msg, index) => {
        console.log(`\n📋 Message ${index + 1}:`);
        console.log(`   Message ID: ${msg.MessageId}`);
        console.log(`   Body: ${msg.Body?.substring(0, 200)}...`);
        console.log(`   Attributes: ${Object.keys(msg.Attributes || {}).join(', ')}`);
      });
      
      console.log('\n🎉 SUCCESS: SNS to SQS delivery is working!');
      console.log('🔍 The issue might be with the message format or Lambda processing.');
      
    } else {
      console.log('❌ No messages found in SQS');
      console.log('🔍 SNS to SQS delivery is still failing');
      
      // Check for any error details
      console.log('\n🔍 Checking for delivery errors...');
      await checkDeliveryErrors();
    }
    
  } catch (error) {
    console.error('❌ Error testing SNS publish:', error);
  }
}

async function checkQueueState(queueUrl: string) {
  try {
    const attributes = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed'
      ]
    }));
    
    console.log(`  Messages in queue: ${attributes.Attributes?.ApproximateNumberOfMessages || 0}`);
    console.log(`  Messages in flight: ${attributes.Attributes?.ApproximateNumberOfMessagesNotVisible || 0}`);
    console.log(`  Messages delayed: ${attributes.Attributes?.ApproximateNumberOfMessagesDelayed || 0}`);
  } catch (error) {
    console.error('  ❌ Error checking queue state:', error);
  }
}

async function checkDeliveryErrors() {
  console.log('  🔍 Common causes of SNS to SQS delivery failure:');
  console.log('     1. SQS queue policy too restrictive');
  console.log('     2. SNS topic policy blocking delivery');
  console.log('     3. AWS service limits or throttling');
  console.log('     4. Network connectivity issues');
  console.log('     5. Subscription filter policy blocking messages');
}

async function main() {
  await testSNSDirectPublish();
}

if (require.main === module) {
  main();
}

export { testSNSDirectPublish };