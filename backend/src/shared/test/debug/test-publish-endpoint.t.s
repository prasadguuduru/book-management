#!/usr/bin/env npx tsx

/**
 * Test the publish endpoint specifically to see if it's working
 */

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { SNSClient, ListTopicsCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';

const region = 'us-east-1';
const cloudWatchLogs = new CloudWatchLogsClient({ region });
const sns = new SNSClient({ region });
const sqs = new SQSClient({ region });

async function testPublishEndpoint() {
  console.log('🧪 Testing Publish Endpoint Flow');
  console.log('================================');

  const bookId = '5ec5066b-3c98-44bc-8c9f-cb62fba6d48f'; // The book ID from your request
  const startTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago

  try {
    // 1. Check workflow service logs for publish calls
    console.log('\n1. 📋 Checking Workflow Service Logs for PUBLISH action...');
    
    const workflowLogs = await cloudWatchLogs.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/book-management-workflow-service',
      startTime,
      filterPattern: `"${bookId}" "PUBLISH"`,
      limit: 10
    }));

    if (workflowLogs.events && workflowLogs.events.length > 0) {
      console.log(`✅ Found ${workflowLogs.events.length} workflow service log entries for PUBLISH:`);
      workflowLogs.events.forEach((event, index) => {
        console.log(`   ${index + 1}. ${new Date(event.timestamp!).toISOString()}: ${event.message}`);
      });
    } else {
      console.log('❌ No workflow service logs found for PUBLISH action');
    }

    // 2. Check for SNS publishing logs
    console.log('\n2. 📤 Checking for SNS Publishing Logs...');
    
    const snsLogs = await cloudWatchLogs.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/book-management-workflow-service',
      startTime,
      filterPattern: `"${bookId}" "publishBookStatusChangeEvent"`,
      limit: 10
    }));

    if (snsLogs.events && snsLogs.events.length > 0) {
      console.log(`✅ Found ${snsLogs.events.length} SNS publishing log entries:`);
      snsLogs.events.forEach((event, index) => {
        console.log(`   ${index + 1}. ${new Date(event.timestamp!).toISOString()}: ${event.message}`);
      });
    } else {
      console.log('❌ No SNS publishing logs found');
    }

    // 3. Check notification service logs for recent activity
    console.log('\n3. 🔔 Checking Notification Service Logs...');
    
    const notificationLogs = await cloudWatchLogs.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/book-management-notification-service',
      startTime,
      filterPattern: `"${bookId}"`,
      limit: 10
    }));

    if (notificationLogs.events && notificationLogs.events.length > 0) {
      console.log(`✅ Found ${notificationLogs.events.length} notification service log entries:`);
      notificationLogs.events.forEach((event, index) => {
        console.log(`   ${index + 1}. ${new Date(event.timestamp!).toISOString()}: ${event.message}`);
      });
    } else {
      console.log('❌ No notification service logs found for this book');
    }

    // 4. Check SQS queue for messages
    console.log('\n4. 📬 Checking SQS Queue for Messages...');
    
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/533267439427/book-management-notification-queue';
    
    const queueAttributes = await sqs.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
    }));

    console.log('📊 Queue Status:');
    console.log(`   Available Messages: ${queueAttributes.Attributes?.ApproximateNumberOfMessages || 0}`);
    console.log(`   In-Flight Messages: ${queueAttributes.Attributes?.ApproximateNumberOfMessagesNotVisible || 0}`);

    // Try to receive a message (without deleting it)
    const messages = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      VisibilityTimeout: 1, // Very short timeout so message becomes available again quickly
      WaitTimeSeconds: 1
    }));

    if (messages.Messages && messages.Messages.length > 0) {
      console.log('📨 Recent message found:');
      const message = messages.Messages[0];
      console.log(`   Message ID: ${message.MessageId}`);
      console.log(`   Body: ${message.Body}`);
      
      try {
        const parsedBody = JSON.parse(message.Body || '{}');
        if (parsedBody.Message) {
          const snsMessage = JSON.parse(parsedBody.Message);
          console.log(`   SNS Message: ${JSON.stringify(snsMessage, null, 2)}`);
        }
      } catch (e) {
        console.log('   Could not parse message body as JSON');
      }
    } else {
      console.log('📭 No messages currently in queue');
    }

    // 5. Summary
    console.log('\n📋 SUMMARY');
    console.log('==========');
    console.log(`Book ID: ${bookId}`);
    console.log(`Workflow Service Logs: ${workflowLogs.events?.length || 0} entries`);
    console.log(`SNS Publishing Logs: ${snsLogs.events?.length || 0} entries`);
    console.log(`Notification Service Logs: ${notificationLogs.events?.length || 0} entries`);
    console.log(`SQS Messages Available: ${queueAttributes.Attributes?.ApproximateNumberOfMessages || 0}`);

  } catch (error) {
    console.error('❌ Error testing publish endpoint:', error);
  }
}

// Run the test
testPublishEndpoint().catch(console.error);