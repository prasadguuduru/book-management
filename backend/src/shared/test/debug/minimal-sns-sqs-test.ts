#!/usr/bin/env npx ts-node

/**
 * Minimal SNS-SQS test to isolate the issue
 * Following AWS triage guide section 7
 */

import { SNSClient, CreateTopicCommand, PublishCommand, SubscribeCommand, DeleteTopicCommand } from '@aws-sdk/client-sns';
import { SQSClient, CreateQueueCommand, GetQueueAttributesCommand, SetQueueAttributesCommand, ReceiveMessageCommand, DeleteQueueCommand, GetQueueUrlCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function minimalSNSSQSTest() {
  console.log('🧪 Running minimal SNS-SQS test...');
  
  const testTopicName = 'triage-test-' + Date.now();
  const testQueueName = 'triage-test-' + Date.now();
  
  let topicArn: string | undefined;
  let queueUrl: string | undefined;
  let queueArn: string | undefined;
  let subscriptionArn: string | undefined;
  
  try {
    // 1. Create test topic (unencrypted)
    console.log('\n📡 Creating test SNS topic...');
    const topicResult = await snsClient.send(new CreateTopicCommand({
      Name: testTopicName
    }));
    topicArn = topicResult.TopicArn;
    console.log(`✅ Created topic: ${topicArn}`);
    
    // 2. Create test queue (unencrypted)
    console.log('\n📨 Creating test SQS queue...');
    const queueResult = await sqsClient.send(new CreateQueueCommand({
      QueueName: testQueueName
    }));
    queueUrl = queueResult.QueueUrl;
    console.log(`✅ Created queue: ${queueUrl}`);
    
    // 3. Get queue ARN
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn']
    }));
    queueArn = queueAttrs.Attributes?.['QueueArn'];
    console.log(`📋 Queue ARN: ${queueArn}`);
    
    // 4. Set queue policy
    console.log('\n🔐 Setting queue policy...');
    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { Service: 'sns.amazonaws.com' },
        Action: 'sqs:SendMessage',
        Resource: queueArn,
        Condition: {
          ArnEquals: { 'aws:SourceArn': topicArn }
        }
      }]
    };
    
    await sqsClient.send(new SetQueueAttributesCommand({
      QueueUrl: queueUrl,
      Attributes: {
        Policy: JSON.stringify(policy)
      }
    }));
    console.log('✅ Queue policy set');
    
    // 5. Subscribe queue to topic
    console.log('\n🔗 Creating subscription...');
    const subscribeResult = await snsClient.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'sqs',
      Endpoint: queueArn
    }));
    subscriptionArn = subscribeResult.SubscriptionArn;
    console.log(`✅ Subscription created: ${subscriptionArn}`);
    
    // 6. Wait for subscription confirmation
    console.log('\n⏳ Waiting 3 seconds for subscription confirmation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 7. Publish test message
    console.log('\n📤 Publishing test message...');
    const publishResult = await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Message: 'Hello from minimal test!',
      Subject: 'Test Message'
    }));
    console.log(`✅ Message published: ${publishResult.MessageId}`);
    
    // 8. Check for message delivery
    console.log('\n📨 Checking for message delivery...');
    for (let i = 1; i <= 6; i++) {
      console.log(`   Attempt ${i}/6...`);
      
      const receiveResult = await sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 2
      }));
      
      if (receiveResult.Messages && receiveResult.Messages.length > 0) {
        console.log('✅ SUCCESS: Message received in test setup!');
        const message = receiveResult.Messages[0];
        console.log(`   Message ID: ${message?.MessageId || 'N/A'}`);
        console.log(`   Body preview: ${message?.Body?.substring(0, 100) || 'N/A'}...`);
        
        // This means the issue is with our original configuration
        console.log('\n🎯 CONCLUSION: Minimal setup works!');
        console.log('   The issue is with the original topic/queue configuration.');
        console.log('   Likely causes:');
        console.log('   1. KMS encryption mismatch');
        console.log('   2. Queue policy issue');
        console.log('   3. Topic/queue corruption');
        break;
      }
      
      if (i === 6) {
        console.log('❌ FAILURE: No message received in test setup');
        console.log('   This indicates a broader AWS account or service issue');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error('❌ Error in minimal test:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test resources...');
    try {
      if (topicArn) {
        await snsClient.send(new DeleteTopicCommand({ TopicArn: topicArn }));
        console.log('✅ Test topic deleted');
      }
      if (queueUrl) {
        await sqsClient.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
        console.log('✅ Test queue deleted');
      }
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup error:', cleanupError);
    }
  }
}

minimalSNSSQSTest().catch(console.error);