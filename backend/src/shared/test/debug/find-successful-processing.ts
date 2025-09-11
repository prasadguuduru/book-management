#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const cloudWatchLogs = new AWS.CloudWatchLogs();

async function findSuccessfulProcessing() {
  console.log('🔍 Looking for any successful processing in recent logs...\n');
  
  const logGroupName = '/aws/lambda/qa-notification-service';
  
  try {
    // Get recent log streams
    const streams = await cloudWatchLogs.describeLogStreams({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 10
    }).promise();
    
    if (!streams.logStreams || streams.logStreams.length === 0) {
      console.log('❌ No log streams found');
      return;
    }
    
    console.log(`📋 Checking ${streams.logStreams.length} recent log streams for successful processing...\n`);
    
    let totalSuccessfulEmails = 0;
    let totalProcessedEvents = 0;
    let recentSuccessfulEmails = 0;
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (let i = 0; i < streams.logStreams.length; i++) {
      const stream = streams.logStreams[i];
      if (!stream) continue;
      
      console.log(`📋 Checking stream ${i + 1}: ${stream.logStreamName}`);
      
      const events = await cloudWatchLogs.getLogEvents({
        logGroupName,
        logStreamName: stream.logStreamName!,
        limit: 100,
        startFromHead: false
      }).promise();
      
      if (!events.events || events.events.length === 0) {
        console.log('   ❌ No events in this stream');
        continue;
      }
      
      let streamSuccessfulEmails = 0;
      let streamProcessedEvents = 0;
      let streamRecentSuccessfulEmails = 0;
      
      for (const event of events.events) {
        const message = event.message || '';
        const eventTime = event.timestamp || 0;
        
        if (message.includes('EMAIL SENT SUCCESSFULLY')) {
          streamSuccessfulEmails++;
          totalSuccessfulEmails++;
          
          if (eventTime > oneHourAgo) {
            streamRecentSuccessfulEmails++;
            recentSuccessfulEmails++;
            
            console.log(`   ✅ Recent successful email: ${new Date(eventTime).toISOString()}`);
            
            // Try to extract details
            try {
              const logLines = message.split('\n');
              const jsonLine = logLines.find(line => line.trim().startsWith('{'));
              if (jsonLine) {
                const logData = JSON.parse(jsonLine);
                console.log(`      Book ID: ${logData.bookId}`);
                console.log(`      Subject: ${logData.emailSubject}`);
                console.log(`      Recipient: ${logData.recipientEmail}`);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
        
        if (message.includes('EVENT PROCESSING SUCCESS')) {
          streamProcessedEvents++;
          totalProcessedEvents++;
        }
      }
      
      console.log(`   📊 Stream summary: ${streamSuccessfulEmails} emails sent, ${streamProcessedEvents} events processed, ${streamRecentSuccessfulEmails} recent emails`);
      
      if (streamSuccessfulEmails === 0 && streamProcessedEvents === 0) {
        console.log('   ⚪ No successful processing in this stream');
      }
      
      console.log('');
    }
    
    console.log('📊 Overall Summary:');
    console.log(`   Total successful emails: ${totalSuccessfulEmails}`);
    console.log(`   Total processed events: ${totalProcessedEvents}`);
    console.log(`   Recent successful emails (last hour): ${recentSuccessfulEmails}`);
    
    if (recentSuccessfulEmails > 0) {
      console.log('\n✅ GOOD NEWS: There has been recent successful email processing!');
      console.log('   This means the notification service is working correctly.');
      console.log('   The workflow service messages might be getting processed successfully.');
    } else if (totalSuccessfulEmails > 0) {
      console.log('\n⚠️ There have been successful emails in the past, but none recently.');
      console.log('   This suggests the system can work, but recent messages might be failing.');
    } else {
      console.log('\n❌ No successful email processing found in recent logs.');
      console.log('   This suggests there might be a systematic issue with the notification service.');
    }
    
  } catch (error) {
    console.error('❌ Error finding successful processing:', error);
  }
}

async function main() {
  try {
    await findSuccessfulProcessing();
    console.log('\n🎉 Search completed');
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}