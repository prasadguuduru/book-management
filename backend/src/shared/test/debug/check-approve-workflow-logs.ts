#!/usr/bin/env npx ts-node

/**
 * Check CloudWatch logs for the approve workflow action
 */

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function checkApproveWorkflowLogs() {
  console.log('🔍 Checking CloudWatch logs for approve workflow action...');
  console.log('=' .repeat(60));
  
  const bookId = 'c4b7a46c-9004-438f-8282-9ad5535540d5';
  const logGroupName = '/aws/lambda/qa-workflow-service';
  
  try {
    // Get recent log streams
    console.log('\\n📋 Getting recent log streams...');
    const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 5
    }));
    
    if (!streamsResponse.logStreams || streamsResponse.logStreams.length === 0) {
      console.log('❌ No log streams found');
      return;
    }
    
    console.log(`✅ Found ${streamsResponse.logStreams.length} recent log streams`);
    
    // Check the most recent log streams for approve-related events
    for (const stream of streamsResponse.logStreams.slice(0, 3)) {
      console.log(`\\n🔍 Checking stream: ${stream.logStreamName}`);
      console.log(`   Last event: ${new Date((stream as any).lastEventTime || 0).toISOString()}`);
      
      try {
        const eventsResponse = await logsClient.send(new GetLogEventsCommand({
          logGroupName,
          logStreamName: stream.logStreamName,
          startTime: Date.now() - (30 * 60 * 1000), // Last 30 minutes
          limit: 100
        }));
        
        if (!eventsResponse.events || eventsResponse.events.length === 0) {
          console.log('   📝 No recent events in this stream');
          continue;
        }
        
        // Look for events related to our book ID or approve action
        const relevantEvents = eventsResponse.events.filter(event => 
          event.message && (
            event.message.includes(bookId) ||
            event.message.includes('APPROVE') ||
            event.message.includes('approve') ||
            event.message.includes('INITIATING EVENT PUBLISHING') ||
            event.message.includes('CALLING EVENT PUBLISHER') ||
            event.message.includes('SUCCESSFULLY PUBLISHED') ||
            event.message.includes('SUBMITTED_FOR_EDITING') ||
            event.message.includes('READY_FOR_PUBLICATION')
          )
        );
        
        if (relevantEvents.length > 0) {
          console.log(`   ✅ Found ${relevantEvents.length} relevant events:`);
          
          relevantEvents.forEach((event, index) => {
            const timestamp = new Date(event.timestamp || 0).toISOString();
            const message = event.message?.substring(0, 200) + (event.message && event.message.length > 200 ? '...' : '');
            console.log(`   ${index + 1}. [${timestamp}] ${message}`);
          });
        } else {
          console.log('   📝 No relevant events found in this stream');
        }
        
      } catch (streamError) {
        console.log(`   ❌ Error reading stream: ${streamError}`);
      }
    }
    
    console.log('\\n🎯 What to look for:');
    console.log('✅ "INITIATING EVENT PUBLISHING FOR WORKFLOW TRANSITION" - Workflow service is trying to publish');
    console.log('✅ "CALLING EVENT PUBLISHER" - Event publisher is being called');
    console.log('✅ "SUCCESSFULLY PUBLISHED BOOK STATUS CHANGE EVENT" - Event was published to SNS');
    console.log('❌ If you do not see these messages, the workflow service is not publishing events');
    
    console.log('\\n📧 Also check notification service logs:');
    console.log('Log group: /aws/lambda/qa-notification-service');
    console.log('Look for: "SQS EVENT DETECTED", "book_approved", "EMAIL SENT SUCCESSFULLY"');
    
  } catch (error) {
    console.error('❌ Error checking logs:', error);
  }
}

checkApproveWorkflowLogs().catch(console.error);