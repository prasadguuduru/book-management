#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const sqs = new AWS.SQS();

async function quickDLQCheck() {
  console.log('🔍 Quick DLQ check for workflow-service messages...\n');
  
  const dlqUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq';
  
  try {
    // Get just a few messages
    const result = await sqs.receiveMessage({
      QueueUrl: dlqUrl,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 1,
      VisibilityTimeout: 10
    }).promise();
    
    if (!result.Messages || result.Messages.length === 0) {
      console.log('❌ No messages in DLQ');
      return;
    }
    
    console.log(`✅ Found ${result.Messages.length} messages to check\n`);
    
    let workflowServiceCount = 0;
    let debugScriptCount = 0;
    
    for (let i = 0; i < result.Messages.length; i++) {
      const message = result.Messages[i];
      if (!message || !message.Body) continue;
      
      try {
        const parsedBody = JSON.parse(message.Body);
        if (parsedBody.Message) {
          const snsMessage = JSON.parse(parsedBody.Message);
          
          console.log(`📋 Message ${i + 1}: ${snsMessage.source} - ${snsMessage.data?.bookId}`);
          
          if (snsMessage.source === 'workflow-service') {
            workflowServiceCount++;
          } else if (snsMessage.source === 'debug-script') {
            debugScriptCount++;
          }
        }
      } catch (e) {
        console.log(`❌ Could not parse message ${i + 1}`);
      }
      
      // Make message visible again
      if (message.ReceiptHandle) {
        await sqs.changeMessageVisibility({
          QueueUrl: dlqUrl,
          ReceiptHandle: message.ReceiptHandle,
          VisibilityTimeout: 0
        }).promise();
      }
    }
    
    console.log(`\n📊 In this sample:`);
    console.log(`  Workflow Service: ${workflowServiceCount}`);
    console.log(`  Debug Script: ${debugScriptCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  quickDLQCheck().catch(console.error);
}