#!/usr/bin/env ts-node

/**
 * Check Book Publishing Flow
 * 
 * This script checks the entire book publishing flow to identify
 * where the notification process might be breaking.
 */

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function checkBookPublishFlow() {
  console.log('🔍 Checking book publishing flow...');
  
  // Check last 60 minutes for any book-related activity
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
  
  console.log(`📅 Checking logs from ${startTime.toISOString()} to ${endTime.toISOString()}`);
  
  const logGroups = [
    '/aws/lambda/qa-book-service',
    '/aws/lambda/qa-workflow-service', 
    '/aws/lambda/qa-notification-service'
  ];
  
  for (const logGroup of logGroups) {
    try {
      console.log(`\n📋 Checking ${logGroup}...`);
      
      const logs = await logsClient.send(new FilterLogEventsCommand({
        logGroupName: logGroup,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        filterPattern: '"publish" OR "book" OR "status" OR "workflow" OR "event" OR "ERROR" OR "error"'
      }));
      
      if (logs.events && logs.events.length > 0) {
        console.log(`  Found ${logs.events.length} relevant events:`);
        logs.events.forEach(event => {
          const timestamp = new Date(event.timestamp!).toISOString();
          console.log(`    [${timestamp}] ${event.message}`);
        });
      } else {
        console.log(`  No relevant events found`);
      }
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.log(`  Log group does not exist`);
      } else {
        console.error(`  Error checking ${logGroup}:`, error);
      }
    }
  }
  
  // Also check for any Lambda invocations
  console.log(`\n🔍 Checking for any Lambda invocations...`);
  
  for (const logGroup of logGroups) {
    try {
      const invocationLogs = await logsClient.send(new FilterLogEventsCommand({
        logGroupName: logGroup,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        filterPattern: '"START RequestId" OR "END RequestId" OR "REPORT RequestId"'
      }));
      
      if (invocationLogs.events && invocationLogs.events.length > 0) {
        console.log(`  ${logGroup}: ${invocationLogs.events.length} invocations`);
        // Show just the START events to see if functions are being called
        const startEvents = invocationLogs.events.filter(e => e.message?.includes('START RequestId'));
        startEvents.slice(0, 3).forEach(event => {
          const timestamp = new Date(event.timestamp!).toISOString();
          console.log(`    [${timestamp}] ${event.message}`);
        });
        if (startEvents.length > 3) {
          console.log(`    ... and ${startEvents.length - 3} more invocations`);
        }
      } else {
        console.log(`  ${logGroup}: No invocations found`);
      }
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.log(`  ${logGroup}: Log group does not exist`);
      } else {
        console.error(`  Error checking invocations for ${logGroup}:`, error);
      }
    }
  }
}

async function main() {
  await checkBookPublishFlow();
}

if (require.main === module) {
  main();
}

export { checkBookPublishFlow };