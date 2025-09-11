#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const cloudWatchLogs = new AWS.CloudWatchLogs();

async function checkRecentProcessing() {
  console.log('🔍 Checking recent notification service processing...\n');
  
  const logGroupName = '/aws/lambda/qa-notification-service';
  
  try {
    // Get the most recent log streams
    const streams = await cloudWatchLogs.describeLogStreams({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 5
    }).promise();
    
    if (!streams.logStreams || streams.logStreams.length === 0) {
      console.log('❌ No log streams found');
      return;
    }
    
    console.log(`📋 Found ${streams.logStreams.length} recent log streams\n`);
    
    // Check the most recent stream for our test message
    const mostRecentStream = streams.logStreams[0];
    if (!mostRecentStream) {
      console.log('❌ No recent stream found');
      return;
    }
    
    console.log(`📋 Checking most recent stream: ${mostRecentStream.logStreamName}`);
    console.log(`   Created: ${new Date(mostRecentStream.creationTime!).toISOString()}`);
    console.log(`   Last Event: ${(mostRecentStream as any).lastEventTime ? new Date((mostRecentStream as any).lastEventTime).toISOString() : 'N/A'}`);
    
    // Get recent events from the most recent stream
    const events = await cloudWatchLogs.getLogEvents({
      logGroupName,
      logStreamName: mostRecentStream.logStreamName!,
      limit: 50,
      startFromHead: false
    }).promise();
    
    if (!events.events || events.events.length === 0) {
      console.log('   ❌ No events found in most recent stream');
      return;
    }
    
    console.log(`\n📋 Found ${events.events.length} recent events`);
    
    // Look for our test message
    const testBookId = 'test-real-workflow-';
    const recentEvents = events.events.filter(event => 
      event.timestamp! > Date.now() - (10 * 60 * 1000) // Last 10 minutes
    );
    
    console.log(`📋 Events from last 10 minutes: ${recentEvents.length}`);
    
    let foundOurMessage = false;
    let successfulProcessing = false;
    let emailSent = false;
    
    for (const event of recentEvents) {
      const message = event.message || '';
      
      if (message.includes(testBookId)) {
        foundOurMessage = true;
        console.log(`\n✅ Found our test message!`);
        console.log(`   Time: ${new Date(event.timestamp!).toISOString()}`);
        console.log(`   Content: ${message.substring(0, 200)}...`);
      }
      
      if (message.includes('EMAIL SENT SUCCESSFULLY')) {
        emailSent = true;
        console.log(`\n📧 Email sent successfully!`);
        console.log(`   Time: ${new Date(event.timestamp!).toISOString()}`);
        
        // Try to extract email details
        try {
          const logLines = message.split('\n');
          const jsonLine = logLines.find(line => line.trim().startsWith('{'));
          if (jsonLine) {
            const logData = JSON.parse(jsonLine);
            console.log(`   Book ID: ${logData.bookId}`);
            console.log(`   Email Subject: ${logData.emailSubject}`);
            console.log(`   Recipient: ${logData.recipientEmail}`);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      if (message.includes('EVENT PROCESSING SUCCESS')) {
        successfulProcessing = true;
        console.log(`\n✅ Event processed successfully!`);
        console.log(`   Time: ${new Date(event.timestamp!).toISOString()}`);
      }
      
      if (message.includes('EVENT VALIDATION FAILURE') || message.includes('Failed to extract event')) {
        console.log(`\n❌ Found validation failure:`);
        console.log(`   Time: ${new Date(event.timestamp!).toISOString()}`);
        console.log(`   Content: ${message.substring(0, 300)}...`);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Found our test message: ${foundOurMessage ? '✅' : '❌'}`);
    console.log(`   Successful processing: ${successfulProcessing ? '✅' : '❌'}`);
    console.log(`   Email sent: ${emailSent ? '✅' : '❌'}`);
    
    if (!foundOurMessage) {
      console.log('\n🤔 Our message might not have been processed yet, or it might be in a different log stream.');
      console.log('   Let\'s check a few more recent streams...');
      
      for (let i = 1; i < Math.min(3, streams.logStreams.length); i++) {
        const stream = streams.logStreams[i];
        if (!stream) continue;
        
        console.log(`\n📋 Checking stream ${i + 1}: ${stream.logStreamName}`);
        
        const streamEvents = await cloudWatchLogs.getLogEvents({
          logGroupName,
          logStreamName: stream.logStreamName!,
          limit: 20,
          startFromHead: false
        }).promise();
        
        const hasOurMessage = streamEvents.events?.some(event => 
          event.message?.includes(testBookId)
        );
        
        if (hasOurMessage) {
          console.log(`   ✅ Found our message in this stream!`);
          foundOurMessage = true;
          break;
        } else {
          console.log(`   ❌ No our message in this stream`);
        }
      }
    }
    
    if (foundOurMessage && successfulProcessing && emailSent) {
      console.log('\n🎉 SUCCESS! The workflow service message was processed successfully and email was sent!');
    } else if (foundOurMessage && !successfulProcessing) {
      console.log('\n⚠️ The message was found but processing failed');
    } else if (!foundOurMessage) {
      console.log('\n🤔 The message might still be processing or in a different log stream');
    }
    
  } catch (error) {
    console.error('❌ Error checking recent processing:', error);
  }
}

async function main() {
  try {
    await checkRecentProcessing();
    console.log('\n🎉 Check completed');
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}