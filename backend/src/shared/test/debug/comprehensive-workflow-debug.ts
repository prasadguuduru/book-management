#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const cloudWatchLogs = new AWS.CloudWatchLogs();
const sns = new AWS.SNS();
const sqs = new AWS.SQS();

interface LogEvent {
  timestamp: string;
  message: string;
}

interface LogStream {
  logStreamName: string;
  creationTime: number;
  lastEventTime?: number;
}

async function getAllLogStreams(logGroupName: string, limit: number = 10): Promise<LogStream[]> {
  try {
    const params = {
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit
    };
    
    const result = await cloudWatchLogs.describeLogStreams(params).promise();
    return result.logStreams?.map(stream => ({
      logStreamName: stream.logStreamName!,
      creationTime: stream.creationTime!,
      lastEventTime: (stream as any).lastEventTime
    })) || [];
  } catch (error) {
    console.error(`❌ Error getting log streams for ${logGroupName}:`, error);
    return [];
  }
}

async function getLogEvents(logGroupName: string, logStreamName: string, limit: number = 50): Promise<LogEvent[]> {
  try {
    const params = {
      logGroupName,
      logStreamName,
      limit,
      startFromHead: false
    };
    
    const result = await cloudWatchLogs.getLogEvents(params).promise();
    return result.events?.map(event => ({
      timestamp: new Date(event.timestamp!).toISOString(),
      message: event.message!
    })) || [];
  } catch (error) {
    console.error(`❌ Error getting log events:`, error);
    return [];
  }
}

async function checkSNSTopicSubscriptions() {
  try {
    console.log('📋 Checking SNS Topic Subscriptions...');
    const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
    
    const subscriptions = await sns.listSubscriptionsByTopic({ TopicArn: topicArn }).promise();
    
    console.log('✅ SNS Subscriptions:');
    subscriptions.Subscriptions?.forEach((sub, index) => {
      console.log(`  ${index + 1}. Protocol: ${sub.Protocol}, Endpoint: ${sub.Endpoint}`);
    });
    
    return subscriptions.Subscriptions || [];
  } catch (error) {
    console.error('❌ Error checking SNS subscriptions:', error);
    return [];
  }
}

async function checkSQSQueueAttributes() {
  try {
    console.log('📋 Checking SQS Queue Attributes...');
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications';
    
    const attributes = await sqs.getQueueAttributes({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    }).promise();
    
    console.log('✅ SQS Queue Attributes:');
    console.log('  Messages Available:', attributes.Attributes?.['ApproximateNumberOfMessages']);
    console.log('  Messages In Flight:', attributes.Attributes?.['ApproximateNumberOfMessagesNotVisible']);
    console.log('  Messages Delayed:', attributes.Attributes?.['ApproximateNumberOfMessagesDelayed']);
    console.log('  Visibility Timeout:', attributes.Attributes?.['VisibilityTimeout']);
    console.log('  Message Retention Period:', attributes.Attributes?.['MessageRetentionPeriod']);
    console.log('  Redrive Policy:', attributes.Attributes?.['RedrivePolicy']);
    
    return attributes.Attributes;
  } catch (error) {
    console.error('❌ Error checking SQS queue attributes:', error);
    return {};
  }
}

