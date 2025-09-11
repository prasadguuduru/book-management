#!/usr/bin/env npx ts-node

/**
 * Real-time log monitoring for approval workflow
 * Run this and then trigger the approval to see what happens
 */

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function monitorApprovalLogs() {
  console.log('🔍 Monitoring Approval Workflow Logs');
  console.log('=' .repeat(60));
  console.log('📋 Watching for:');
  console.log('   1. Workflow service: APPROVE action');
  console.log('   2. Event publishing: SNS publish attempts');
  console.log('   3. Notification service: SQS message processing');
  console.log('   4. Email sending: SES email attempts');
  console.log('');
  console.log('🚀 Ready! Now trigger the approval in your dashboard...');
  console.log('');

  const logGroups = [
    '/aws/lambda/qa-workflow-service',
    '/aws/lambda/qa-notification-service'
  ];

  const startTime = Date.now();
  let lastCheckedTime = startTime;

  // Monitor logs every 2 seconds
  setInterval(async () => {
    for (const logGroupName of logGroups) {
      try {
        // Get the most recent log stream
        const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
          logGroupName,
          orderBy: 'LastEventTime',
          descending: true,
          limit: 1
        }));

        const latestStream = streamsResponse.logStreams?.[0];
        if (!latestStream?.logStreamName) continue;

        // Get recent log events
        const eventsResponse = await logsClient.send(new GetLogEventsCommand({
          logGroupName,
          logStreamName: latestStream.logStreamName,
          startTime: lastCheckedTime,
          limit: 50
        }));

        const events = eventsResponse.events || [];
        
        for (const event of events) {
          if (!event.message || !event.timestamp) continue;
          
          const timestamp = new Date(event.timestamp).toISOString();
          const message = event.message.trim();
          
          // Filter for relevant messages
          if (
            message.includes('APPROVE') ||
            message.includes('INITIATING EVENT PUBLISHING') ||
            message.includes('CALLING EVENT PUBLISHER') ||
            message.includes('SNS PUBLISH') ||
            message.includes('SQS EVENT DETECTED') ||
            message.includes('book_approved') ||
            message.includes('EMAIL SENT') ||
            message.includes('c4b7a46c-9004-438f-8282-9ad5535540d5') || // Your book ID
            message.includes('ERROR') ||
            message.includes('FAILURE')
          ) {
            const service = logGroupName.includes('workflow') ? '🔧 WORKFLOW' : '📧 NOTIFICATION';
            console.log(`[${timestamp}] ${service}: ${message}`);
          }
        }
      } catch (error) {
        // Ignore errors for missing log groups
      }
    }
    
    lastCheckedTime = Date.now();
  }, 2000);

  // Keep the script running
  process.on('SIGINT', () => {
    console.log('\\n\\n📊 Monitoring stopped. Summary:');
    console.log('   - Look for "INITIATING EVENT PUBLISHING" in workflow logs');
    console.log('   - Look for "SNS PUBLISH SUCCESS" messages');
    console.log('   - Look for "SQS EVENT DETECTED" in notification logs');
    console.log('   - Look for "EMAIL SENT" confirmation');
    process.exit(0);
  });
}

monitorApprovalLogs().catch(console.error);