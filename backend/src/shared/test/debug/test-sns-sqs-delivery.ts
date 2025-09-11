#!/usr/bin/env ts-node

/**
 * Test SNS to SQS Delivery
 * 
 * This script tests SNS to SQS message delivery with detailed monitoring
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSClient, ReceiveMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function testSNSToSQSDelivery() {
  console.log('🧪 Testing SNS to SQS delivery with detailed monitoring...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  // Check initial queue state
  console.log('\n📊 Initial queue state:');
  const initialState = await sqsClient.send(new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
  }));
  
  const initialMessages = parseInt(initialState.Attributes?.ApproximateNumberOfMessages || '0');
  console.log(`   Messages in queue: ${initialMessages}`);
  
  // Publish a test message with the same format as the workflow service
  console.log('\n📤 Publishing test message with workflow format...');
  
  const testMessage = {
    eventType: 'book_published',
    bookId: 'test-book-123',
    userId: 'test-user-456',
    timestamp: new Date().toISOString(),
    metadata: {
      bookTitle: 'Test Book',
      authorName: 'Test Author',
      previousStatus: 'DRAFT',
      newStatus: 'PUBLISHED'
    }
  };
  
  try {
    const publishResult = await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(testMessage),
      Subject: 'Test Book Published',
      MessageAttributes: {
        'eventType': {
          DataType: 'String',
          StringValue: 'book_published'
        },
        'bookId': {
          DataType: 'String', 
          StringValue: 'test-book-123'
        },
        'userId': {
          DataType: 'String',
          StringValue: 'test-user-456'
        }
      }
    }));
    
    console.log(`✅ Message published successfully`);
    console.log(`   Message ID: ${publishResult.MessageId}`);
    
    // Wait for delivery
    console.log('\n⏳ Waiting 10 seconds for message delivery...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check queue state after publish
    console.log('\n📊 Queue state after publish:');
    const afterState = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
    }));
    
    const afterMessages = parseInt(afterState.Attributes?.ApproximateNumberOfMessages || '0');
    const inFlightMessages = parseInt(afterState.Attributes?.ApproximateNumberOfMessagesNotVisible || '0');
    
    console.log(`   Messages in queue: ${afterMessages}`);
    console.log(`   Messages in flight: ${inFlightMessages}`);
    
    if (afterMessages > initialMessages || inFlightMessages > 0) {
      console.log('✅ Message delivery successful!');
      
      // Try to receive the message
      console.log('\n📨 Attempting to receive message...');
      const receiveResult = await sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 5,
        MessageAttributeNames: ['All']
      }));
      
      if (receiveResult.Messages && receiveResult.Messages.length > 0) {
        const message = receiveResult.Messages[0];
        if (message) {
          console.log('✅ Message received from SQS:');
          console.log(`   Message ID: ${message.MessageId}`);
          console.log(`   Body: ${message.Body?.substring(0, 200)}...`);
          
          // Parse SNS message
          try {
            const snsMessage = JSON.parse(message.Body || '{}');
            console.log(`   SNS Message ID: ${snsMessage.MessageId}`);
            console.log(`   SNS Subject: ${snsMessage.Subject}`);
            console.log(`   SNS Message: ${snsMessage.Message?.substring(0, 100)}...`);
          } catch (e) {
            console.log('   Could not parse as SNS message');
          }
        }
      } else {
        console.log('❌ No messages received (might be processed by Lambda)');
      }
    } else {
      console.log('❌ Message delivery failed - no new messages in queue');
      
      // Additional diagnostics
      console.log('\n🔍 Additional diagnostics:');
      console.log('1. Check if Lambda is consuming messages immediately');
      console.log('2. Verify SNS topic permissions');
      console.log('3. Check for delivery policy restrictions');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

async function main() {
  await testSNSToSQSDelivery();
}

if (require.main === module) {
  main();
}

export { testSNSToSQSDelivery };