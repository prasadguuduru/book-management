#!/usr/bin/env ts-node

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function main() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 15 * 60 * 1000); // Last 15 minutes
  
  console.log('🔍 Checking notification service for recent activity...');
  console.log(`📅 Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
  
  try {
    const logs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-notification-service',
      startTime: startTime.getTime(),
      endTime: endTime.getTime()
    }));
    
    if (logs.events && logs.events.length > 0) {
      console.log(`✅ Found ${logs.events.length} events:`);
      logs.events.forEach(event => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`[${timestamp}] ${event.message}`);
      });
    } else {
      console.log('❌ No recent notification service activity');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();