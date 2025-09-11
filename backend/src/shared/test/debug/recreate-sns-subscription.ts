#!/usr/bin/env ts-node

/**
 * Recreate SNS Subscription
 * 
 * This script recreates the SNS to SQS subscription to fix delivery issues
 */

import { SNSClient, ListSubscriptionsByTopicCommand, UnsubscribeCommand, SubscribeCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'us-east-1' });

async function recreateSNSSubscription() {
  console.log('🔧 Recreating SNS to SQS subscription...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueArn = 'arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue';
  
  try {
    // List current subscriptions
    console.log('\n📋 Listing current subscriptions...');
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    if (subscriptions.Subscriptions) {
      console.log(`Found ${subscriptions.Subscriptions.length} subscriptions:`);
      
      for (const sub of subscriptions.Subscriptions) {
        console.log(`   - Protocol: ${sub.Protocol}, Endpoint: ${sub.Endpoint}`);
        console.log(`     Subscription ARN: ${sub.SubscriptionArn}`);
        
        // Unsubscribe existing SQS subscriptions
        if (sub.Protocol === 'sqs' && sub.Endpoint === queueArn && sub.SubscriptionArn !== 'PendingConfirmation') {
          console.log(`   🗑️  Unsubscribing existing SQS subscription...`);
          
          try {
            await snsClient.send(new UnsubscribeCommand({
              SubscriptionArn: sub.SubscriptionArn!
            }));
            console.log(`   ✅ Successfully unsubscribed`);
          } catch (error) {
            console.error(`   ❌ Failed to unsubscribe:`, error);
          }
        }
      }
    }
    
    // Wait a moment for unsubscription to complete
    console.log('\n⏳ Waiting 3 seconds for unsubscription to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create new subscription
    console.log('\n📡 Creating new SNS to SQS subscription...');
    const subscribeResult = await snsClient.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'sqs',
      Endpoint: queueArn
    }));
    
    console.log(`✅ New subscription created`);
    console.log(`   Subscription ARN: ${subscribeResult.SubscriptionArn}`);
    
    // Wait for confirmation
    console.log('\n⏳ Waiting 5 seconds for subscription confirmation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify new subscription
    console.log('\n🔍 Verifying new subscription...');
    const newSubscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    const sqsSubscription = newSubscriptions.Subscriptions?.find(sub => 
      sub.Protocol === 'sqs' && sub.Endpoint === queueArn
    );
    
    if (sqsSubscription) {
      console.log(`✅ Subscription verified`);
      console.log(`   Status: ${sqsSubscription.SubscriptionArn === 'PendingConfirmation' ? 'Pending' : 'Confirmed'}`);
      console.log(`   Subscription ARN: ${sqsSubscription.SubscriptionArn}`);
    } else {
      console.log(`❌ Subscription not found after creation`);
    }
    
    console.log('\n🧪 Now test the SNS to SQS delivery again');
    
  } catch (error) {
    console.error('❌ Error recreating subscription:', error);
  }
}

async function main() {
  await recreateSNSSubscription();
}

if (require.main === module) {
  main();
}

export { recreateSNSSubscription };