async function searchLogsForWorkflowMessages() {
  console.log('🔍 Searching for workflow service messages in notification service logs...');
  
  const logGroupName = '/aws/lambda/qa-notification-service';
  const streams = await getAllLogStreams(logGroupName, 20); // Check more streams
  
  console.log(`📋 Found ${streams.length} log streams to check`);
  
  let workflowMessagesFound = 0;
  let totalMessagesProcessed = 0;
  
  for (const stream of streams) {
    console.log(`\n📋 Checking stream: ${stream.logStreamName}`);
    console.log(`   Created: ${new Date(stream.creationTime).toISOString()}`);
    console.log(`   Last Event: ${stream.lastEventTime ? new Date(stream.lastEventTime).toISOString() : 'N/A'}`);
    
    const events = await getLogEvents(logGroupName, stream.logStreamName, 100);
    
    // Look for workflow service messages (not debug messages)
    const workflowEvents = events.filter(event => 
      event.message.includes('workflow-service') && 
      !event.message.includes('debug-script') &&
      !event.message.includes('test-direct') &&
      !event.message.includes('Direct SNS Test') &&
      !event.message.includes('Direct SQS Test')
    );
    
    const allProcessedEvents = events.filter(event =>
      event.message.includes('EVENT PROCESSING') ||
      event.message.includes('EMAIL DELIVERY') ||
      event.message.includes('BATCH PROCESSING')
    );
    
    if (workflowEvents.length > 0) {
      console.log(`   ✅ Found ${workflowEvents.length} workflow service messages`);
      workflowMessagesFound += workflowEvents.length;
      
      // Show first few workflow messages
      workflowEvents.slice(0, 3).forEach((event, index) => {
        console.log(`   Message ${index + 1}:`);
        console.log(`     Time: ${event.timestamp}`);
        console.log(`     Content: ${event.message.substring(0, 200)}...`);
      });
    }
    
    if (allProcessedEvents.length > 0) {
      totalMessagesProcessed += allProcessedEvents.length;
      console.log(`   📊 Found ${allProcessedEvents.length} processed events in this stream`);
    }
    
    if (workflowEvents.length === 0 && allProcessedEvents.length === 0) {
      console.log(`   ⚪ No relevant events in this stream`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Workflow messages found: ${workflowMessagesFound}`);
  console.log(`   Total processed events: ${totalMessagesProcessed}`);
  
  return { workflowMessagesFound, totalMessagesProcessed };
}

async function testWorkflowServiceDirectly() {
  console.log('\n🧪 Testing workflow service SNS publishing directly...');
  
  try {
    // Simulate a workflow service message
    const testMessage = {
      eventType: 'book_status_changed',
      eventId: `workflow-test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'workflow-service',
      version: '1.0',
      data: {
        bookId: 'test-workflow-book',
        title: 'Workflow Service Test Book',
        author: 'workflow-author',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING',
        changedBy: 'workflow-user',
        metadata: {
          notificationType: 'book_submitted'
        }
      }
    };
    
    const publishParams = {
      TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events',
      Message: JSON.stringify(testMessage),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: testMessage.eventType
        }
      }
    };
    
    console.log('📤 Publishing test message to SNS...');
    const result = await sns.publish(publishParams).promise();
    console.log('✅ Message published successfully:', result.MessageId);
    
    // Wait a bit for processing
    console.log('⏳ Waiting 10 seconds for message processing...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check if it was processed
    console.log('🔍 Checking if message was processed...');
    const queueAttributes = await checkSQSQueueAttributes();
    
    return result.MessageId;
  } catch (error) {
    console.error('❌ Error testing workflow service directly:', error);
    return null;
  }
}

async function main() {
  console.log('🔍 Starting Comprehensive Workflow Debug...\n');
  
  try {
    // 1. Check SNS/SQS setup
    await checkSNSTopicSubscriptions();
    console.log('');
    await checkSQSQueueAttributes();
    console.log('');
    
    // 2. Search existing logs for workflow messages
    const logResults = await searchLogsForWorkflowMessages();
    console.log('');
    
    // 3. Test workflow service publishing directly
    const testMessageId = await testWorkflowServiceDirectly();
    console.log('');
    
    // 4. Final analysis
    console.log('🎯 Analysis:');
    if (logResults.workflowMessagesFound === 0) {
      console.log('❌ No workflow service messages found in notification service logs');
      console.log('   This suggests messages from workflow service are not reaching the notification service');
      console.log('   Possible issues:');
      console.log('   - SNS topic not properly configured');
      console.log('   - SQS subscription not working');
      console.log('   - Messages being filtered out');
      console.log('   - Workflow service not actually publishing');
    } else {
      console.log(`✅ Found ${logResults.workflowMessagesFound} workflow service messages`);
      console.log('   Messages are reaching the notification service');
      console.log('   Check if they are being processed successfully');
    }
    
    if (testMessageId) {
      console.log(`✅ Direct test message published: ${testMessageId}`);
      console.log('   Check notification service logs in a few minutes for processing results');
    }
    
  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
  
  console.log('\n🎉 Comprehensive workflow debug completed');
}

if (require.main === module) {
  main().catch(console.error);
}