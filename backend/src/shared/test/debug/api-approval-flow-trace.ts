#!/usr/bin/env ts-node

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env['AWS_REGION'] || 'us-east-1' });

async function traceAPIApprovalFlow() {
  console.log('🔍 Tracing API Approval Flow vs Direct SNS...\n');

  console.log('📋 For now, let\'s focus on testing the SNS publishing directly');
  console.log('� We\'lil need to check CloudWatch logs manually for the workflow service');
  console.log('💡 The key question: Is the workflow service even trying to publish to SNS?\n');

  // Test what the workflow service SHOULD be publishing
  console.log('🧪 Testing what workflow service should publish:');
  
  const testEvent = {
    eventType: 'book_approved',
    bookId: 'test-book-123',
    title: 'Test Book',
    authorId: 'test-author-456',
    publisherId: 'test-publisher-789',
    timestamp: new Date().toISOString(),
    metadata: {
      approvedBy: 'test-publisher',
      approvalDate: new Date().toISOString()
    }
  };

  try {
    const topicArn = process.env['BOOK_EVENTS_TOPIC_ARN'] || 
                    `arn:aws:sns:${process.env['AWS_REGION'] || 'us-east-1'}:${process.env['AWS_ACCOUNT_ID']}:book-events`;
    
    console.log(`📤 Publishing test event to: ${topicArn}`);
    console.log(`📄 Event payload: ${JSON.stringify(testEvent, null, 2)}`);

    const result = await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(testEvent),
      Subject: 'Test Book Approval Event'
    }));

    console.log(`✅ Test publish successful! MessageId: ${result.MessageId}`);
    console.log('\n💡 If this works but API approval doesn\'t, the issue is in the workflow service code');
    
  } catch (error) {
    console.error('❌ Test publish failed:', error);
  }
}

// Run the trace
traceAPIApprovalFlow().catch(console.error);