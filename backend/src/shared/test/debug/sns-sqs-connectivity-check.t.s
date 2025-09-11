#!/usr/bin/env ts-node

import { SNSClient, ListSubscriptionsCommand, GetSubscriptionAttributesCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand, ListQueuesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function checkSNSSQSConnectivity() {
  console.log('🔍 Checking SNS-SQS Connectivity...\n');

  try {
    // 1. List all SNS subscriptions
    console.log('📋 Listing SNS Subscriptions:');
    const subscriptions = await snsClient.send(new ListSubscriptionsCommand({}));
    
    if (!subscriptions.Subscriptions || subscriptions.Subscriptions.length === 0) {
      console.log('❌ No SNS subscriptions found!');
      return;
    }

    for (const sub of subscriptions.Subscriptions) {
      console.log(`  Topic: ${sub.TopicArn}`);
      console.log(`  Protocol: ${sub.Protocol}`);
      console.log(`  Endpoint: ${sub.Endpoint}`);
      console.log(`  Status: ${sub.SubscriptionArn === 'PendingConfirmation' ? '⏳ Pending' : '✅ Confirmed'}`);
      
      // Get detailed subscription attributes
      if (sub.SubscriptionArn && sub.SubscriptionArn !== 'PendingConfirmation') {
        try {
          const attrs = await snsClient.send(new GetSubscriptionAttributesCommand({
            SubscriptionArn: sub.SubscriptionArn
          }));
          
          console.log('  Attributes:');
          console.log(`    DeliveryPolicy: ${attrs.Attributes?.DeliveryPolicy || 'None'}`);
          console.log(`    FilterPolicy: ${attrs.Attributes?.FilterPolicy || 'None'}`);
          console.log(`    RawMessageDelivery: ${attrs.Attributes?.RawMessageDelivery || 'false'}`);
          console.log(`    RedrivePolicy: ${attrs.Attributes?.RedrivePolicy || 'None'}`);
        } catch (error) {
          console.log(`    ❌ Error getting subscription attributes: ${error}`);
        }
      }
      console.log('');
    }

    // 2. Check SQS queues and their policies
    console.log('📋 Checking SQS Queues:');
    const queues = await sqsClient.send(new ListQueuesCommand({}));
    
    if (!queues.QueueUrls || queues.QueueUrls.length === 0) {
      console.log('❌ No SQS queues found!');
      return;
    }

    for (const queueUrl of queues.QueueUrls) {
      const queueName = queueUrl.split('/').pop();
      console.log(`\n🔍 Queue: ${queueName}`);
      console.log(`  URL: ${queueUrl}`);
      
      try {
        const attrs = await sqsClient.send(new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['All']
        }));

        console.log('  Attributes:');
        console.log(`    ApproximateNumberOfMessages: ${attrs.Attributes?.ApproximateNumberOfMessages || '0'}`);
        console.log(`    ApproximateNumberOfMessagesNotVisible: ${attrs.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'}`);
        console.log(`    ApproximateNumberOfMessagesDelayed: ${attrs.Attributes?.ApproximateNumberOfMessagesDelayed || '0'}`);
        
        // Check queue policy for SNS permissions
        if (attrs.Attributes?.Policy) {
          console.log('  Queue Policy:');
          try {
            const policy = JSON.parse(attrs.Attributes.Policy);
            console.log(`    ${JSON.stringify(policy, null, 4)}`);
          } catch (e) {
            console.log(`    Raw Policy: ${attrs.Attributes.Policy}`);
          }
        } else {
          console.log('  ❌ No queue policy found - this might be the issue!');
        }

        // Check redrive policy
        if (attrs.Attributes?.RedrivePolicy) {
          console.log('  Redrive Policy:');
          try {
            const redrivePolicy = JSON.parse(attrs.Attributes.RedrivePolicy);
            console.log(`    ${JSON.stringify(redrivePolicy, null, 4)}`);
          } catch (e) {
            console.log(`    Raw Redrive Policy: ${attrs.Attributes.RedrivePolicy}`);
          }
        }

      } catch (error) {
        console.log(`  ❌ Error getting queue attributes: ${error}`);
      }
    }

    // 3. Test message flow by checking for recent activity
    console.log('\n📊 Checking Recent Message Activity:');
    
    // Look for notification-related queues
    const notificationQueues = queues.QueueUrls?.filter(url => 
      url.includes('notification') || url.includes('book-event')
    ) || [];

    if (notificationQueues.length === 0) {
      console.log('❌ No notification-related queues found');
    } else {
      for (const queueUrl of notificationQueues) {
        const queueName = queueUrl.split('/').pop();
        console.log(`\n📈 Activity for ${queueName}:`);
        
        try {
          const attrs = await sqsClient.send(new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: [
              'ApproximateNumberOfMessages',
              'ApproximateNumberOfMessagesNotVisible',
              'ApproximateNumberOfMessagesDelayed',
              'LastModifiedTimestamp'
            ]
          }));

          const messages = parseInt(attrs.Attributes?.ApproximateNumberOfMessages || '0');
          const processing = parseInt(attrs.Attributes?.ApproximateNumberOfMessagesNotVisible || '0');
          const delayed = parseInt(attrs.Attributes?.ApproximateNumberOfMessagesDelayed || '0');
          const lastModified = attrs.Attributes?.LastModifiedTimestamp;

          console.log(`  Messages waiting: ${messages}`);
          console.log(`  Messages processing: ${processing}`);
          console.log(`  Messages delayed: ${delayed}`);
          console.log(`  Last modified: ${lastModified ? new Date(parseInt(lastModified) * 1000).toISOString() : 'Unknown'}`);

          if (messages === 0 && processing === 0 && delayed === 0) {
            console.log('  🤔 No messages in queue - either not receiving or processing quickly');
          }

        } catch (error) {
          console.log(`  ❌ Error checking activity: ${error}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during connectivity check:', error);
  }
}

// Run the check
checkSNSSQSConnectivity().catch(console.error);