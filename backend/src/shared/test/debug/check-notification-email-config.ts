#!/usr/bin/env npx ts-node

/**
 * Check what email address the notification service is configured to use
 */

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function checkNotificationEmailConfig() {
  console.log('📧 Checking Notification Email Configuration');
  console.log('=' .repeat(60));
  
  console.log('🔍 Looking for notification service initialization logs...');
  
  try {
    // Get recent log streams from notification service
    const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
      logGroupName: '/aws/lambda/qa-notification-service',
      orderBy: 'LastEventTime',
      descending: true,
      limit: 5
    }));

    const streams = streamsResponse.logStreams || [];
    
    for (const stream of streams) {
      if (!stream.logStreamName) continue;
      
      try {
        const eventsResponse = await logsClient.send(new GetLogEventsCommand({
          logGroupName: '/aws/lambda/qa-notification-service',
          logStreamName: stream.logStreamName,
          startTime: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
          limit: 100
        }));

        const events = eventsResponse.events || [];
        
        for (const event of events) {
          if (!event.message) continue;
          
          const message = event.message.trim();
          
          // Look for initialization messages that show the target email
          if (
            message.includes('BOOK EVENT NOTIFICATION MAPPER INITIALIZED') ||
            message.includes('targetEmail') ||
            message.includes('recipientEmail') ||
            message.includes('NOTIFICATION_TARGET_EMAIL')
          ) {
            const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : 'Unknown';
            console.log(`\\n[${timestamp}] ${message}`);
          }
        }
      } catch (streamError) {
        // Skip streams we can't access
      }
    }
    
    console.log('\\n\\n📋 Configuration Details:');
    console.log('   Environment Variable: NOTIFICATION_TARGET_EMAIL');
    console.log('   Default Value: bookmanagement@yopmail.com');
    console.log('   Location: backend/src/notification-service/services/book-event-notification-mapper.ts:31');
    
    console.log('\\n🔍 To check current value, look for:');
    console.log('   - "BOOK EVENT NOTIFICATION MAPPER INITIALIZED" log messages');
    console.log('   - Any log messages containing "recipientEmail" or "targetEmail"');
    
    console.log('\\n💡 If emails are going to wrong address:');
    console.log('   1. Check Lambda environment variables in AWS Console');
    console.log('   2. Look for NOTIFICATION_TARGET_EMAIL setting');
    console.log('   3. Update it to bookmanagement@yopmail.com if different');
    
  } catch (error) {
    console.error('❌ Error checking logs:', error);
  }
}

checkNotificationEmailConfig().catch(console.error);