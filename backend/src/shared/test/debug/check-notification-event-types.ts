#!/usr/bin/env ts-node

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function main() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);
  
  console.log('🔍 Checking notification service for SQS vs DynamoDB events...');
  console.log(`📅 Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
  
  try {
    const logs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-notification-service',
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: '"SQS" OR "DYNAMODB" OR "Records" OR "eventSource"'
    }));
    
    if (logs.events && logs.events.length > 0) {
      console.log(`✅ Found ${logs.events.length} relevant events:`);
      logs.events.forEach(event => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`[${timestamp}] ${event.message}`);
      });
    } else {
      console.log('❌ No relevant events found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();