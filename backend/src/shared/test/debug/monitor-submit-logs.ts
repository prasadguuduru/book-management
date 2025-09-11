#!/usr/bin/env npx ts-node

/**
 * Monitor logs for submit email delivery
 * Run this while manually submitting a book to see email confirmation
 */

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function monitorSubmitLogs() {
  console.log('📧 Monitoring Submit Email Logs');
  console.log('=' .repeat(60));
  console.log('🚀 Ready! Now submit a book in your dashboard...');
  console.log('   Looking for:');
  console.log('   - book_submitted notification type');
  console.log('   - EMAIL SENT SUCCESSFULLY messages');
  console.log('   - SES delivery to bookmanagement@yopmail.com');
  console.log('');

  const startTime = Date.now();
  let lastCheckedTime = startTime;

  // Monitor logs every 3 seconds
  const interval = setInterval(async () => {
    try {
      // Check notification service logs
      const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
        logGroupName: '/aws/lambda/qa-notification-service',
        orderBy: 'LastEventTime',
        descending: true,
        limit: 2
      }));

      const streams = streamsResponse.logStreams || [];
      
      for (const stream of streams) {
        if (!stream.logStreamName) continue;
        
        try {
          const eventsResponse = await logsClient.send(new GetLogEventsCommand({
            logGroupName: '/aws/lambda/qa-notification-service',
            logStreamName: stream.logStreamName,
            startTime: lastCheckedTime,
            limit: 50
          }));

          const events = eventsResponse.events || [];
          
          for (const event of events) {
            if (!event.message || !event.timestamp) continue;
            
            const timestamp = new Date(event.timestamp).toISOString();
            const message = event.message.trim();
            
            // Filter for submit-related messages
            if (
              message.includes('book_submitted') ||
              message.includes('DRAFT_to_SUBMITTED_FOR_EDITING') ||
              message.includes('Book Submitted for Review') ||
              message.includes('EMAIL SENT SUCCESSFULLY') ||
              message.includes('SQS EVENT DETECTED') ||
              message.includes('NOTIFICATION REQUEST CREATED')
            ) {
              console.log(`[${timestamp}] 📧 ${message}`);
              
              // Try to extract key details
              try {
                const logData = JSON.parse(message.split('\\t').pop() || '{}');
                if (logData.recipientEmail === 'bookmanagement@yopmail.com') {
                  console.log(`   🎯 CONFIRMED: Email to ${logData.recipientEmail}`);
                }
                if (logData.emailSubject && logData.emailSubject.includes('Book Submitted for Review')) {
                  console.log(`   📧 SUBJECT: ${logData.emailSubject}`);
                }
                if (logData.messageId && logData.message === '✅ EMAIL SENT SUCCESSFULLY') {
                  console.log(`   ✅ SES MESSAGE ID: ${logData.messageId}`);
                  console.log('   🎉 EMAIL DELIVERY CONFIRMED!');
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        } catch (streamError) {
          // Skip streams we can't access
        }
      }
      
      lastCheckedTime = Date.now();
    } catch (error) {
      console.error('Error monitoring logs:', error);
    }
  }, 3000);

  // Keep the script running
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\\n\\n📊 Monitoring stopped.');
    console.log('\\n🎯 What to look for in the logs:');
    console.log('✅ "NOTIFICATION REQUEST CREATED" with notificationType: "book_submitted"');
    console.log('✅ "EMAIL DELIVERY ATTEMPT" with recipientEmail: "bookmanagement@yopmail.com"');
    console.log('✅ "EMAIL SENT SUCCESSFULLY" with SES message ID');
    console.log('✅ Subject: "📚 Book Submitted for Review: [Book Title]"');
    console.log('\\n📧 If you see all these, the submit email is working correctly!');
    process.exit(0);
  });
  
  console.log('Press Ctrl+C to stop monitoring...');
}

monitorSubmitLogs().catch(console.error);