#!/usr/bin/env ts-node

/**
 * Test SNS Direct Publishing
 * 
 * This script tests if we can publish to SNS directly from our local environment
 * to isolate whether the issue is with Lambda networking or SNS itself.
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'us-east-1' });

async function testSNSPublish() {
  console.log('🧪 Testing direct SNS publish...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  const testMessage = {
    eventType: 'BOOK_PUBLISHED',
    bookId: 'test-book-123',
    userId: 'test-user-456',
    title: 'Test Book',
    author: 'Test Author',
    previousStatus: 'READY_FOR_PUBLICATION',
    newStatus: 'PUBLISHED',
    changedBy: 'test-user',
    timestamp: new Date().toISOString(),
    metadata: {
      testMessage: true,
      source: 'direct-test'
    }
  };
  
  try {
    console.log(`📤 Publishing test message to: ${topicArn}`);
    
    const startTime = Date.now();
    
    const result = await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(testMessage),
      Subject: 'Test Book Published Notification',
      MessageAttributes: {
        'eventType': {
          DataType: 'String',
          StringValue: 'BOOK_PUBLISHED'
        },
        'bookId': {
          DataType: 'String', 
          StringValue: 'test-book-123'
        },
        'notificationType': {
          DataType: 'String',
          StringValue: 'book_published'
        }
      }
    }));
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ SNS publish successful!`);
    console.log(`📊 Message ID: ${result.MessageId}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
    // Wait a moment and check if notification was processed
    console.log('\n⏳ Waiting 10 seconds to check if notification was processed...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ SNS publish failed:', error);
    
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      
      if (error.name === 'TimeoutError') {
        console.error('🔍 This is the same timeout error seen in Lambda!');
        console.error('💡 This suggests a network connectivity issue');
      }
    }
  }
}

async function main() {
  await testSNSPublish();
}

if (require.main === module) {
  main();
}

export { testSNSPublish };