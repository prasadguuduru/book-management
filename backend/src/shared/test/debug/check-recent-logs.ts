/**
 * Check Recent CloudWatch Logs
 * Specifically looks for logs from the real workflow service events
 */

import { CloudWatchLogs } from 'aws-sdk';

const cloudWatchLogs = new CloudWatchLogs({ region: 'us-east-1' });

async function checkRecentLogs() {
  console.log('🔍 Checking for recent notification service logs...');
  
  const logGroupName = '/aws/lambda/qa-notification-service';
  
  try {
    // Get the most recent log streams
    const logStreams = await cloudWatchLogs.describeLogStreams({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 3
    }).promise();
    
    if (logStreams.logStreams && logStreams.logStreams.length > 0) {
      console.log('✅ Found log streams:', logStreams.logStreams.length);
      
      // Check each stream for recent events
      for (const stream of logStreams.logStreams) {
        if (stream.logStreamName) {
          console.log(`\n📋 Checking stream: ${stream.logStreamName}`);
          console.log(`   Last event: ${(stream as any).lastEventTime ? new Date((stream as any).lastEventTime).toISOString() : 'unknown'}`);
          
          const logEvents = await cloudWatchLogs.getLogEvents({
            logGroupName,
            logStreamName: stream.logStreamName,
            startTime: Date.now() - (10 * 60 * 1000), // Last 10 minutes
            limit: 50
          }).promise();
          
          if (logEvents.events && logEvents.events.length > 0) {
            console.log(`   Found ${logEvents.events.length} recent events`);
            
            // Look for events related to the real workflow service
            const workflowEvents = logEvents.events.filter(event => 
              event.message?.includes('5669ce55-900b-48fb-aefc-0d35a58b7e68') || // Real event ID
              event.message?.includes('9aab3f56-6db1-40fe-b7de-ce5342795b91') || // Real book ID
              event.message?.includes('new22') || // Real book title
              event.message?.includes('EMAIL SENT SUCCESSFULLY') ||
              event.message?.includes('EMAIL DELIVERY SUCCESS')
            );
            
            if (workflowEvents.length > 0) {
              console.log(`   🎯 Found ${workflowEvents.length} events related to real workflow:`);
              workflowEvents.forEach((event, index) => {
                console.log(`   Event ${index + 1}:`, {
                  timestamp: new Date(event.timestamp!).toISOString(),
                  message: event.message?.substring(0, 200) + '...'
                });
              });
            } else {
              console.log('   ⚠️ No events found related to real workflow service');
            }
            
            // Look for any success messages
            const successEvents = logEvents.events.filter(event => 
              event.message?.includes('EMAIL SENT SUCCESSFULLY') ||
              event.message?.includes('EMAIL DELIVERY SUCCESS') ||
              event.message?.includes('EVENT PROCESSING SUCCESS')
            );
            
            if (successEvents.length > 0) {
              console.log(`   ✅ Found ${successEvents.length} success events:`);
              successEvents.forEach((event, index) => {
                console.log(`   Success ${index + 1}:`, {
                  timestamp: new Date(event.timestamp!).toISOString(),
                  message: event.message?.substring(0, 300)
                });
              });
            }
          } else {
            console.log('   ⚠️ No recent events in this stream');
          }
        }
      }
    } else {
      console.log('❌ No log streams found');
    }
    
  } catch (error) {
    console.error('❌ Error checking logs:', error);
  }
}

// Run the check
if (require.main === module) {
  checkRecentLogs().then(() => {
    console.log('\n🎉 Log check completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Log check failed:', error);
    process.exit(1);
  });
}

export { checkRecentLogs };