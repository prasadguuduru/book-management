#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const sqs = new AWS.SQS();

async function analyzeDLQMessages() {
  console.log('🔍 Analyzing DLQ messages...\n');
  
  const dlqUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq';
  
  try {
    // Get messages from DLQ
    const result = await sqs.receiveMessage({
      QueueUrl: dlqUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
      VisibilityTimeout: 30,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All']
    }).promise();
    
    if (!result.Messages || result.Messages.length === 0) {
      console.log('❌ No messages in DLQ');
      return;
    }
    
    console.log(`✅ Found ${result.Messages.length} messages in DLQ\n`);
    
    for (let i = 0; i < result.Messages.length; i++) {
      const message = result.Messages[i];
      if (!message) continue;
      
      console.log(`📋 DLQ Message ${i + 1}:`);
      console.log('  Message ID:', message.MessageId);
      console.log('  Attributes:', JSON.stringify(message.Attributes, null, 2));
      console.log('  Message Attributes:', JSON.stringify(message.MessageAttributes, null, 2));
      
      console.log('\n📄 Raw Body:');
      console.log(message.Body);
      
      if (!message.Body) {
        console.log('❌ Message has no body');
        continue;
      }
      
      try {
        const parsedBody = JSON.parse(message.Body);
        console.log('\n📄 Parsed Body:');
        console.log(JSON.stringify(parsedBody, null, 2));
        
        if (parsedBody.Message) {
          console.log('\n📄 SNS Message Content:');
          try {
            const snsMessage = JSON.parse(parsedBody.Message);
            console.log(JSON.stringify(snsMessage, null, 2));
            
            // Analyze the event structure
            console.log('\n🔍 Event Analysis:');
            console.log('  Event Type:', snsMessage.eventType);
            console.log('  Event ID:', snsMessage.eventId);
            console.log('  Source:', snsMessage.source);
            console.log('  Version:', snsMessage.version);
            console.log('  Timestamp:', snsMessage.timestamp);
            
            if (snsMessage.data) {
              console.log('  Data:');
              console.log('    Book ID:', snsMessage.data.bookId);
              console.log('    Title:', snsMessage.data.title);
              console.log('    Author:', snsMessage.data.author);
              console.log('    Previous Status:', snsMessage.data.previousStatus);
              console.log('    New Status:', snsMessage.data.newStatus);
              console.log('    Changed By:', snsMessage.data.changedBy);
              console.log('    Metadata:', JSON.stringify(snsMessage.data.metadata, null, 2));
            }
            
            // Check for validation issues
            console.log('\n🔍 Validation Check:');
            const issues = [];
            
            if (!snsMessage.eventType) issues.push('Missing eventType');
            if (!snsMessage.eventId) issues.push('Missing eventId');
            if (!snsMessage.source) issues.push('Missing source');
            if (!snsMessage.version) issues.push('Missing version');
            if (!snsMessage.timestamp) issues.push('Missing timestamp');
            if (!snsMessage.data) issues.push('Missing data');
            
            if (snsMessage.data) {
              if (!snsMessage.data.bookId) issues.push('Missing data.bookId');
              if (!snsMessage.data.title) issues.push('Missing data.title');
              if (!snsMessage.data.author) issues.push('Missing data.author');
              if (!snsMessage.data.newStatus) issues.push('Missing data.newStatus');
              if (!snsMessage.data.changedBy) issues.push('Missing data.changedBy');
            }
            
            if (issues.length === 0) {
              console.log('  ✅ No obvious validation issues found');
            } else {
              console.log('  ❌ Validation issues found:');
              issues.forEach(issue => console.log(`    - ${issue}`));
            }
            
          } catch (e) {
            console.log('❌ Could not parse SNS Message as JSON');
            console.log('Raw SNS Message:', parsedBody.Message);
          }
        }
      } catch (e) {
        console.log('❌ Could not parse body as JSON');
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
      
      // Make message visible again
      if (message.ReceiptHandle) {
        await sqs.changeMessageVisibility({
          QueueUrl: dlqUrl,
          ReceiptHandle: message.ReceiptHandle,
          VisibilityTimeout: 0
        }).promise();
      }
    }
    
  } catch (error) {
    console.error('❌ Error analyzing DLQ messages:', error);
  }
}

async function main() {
  try {
    await analyzeDLQMessages();
    console.log('🎉 DLQ analysis completed');
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}