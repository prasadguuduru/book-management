/**
 * Test Real Workflow Format
 * Tests SNS publishing with the exact same format as the workflow service
 */

import { SNS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const sns = new SNS({ region: 'us-east-1' });

async function testRealWorkflowFormat() {
  console.log('🔍 Testing real workflow format...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  // Create event with exact same format as workflow service
  const event = {
    eventType: 'book_status_changed',
    eventId: uuidv4(), // This should be a valid UUID v4
    timestamp: new Date().toISOString(),
    source: 'workflow-service', // This must match exactly
    version: '1.0',
    data: {
      bookId: 'test-real-format-book-id',
      title: 'Test Real Format Book',
      author: 'test-author-id', // workflow service uses authorId as author
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED_FOR_EDITING',
      changedBy: 'test-user-id',
      changeReason: 'Testing real workflow format',
      metadata: {
        notificationType: 'book_submitted',
        bookGenre: 'Technology',
        bookDescription: 'A test book with real workflow format'
      }
    }
  };
  
  console.log('📋 Event to publish:', JSON.stringify(event, null, 2));
  
  try {
    console.log('📤 Publishing to SNS...');
    const startTime = Date.now();
    
    const result = await sns.publish({
      TopicArn: topicArn,
      Message: JSON.stringify(event),
      Subject: `Book Status Changed: ${event.data.title}`,
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: event.eventType
        },
        bookId: {
          DataType: 'String',
          StringValue: event.data.bookId
        },
        newStatus: {
          DataType: 'String',
          StringValue: event.data.newStatus
        },
        source: {
          DataType: 'String',
          StringValue: event.source
        }
      }
    }).promise();
    
    const duration = Date.now() - startTime;
    
    console.log('✅ SNS publish successful:', {
      messageId: result.MessageId,
      duration: `${duration}ms`,
      eventId: event.eventId
    });
    
    console.log('📋 Waiting 5 seconds for message to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Test completed - check CloudWatch logs for processing results');
    
  } catch (error) {
    console.error('❌ SNS publish failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testRealWorkflowFormat().then(() => {
    console.log('🎉 Real workflow format test completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

export { testRealWorkflowFormat };