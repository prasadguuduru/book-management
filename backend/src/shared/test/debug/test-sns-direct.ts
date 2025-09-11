/**
 * Direct SNS Publishing Test
 * Tests if SNS publishing works directly from our environment
 */

import { SNS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const sns = new SNS({ region: 'us-east-1' });

async function testSNSPublishing() {
  console.log('🔍 Testing direct SNS publishing...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  // Create a properly formatted message
  const event = {
    eventType: 'book_status_changed',
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    source: 'workflow-service',
    version: '1.0',
    data: {
      bookId: 'test-direct-sns-' + Date.now(),
      title: 'Direct SNS Test Book',
      author: 'test-author-id',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED_FOR_EDITING',
      changedBy: 'test-user-id',
      changeReason: 'Testing direct SNS publishing',
      metadata: {
        notificationType: 'book_submitted',
        bookGenre: 'Technology',
        bookDescription: 'A test book for direct SNS publishing'
      }
    }
  };
  
  const message = JSON.stringify(event);
  const subject = `Book Status Changed: ${event.data.title}`;
  
  const params: SNS.PublishInput = {
    TopicArn: topicArn,
    Message: message,
    Subject: subject,
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
  };
  
  try {
    console.log('📋 Publishing message to SNS...');
    console.log('Topic ARN:', topicArn);
    console.log('Message length:', message.length);
    console.log('Event ID:', event.eventId);
    
    const startTime = Date.now();
    
    // Add timeout like the workflow service does
    const publishPromise = sns.publish(params).promise();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('SNS publish timeout after 15 seconds')), 15000);
    });
    
    const result = await Promise.race([publishPromise, timeoutPromise]) as any;
    const duration = Date.now() - startTime;
    
    console.log('✅ SNS publish successful!');
    console.log('Message ID:', result.MessageId);
    console.log('Duration:', duration + 'ms');
    
    // Wait a moment for the message to be processed
    console.log('⏳ Waiting 5 seconds for message processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Direct SNS test completed successfully');
    
  } catch (error) {
    console.error('❌ SNS publish failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        console.error('🕐 SNS publish timed out - this might be a network or permission issue');
      } else if (error.message.includes('AccessDenied')) {
        console.error('🔒 Access denied - check IAM permissions for SNS publishing');
      } else if (error.message.includes('NotFound')) {
        console.error('🔍 Topic not found - check if the SNS topic exists');
      }
    }
  }
}

// Run the test
if (require.main === module) {
  testSNSPublishing().then(() => {
    console.log('🎉 SNS test completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 SNS test failed:', error);
    process.exit(1);
  });
}

export { testSNSPublishing };