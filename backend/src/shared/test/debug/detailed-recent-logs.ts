#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const cloudWatchLogs = new AWS.CloudWatchLogs();

async function checkDetailedRecentLogs() {
  console.log('🔍 Checking detailed recent logs...\n');
  
  const logGroupName = '/aws/lambda/qa-notification-service';
  
  try {
    // Get the most recent log stream
    const streams = await cloudWatchLogs.describeLogStreams({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 2
    }).promise();
    
    if (!streams.logStreams || streams.logStreams.length === 0) {
      console.log('❌ No log streams found');
      return;
    }
    
    const mostRecentStream = streams.logStreams[0];
    if (!mostRecentStream) {
      console.log('❌ No recent stream found');
      return;
    }
    
    console.log(`📋 Checking most recent stream: ${mostRecentStream.logStreamName}`);
    console.log(`   Created: ${new Date(mostRecentStream.creationTime!).toISOString()}`);
    
    // Get all events from the most recent stream
    const events = await cloudWatchLogs.getLogEvents({
      logGroupName,
      logStreamName: mostRecentStream.logStreamName!,
      limit: 100,
      startFromHead: true // Start from beginning to see full flow
    }).promise();
    
    if (!events.events || events.events.length === 0) {
      console.log('   ❌ No events found');
      return;
    }
    
    console.log(`\n📋 Found ${events.events.length} events in most recent stream`);
    console.log('📋 Showing all events to understand the flow:\n');
    
    for (let i = 0; i < events.events.length; i++) {
      const event = events.events[i];
      if (!event) continue;
      
      const timestamp = new Date(event.timestamp!).toISOString();
      const message = event.message || '';
      
      console.log(`${i + 1}. ${timestamp}`);
      
      // Try to extract structured log data
      try {
        const logLines = message.split('\n');
        const jsonLine = logLines.find(line => line.trim().startsWith('{'));
        
        if (jsonLine) {
          const logData = JSON.parse(jsonLine);
          console.log(`   Level: ${logData.level}`);
          console.log(`   Message: ${logData.message}`);
          
          if (logData.bookId) {
            console.log(`   Book ID: ${logData.bookId}`);
          }
          
          if (logData.messageId) {
            console.log(`   Message ID: ${logData.messageId}`);
          }
          
          if (logData.error) {
            console.log(`   Error: ${logData.error}`);
          }
          
          if (logData.validationErrors) {
            console.log(`   Validation Errors: ${JSON.stringify(logData.validationErrors)}`);
          }
          
          if (logData.eventData) {
            console.log(`   Event Data: ${JSON.stringify(logData.eventData, null, 2)}`);
          }
          
          if (logData.sqsRecord) {
            console.log(`   SQS Record (first 200 chars): ${JSON.stringify(logData.sqsRecord).substring(0, 200)}...`);
          }
        } else {
          // Show raw message if not structured
          console.log(`   Raw: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
        }
      } catch (parseError) {
        console.log(`   Raw: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error checking detailed logs:', error);
  }
}

async function main() {
  try {
    await checkDetailedRecentLogs();
    console.log('🎉 Detailed log check completed');
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}