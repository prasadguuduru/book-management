#!/usr/bin/env ts-node

/**
 * Check Recent Notification Processing
 * 
 * This script checks if the notification service is processing messages
 * and identifies any issues with email delivery.
 */

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function checkRecentProcessing() {
  console.log('🔍 Checking recent notification processing...');
  
  // Check last 30 minutes of logs
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 30 * 60 * 1000);
  
  console.log(`📅 Checking logs from ${startTime.toISOString()} to ${endTime.toISOString()}`);
  
  try {
    // Check notification service logs
    const notificationLogs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-notification-service',
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: '"Processing event" OR "Email sent" OR "ERROR" OR "book_published" OR "BOOK_PUBLISHED"'
    }));
    
    console.log(`\n📋 Notification Service Logs (${notificationLogs.events?.length || 0} events):`);
    notificationLogs.events?.forEach(event => {
      const timestamp = new Date(event.timestamp!).toISOString();
      console.log(`[${timestamp}] ${event.message}`);
    });
    
    // Check workflow service logs for event publishing
    const workflowLogs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: '"Publishing event" OR "SNS publish" OR "book_published" OR "BOOK_PUBLISHED" OR "ERROR"'
    }));
    
    console.log(`\n📋 Workflow Service Logs (${workflowLogs.events?.length || 0} events):`);
    workflowLogs.events?.forEach(event => {
      const timestamp = new Date(event.timestamp!).toISOString();
      console.log(`[${timestamp}] ${event.message}`);
    });
    
    // Check SQS queue metrics
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
    const queueAttributes = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
    }));
    
    console.log(`\n📊 SQS Queue Status:`);
    console.log(`  Messages in queue: ${queueAttributes.Attributes?.ApproximateNumberOfMessages || 0}`);
    console.log(`  Messages in flight: ${queueAttributes.Attributes?.ApproximateNumberOfMessagesNotVisible || 0}`);
    
    // Check DLQ status
    const dlqUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq';
    const dlqAttributes = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: dlqUrl,
      AttributeNames: ['ApproximateNumberOfMessages']
    }));
    
    console.log(`\n💀 DLQ Status:`);
    console.log(`  Messages in DLQ: ${dlqAttributes.Attributes?.ApproximateNumberOfMessages || 0}`);
    
  } catch (error) {
    console.error('❌ Error checking processing:', error);
  }
}

async function main() {
  await checkRecentProcessing();
}

if (require.main === module) {
  main();
}

export { checkRecentProcessing };