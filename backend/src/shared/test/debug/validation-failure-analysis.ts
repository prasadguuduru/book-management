#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const cloudWatchLogs = new AWS.CloudWatchLogs();

async function getDetailedValidationErrors() {
  console.log('🔍 Analyzing validation failures in detail...\n');
  
  const logGroupName = '/aws/lambda/qa-notification-service';
  
  // Get the most recent log stream
  const streams = await cloudWatchLogs.describeLogStreams({
    logGroupName,
    orderBy: 'LastEventTime',
    descending: true,
    limit: 3
  }).promise();
  
  if (!streams.logStreams || streams.logStreams.length === 0) {
    console.log('❌ No log streams found');
    return;
  }
  
  for (const stream of streams.logStreams.slice(0, 2)) {
    console.log(`📋 Analyzing stream: ${stream.logStreamName}`);
    
    const events = await cloudWatchLogs.getLogEvents({
      logGroupName,
      logStreamName: stream.logStreamName!,
      limit: 100,
      startFromHead: false
    }).promise();
    
    // Find validation error messages
    const errorEvents = events.events?.filter(event => 
      event.message?.includes('Failed to extract event from SQS record') ||
      event.message?.includes('EVENT VALIDATION FAILURE') ||
      event.message?.includes('Skipping invalid SQS record')
    ) || [];
    
    console.log(`   Found ${errorEvents.length} error events`);
    
    // Show detailed error messages
    errorEvents.slice(0, 5).forEach((event, index) => {
      console.log(`\n   Error ${index + 1}:`);
      console.log(`   Time: ${new Date(event.timestamp!).toISOString()}`);
      
      try {
        // Try to parse the structured log
        const logLines = event.message!.split('\n');
        const jsonLine = logLines.find(line => line.trim().startsWith('{'));
        
        if (jsonLine) {
          const logData = JSON.parse(jsonLine);
          console.log(`   Level: ${logData.level}`);
          console.log(`   Message: ${logData.message}`);
          
          if (logData.error) {
            console.log(`   Error: ${logData.error}`);
          }
          
          if (logData.sqsRecord) {
            console.log(`   SQS Record Body (first 200 chars): ${JSON.stringify(logData.sqsRecord).substring(0, 200)}...`);
          }
          
          if (logData.validationErrors) {
            console.log(`   Validation Errors: ${JSON.stringify(logData.validationErrors, null, 2)}`);
          }
          
          if (logData.eventData) {
            console.log(`   Event Data: ${JSON.stringify(logData.eventData, null, 2)}`);
          }
        } else {
          // Show raw message if not structured
          console.log(`   Raw: ${event.message!.substring(0, 300)}...`);
        }
      } catch (parseError) {
        console.log(`   Raw: ${event.message!.substring(0, 300)}...`);
      }
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

async function main() {
  try {
    await getDetailedValidationErrors();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}