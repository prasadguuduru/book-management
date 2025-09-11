/**
 * Test notification service with properly formatted messages
 */

import { SNS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const sns = new SNS({ region: 'us-east-1' });

async function testWithProperFormat() {
  console.log('🧪 Testing with properly formatted message...');
  
  // Create a properly formatted event
  const event = {
    eventType: 'book_status_changed',
    eventId: uuidv4(), // Proper UUID
    timestamp: new Date().toISOString(),
    source: 'workflow-service', // Proper source
    version: '1.0',
    data: {
      bookId: 'test-book-proper',
      title: 'Properly Formatted Test Book',
      author: 'test-author',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED_FOR_EDITING',
      changedBy: 'test-user',
      metadata: {
        notificationType: 'book_submitted'
      }
    }
  };

  console.log('📤 Publishing properly formatted message:', {
    eventId: event.eventId,
    source: event.source,
    bookId: event.data.bookId
  });

  try {
    const result = await sns.publish({
      TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events',
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

    console.log('✅ Message published successfully:', result.MessageId);
    
    console.log('⏳ Waiting 15 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('🎉 Test completed - check CloudWatch logs for results');
    
  } catch (error) {
    console.error('❌ Failed to publish message:', error);
  }
}

testWithProperFormat().catch(console.error);