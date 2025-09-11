#!/usr/bin/env npx tsx

/**
 * Test the publish workflow with the newly created book
 */

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { SQSClient, GetQueueAttributesCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';

const region = 'us-east-1';
const cloudWatchLogs = new CloudWatchLogsClient({ region });
const sqs = new SQSClient({ region });

async function testNewBookPublish() {
  console.log('🧪 Testing New Book Publish Workflow');
  console.log('====================================');

  const bookId = '1cfb8832-eb48-4ffd-b2c5-78a538544a7d'; // The book we created
  const startTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago

  try {
    console.log(`📚 Testing with Book ID: ${bookId}`);
    console.log(`📅 Looking for logs since: ${new Date(startTime).toISOString()}`);

    // 1. Check workflow service logs for this specific book
    console.log('\n1. 📋 Checking Workflow Service Logs...');
    
    const workflowLogs = await cloudWatchLogs.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime,
      filterPattern: `"${bookId}"`,
      limit: 20
    }));

    if (workflowLogs.events && workflowLogs.events.length > 0) {
      console.log(`✅ Found ${workflowLogs.events.length} workflow service log entries:`);
      workflowLogs.events.forEach((event, index) => {
        console.log(`   ${index + 1}. ${new Date(event.timestamp!).toISOString()}: ${event.message}`);
      });
    } else {
      console.log('❌ No workflow service logs found for this book');
    }

    // 2. Check for SNS publishing logs
    console.log('\n2. 📤 Checking for SNS Publishing Logs...');
    
    const snsLogs = await cloudWatchLogs.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime,
      filterPattern: `"publishBookStatusChangeEvent"`,
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

    // 3. Check notification service logs
    console.log('\n3. 🔔 Checking Notification Service Logs...');
    
    const notificationLogs = await cloudWatchLogs.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-notification-service',
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
    console.log('\n4. 📬 Checking SQS Queue...');
    
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-notification-queue';
    
    try {
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
        VisibilityTimeout: 1, // Very short timeout
        WaitTimeSeconds: 1
      }));

      if (messages.Messages && messages.Messages.length > 0) {
        console.log('📨 Recent message found:');
        const message = messages.Messages[0];
        console.log(`   Message ID: ${message.MessageId}`);
        
        try {
          const parsedBody = JSON.parse(message.Body || '{}');
          if (parsedBody.Message) {
            const snsMessage = JSON.parse(parsedBody.Message);
            console.log(`   SNS Message: ${JSON.stringify(snsMessage, null, 2)}`);
          }
        } catch (e) {
          console.log(`   Raw Body: ${message.Body}`);
        }
      } else {
        console.log('📭 No messages currently in queue');
      }
    } catch (sqsError) {
      console.log(`❌ SQS Error: ${sqsError}`);
    }

    // 5. Instructions
    console.log('\n🎯 TESTING INSTRUCTIONS:');
    console.log('========================');
    console.log('To test the notification system:');
    console.log(`1. Use this book ID: ${bookId}`);
    console.log('2. Call the publish endpoint:');
    console.log(`   POST https://d2xg2iv1qaydac.cloudfront.net/api/workflow/books/${bookId}/publish`);
    console.log('3. Check the logs above for activity');
    console.log('4. If no logs appear, the request might not be reaching the workflow service');

  } catch (error) {
    console.error('❌ Error testing new book publish:', error);
  }
}

// Run the test
testNewBookPublish().catch(console.error);