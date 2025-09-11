#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const sqs = new AWS.SQS();

async function findWorkflowServiceMessages() {
  console.log('🔍 Looking for actual workflow-service messages in DLQ...\n');
  
  const dlqUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq';
  
  try {
    // Get all messages from DLQ
    let allMessages: any[] = [];
    let hasMoreMessages = true;
    
    while (hasMoreMessages) {
      const result = await sqs.receiveMessage({
        QueueUrl: dlqUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
        VisibilityTimeout: 30
      }).promise();
      
      if (!result.Messages || result.Messages.length === 0) {
        hasMoreMessages = false;
      } else {
        allMessages.push(...result.Messages);
        
        // Make messages visible again
        for (const message of result.Messages) {
          if (message.ReceiptHandle) {
            await sqs.changeMessageVisibility({
              QueueUrl: dlqUrl,
              ReceiptHandle: message.ReceiptHandle,
              VisibilityTimeout: 0
            }).promise();
          }
        }
      }
    }
    
    console.log(`✅ Found ${allMessages.length} total messages in DLQ\n`);
    
    let workflowServiceMessages = 0;
    let debugScriptMessages = 0;
    let otherMessages = 0;
    
    for (let i = 0; i < allMessages.length; i++) {
      const message = allMessages[i];
      if (!message || !message.Body) continue;
      
      try {
        const parsedBody = JSON.parse(message.Body);
        if (parsedBody.Message) {
          const snsMessage = JSON.parse(parsedBody.Message);
          
          console.log(`📋 Message ${i + 1}:`);
          console.log(`  Message ID: ${message.MessageId}`);
          console.log(`  Event ID: ${snsMessage.eventId}`);
          console.log(`  Source: ${snsMessage.source}`);
          console.log(`  Timestamp: ${snsMessage.timestamp}`);
          console.log(`  Book ID: ${snsMessage.data?.bookId}`);
          console.log(`  Title: ${snsMessage.data?.title}`);
          
          if (snsMessage.source === 'workflow-service') {
            workflowServiceMessages++;
            console.log('  🎯 This is a WORKFLOW SERVICE message!');
            
            // Analyze why it failed
            console.log('  🔍 Validation analysis:');
            const issues = [];
            
            if (!snsMessage.eventType) issues.push('Missing eventType');
            if (!snsMessage.eventId) issues.push('Missing eventId');
            if (snsMessage.source !== 'workflow-service') issues.push('Invalid source');
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
              console.log('    ✅ No obvious validation issues - this should have worked!');
            } else {
              console.log('    ❌ Validation issues:');
              issues.forEach(issue => console.log(`      - ${issue}`));
            }
            
          } else if (snsMessage.source === 'debug-script') {
            debugScriptMessages++;
            console.log('  🧪 This is a DEBUG SCRIPT message (expected to fail)');
          } else {
            otherMessages++;
            console.log(`  ❓ This is from source: ${snsMessage.source}`);
          }
          
          console.log('');
        }
      } catch (e) {
        console.log(`❌ Could not parse message ${i + 1}`);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`  Workflow Service messages: ${workflowServiceMessages}`);
    console.log(`  Debug Script messages: ${debugScriptMessages}`);
    console.log(`  Other messages: ${otherMessages}`);
    
    if (workflowServiceMessages === 0) {
      console.log('\n🎯 CONCLUSION: No actual workflow-service messages found in DLQ!');
      console.log('   This means the workflow service is either:');
      console.log('   1. Not publishing messages at all');
      console.log('   2. Publishing messages that are being processed successfully');
      console.log('   3. Publishing messages with a different source value');
    } else {
      console.log(`\n🎯 CONCLUSION: Found ${workflowServiceMessages} workflow-service messages in DLQ!`);
      console.log('   These messages should have been processed but failed validation.');
    }
    
  } catch (error) {
    console.error('❌ Error finding workflow service messages:', error);
  }
}

async function main() {
  try {
    await findWorkflowServiceMessages();
    console.log('\n🎉 Search completed');
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}