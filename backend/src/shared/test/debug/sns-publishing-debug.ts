/**
 * SNS Publishing Debug Script
 * Helps debug SNS publishing issues by checking the complete flow
 */

import { SNS, SQS } from 'aws-sdk';

const sns = new SNS({ region: 'us-east-1' });
const sqs = new SQS({ region: 'us-east-1' });

async function debugSNSPublishing() {
  console.log('🔍 Starting SNS Publishing Debug...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  try {
    // 1. Check if topic exists and get attributes
    console.log('📋 Checking SNS Topic...');
    const topicAttributes = await sns.getTopicAttributes({ TopicArn: topicArn }).promise();
    console.log('✅ Topic exists:', {
      subscriptionsConfirmed: topicAttributes.Attributes?.['SubscriptionsConfirmed'],
      subscriptionsPending: topicAttributes.Attributes?.['SubscriptionsPending'],
      topicArn: topicAttributes.Attributes?.['TopicArn']
    });
    
    // 2. List subscriptions
    console.log('📋 Checking SNS Subscriptions...');
    const subscriptions = await sns.listSubscriptionsByTopic({ TopicArn: topicArn }).promise();
    console.log('✅ Subscriptions:', subscriptions.Subscriptions?.map(sub => ({
      protocol: sub.Protocol,
      endpoint: sub.Endpoint,
      subscriptionArn: sub.SubscriptionArn
    })));
    
    // 3. Check SQS queue
    console.log('📋 Checking SQS Queue...');
    const queueAttributes = await sqs.getQueueAttributes({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    }).promise();
    
    console.log('✅ Queue attributes:', {
      approximateNumberOfMessages: queueAttributes.Attributes?.['ApproximateNumberOfMessages'],
      approximateNumberOfMessagesNotVisible: queueAttributes.Attributes?.['ApproximateNumberOfMessagesNotVisible'],
      queueArn: queueAttributes.Attributes?.['QueueArn']
    });
    
    // 4. Check for recent messages
    console.log('📋 Checking for recent messages...');
    const messages = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1
    }).promise();
    
    if (messages.Messages && messages.Messages.length > 0) {
      console.log('✅ Found messages in queue:', messages.Messages.length);
      messages.Messages.forEach((msg, index) => {
        console.log(`Message ${index + 1}:`, {
          messageId: msg.MessageId,
          body: JSON.parse(msg.Body || '{}'),
          attributes: msg.Attributes
        });
      });
    } else {
      console.log('⚠️ No messages found in queue');
    }
    
    // 5. Send a test message
    console.log('📋 Sending test message...');
    const testMessage = {
      eventType: 'book_status_changed',
      eventId: 'test-debug-' + Date.now(),
      timestamp: new Date().toISOString(),
      source: 'debug-script',
      version: '1.0',
      data: {
        bookId: 'test-book-id',
        title: 'Debug Test Book',
        author: 'debug-author',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING',
        changedBy: 'debug-user',
        metadata: {
          notificationType: 'book_submitted'
        }
      }
    };
    
    const publishResult = await sns.publish({
      TopicArn: topicArn,
      Message: JSON.stringify(testMessage),
      Subject: 'Debug Test Message',
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: 'book_status_changed'
        },
        source: {
          DataType: 'String',
          StringValue: 'debug-script'
        }
      }
    }).promise();
    
    console.log('✅ Test message published:', {
      messageId: publishResult.MessageId
    });
    
    // 6. Wait and check for the test message
    console.log('📋 Waiting for test message to arrive...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newMessages = await sqs.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 2
    }).promise();
    
    if (newMessages.Messages && newMessages.Messages.length > 0) {
      console.log('✅ Test message received in queue!');
      const testMsg = newMessages.Messages.find(msg => {
        const body = JSON.parse(msg.Body || '{}');
        const message = JSON.parse(body.Message || '{}');
        return message.eventId?.includes('test-debug');
      });
      
      if (testMsg) {
        console.log('✅ Found our test message:', {
          messageId: testMsg.MessageId,
          body: JSON.parse(testMsg.Body || '{}')
        });
      }
    } else {
      console.log('⚠️ Test message not found in queue - there may be a delivery delay');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug if this file is executed directly
if (require.main === module) {
  debugSNSPublishing().then(() => {
    console.log('🎉 Debug completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  });
}

export { debugSNSPublishing };