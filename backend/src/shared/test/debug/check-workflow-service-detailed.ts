#!/usr/bin/env ts-node

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function main() {
  // Check the exact time around your publish request
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour
  
  console.log('🔍 Checking qa-workflow-service logs in detail...');
  console.log(`📅 Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
  console.log(`🎯 Looking for book ID: e5144599-ad33-44fc-a724-4f1e559f8cbd`);
  
  try {
    // Get ALL events from workflow service (no filter)
    const allLogs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime: startTime.getTime(),
      endTime: endTime.getTime()
    }));
    
    console.log(`\n📋 Total events in workflow service: ${allLogs.events?.length || 0}`);
    
    if (allLogs.events && allLogs.events.length > 0) {
      console.log(`\n✅ Found workflow service activity:`);
      allLogs.events.forEach(event => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`[${timestamp}] ${event.message}`);
      });
    } else {
      console.log(`\n❌ No events found in workflow service logs`);
      
      // Check if the log group exists and has any streams
      console.log(`\n🔍 Checking log streams in the workflow service log group...`);
      
      try {
        const { CloudWatchLogsClient, DescribeLogStreamsCommand } = await import('@aws-sdk/client-cloudwatch-logs');
        const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
          logGroupName: '/aws/lambda/qa-workflow-service',
          orderBy: 'LastEventTime',
          descending: true,
          limit: 10
        }));
        
        if (streamsResponse.logStreams && streamsResponse.logStreams.length > 0) {
          console.log(`  Found ${streamsResponse.logStreams.length} log streams:`);
          streamsResponse.logStreams.forEach(stream => {
            const lastEvent = (stream as any).lastEventTime ? new Date((stream as any).lastEventTime).toISOString() : 'Never';
            console.log(`    - ${stream.logStreamName}: Last event at ${lastEvent}`);
          });
        } else {
          console.log(`  No log streams found - function has never been invoked`);
        }
      } catch (streamError) {
        console.log(`  Error checking log streams: ${streamError}`);
      }
    }
    
    // Also check for any Lambda invocation patterns
    console.log(`\n🔍 Checking for Lambda invocation patterns...`);
    const invocationLogs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: '"START RequestId" OR "END RequestId" OR "REPORT RequestId" OR "INIT_START"'
    }));
    
    if (invocationLogs.events && invocationLogs.events.length > 0) {
      console.log(`  Found ${invocationLogs.events.length} invocation-related events:`);
      invocationLogs.events.forEach(event => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`    [${timestamp}] ${event.message}`);
      });
    } else {
      console.log(`  No invocation patterns found`);
    }
    
  } catch (error) {
    console.error('❌ Error checking workflow service logs:', error);
  }
}

main();