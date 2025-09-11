#!/usr/bin/env npx ts-node

/**
 * Check recent logs for the SUBMIT action that just happened
 */

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function checkRecentSubmitLogs() {
  console.log('🔍 Checking Recent SUBMIT Logs');
  console.log('=' .repeat(60));
  
  const bookId = 'fd626c65-0662-48db-be36-4cd66e435b50';
  const lookbackMinutes = 10; // Look back 10 minutes
  const startTime = Date.now() - (lookbackMinutes * 60 * 1000);
  
  console.log(`📋 Looking for logs since ${new Date(startTime).toISOString()}`);
  console.log(`📋 Book ID: ${bookId}`);
  console.log('📋 Action: SUBMIT (DRAFT → SUBMITTED_FOR_EDITING)');
  console.log('');

  const logGroups = [
    { name: '/aws/lambda/qa-workflow-service', label: '🔧 WORKFLOW' },
    { name: '/aws/lambda/qa-notification-service', label: '📧 NOTIFICATION' }
  ];

  for (const logGroup of logGroups) {
    console.log(`\\n${logGroup.label} SERVICE LOGS:`);
    console.log('-'.repeat(50));
    
    try {
      // Get recent log streams
      const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
        logGroupName: logGroup.name,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 3
      }));

      const streams = streamsResponse.logStreams || [];
      
      for (const stream of streams) {
        if (!stream.logStreamName) continue;
        
        try {
          const eventsResponse = await logsClient.send(new GetLogEventsCommand({
            logGroupName: logGroup.name,
            logStreamName: stream.logStreamName,
            startTime: startTime,
            limit: 100
          }));

          const events = eventsResponse.events || [];
          const relevantEvents = events.filter(event => {
            if (!event.message) return false;
            const message = event.message.toLowerCase();
            return (
              message.includes('submit') ||
              message.includes(bookId.toLowerCase()) ||
              message.includes('draft') ||
              message.includes('submitted_for_editing') ||
              message.includes('initiating event publishing') ||
              message.includes('sns publish') ||
              message.includes('sqs event detected') ||
              message.includes('book_submitted') ||
              message.includes('email sent') ||
              message.includes('error') ||
              message.includes('failure')
            );
          });

          if (relevantEvents.length > 0) {
            console.log(`\\n📋 Stream: ${stream.logStreamName}`);
            relevantEvents.forEach(event => {
              if (event.timestamp && event.message) {
                const timestamp = new Date(event.timestamp).toISOString();
                console.log(`[${timestamp}] ${event.message.trim()}`);
              }
            });
          }
        } catch (streamError) {
          // Skip streams we can't access
        }
      }
    } catch (error) {
      console.log(`❌ Could not access ${logGroup.name}: ${error}`);
    }
  }
  
  console.log('\\n\\n🎯 WHAT TO LOOK FOR (SUBMIT ACTION):');
  console.log('✅ Workflow service should show: "SUBMIT" action');
  console.log('✅ Workflow service should show: "DRAFT -> SUBMITTED_FOR_EDITING"');
  console.log('✅ Workflow service should show: "INITIATING EVENT PUBLISHING"');
  console.log('✅ Workflow service should show: "SNS PUBLISH SUCCESS"');
  console.log('✅ Notification service should show: "SQS EVENT DETECTED"');
  console.log('✅ Notification service should show: "book_submitted"');
  console.log('✅ Notification service should show: "EMAIL SENT"');
  console.log('');
  console.log('❌ If missing any of these, that is where the issue is!');
}

checkRecentSubmitLogs().catch(console.error);