#!/usr/bin/env ts-node

/**
 * Check SNS Subscription Details
 * 
 * This script checks the detailed configuration of the SNS subscription
 * to identify why message delivery is failing.
 */

import { SNSClient, GetTopicAttributesCommand, GetSubscriptionAttributesCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function checkSubscriptionConfiguration() {
  console.log('🔍 Checking detailed SNS subscription configuration...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  // 1. Get topic attributes
  console.log('\n📡 SNS Topic Attributes:');
  await checkTopicAttributes(topicArn);
  
  // 2. Get subscription details
  console.log('\n🔗 SNS Subscription Details:');
  await checkSubscriptionDetails(topicArn);
  
  // 3. Get queue attributes
  console.log('\n📨 SQS Queue Attributes:');
  await checkQueueAttributes(queueUrl);
  
  // 4. Verify ARN matching
  console.log('\n🔍 ARN Verification:');
  await verifyARNMatching(queueUrl);
}

async function checkTopicAttributes(topicArn: string) {
  try {
    const result = await snsClient.send(new GetTopicAttributesCommand({
      TopicArn: topicArn
    }));
    
    if (result.Attributes) {
      console.log(`  Topic ARN: ${(result.Attributes as any)['TopicArn'] || 'Not set'}`);
      console.log(`  Display Name: ${(result.Attributes as any)['DisplayName'] || 'None'}`);
      console.log(`  Subscriptions Confirmed: ${(result.Attributes as any)['SubscriptionsConfirmed'] || 'Not set'}`);
      console.log(`  Subscriptions Pending: ${(result.Attributes as any)['SubscriptionsPending'] || 'Not set'}`);
      console.log(`  Subscriptions Deleted: ${(result.Attributes as any)['SubscriptionsDeleted'] || 'Not set'}`);
      
      if ((result.Attributes as any)['Policy']) {
        const policy = JSON.parse((result.Attributes as any)['Policy']!);
        console.log(`  Topic Policy: ${policy.Statement?.length || 0} statements`);
      } else {
        console.log(`  Topic Policy: None`);
      }
    }
  } catch (error) {
    console.error('  ❌ Error getting topic attributes:', error);
  }
}

async function checkSubscriptionDetails(topicArn: string) {
  try {
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    if (subscriptions.Subscriptions) {
      for (const sub of subscriptions.Subscriptions) {
        console.log(`\n  📡 Subscription: ${sub.SubscriptionArn}`);
        
        if (sub.SubscriptionArn && sub.SubscriptionArn !== 'PendingConfirmation') {
          const details = await snsClient.send(new GetSubscriptionAttributesCommand({
            SubscriptionArn: sub.SubscriptionArn
          }));
          
          if (details.Attributes) {
            console.log(`     Protocol: ${details.Attributes['Protocol']}`);
            console.log(`     Endpoint: ${details.Attributes['Endpoint']}`);
            console.log(`     Confirmed: ${details.Attributes['ConfirmationWasAuthenticated']}`);
            console.log(`     Raw Message Delivery: ${details.Attributes['RawMessageDelivery'] || 'false'}`);
            console.log(`     Delivery Policy: ${details.Attributes['DeliveryPolicy'] || 'Default'}`);
            console.log(`     Filter Policy: ${details.Attributes['FilterPolicy'] || 'None'}`);
            console.log(`     Redrive Policy: ${details.Attributes['RedrivePolicy'] || 'None'}`);
            
            // Check for any delivery issues
            if (details.Attributes['EffectiveDeliveryPolicy']) {
              console.log(`     Effective Delivery Policy: ${details.Attributes['EffectiveDeliveryPolicy']}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('  ❌ Error getting subscription details:', error);
  }
}

async function checkQueueAttributes(queueUrl: string) {
  try {
    const result = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    }));
    
    if (result.Attributes) {
      console.log(`  Queue URL: ${queueUrl}`);
      console.log(`  Queue ARN: ${result.Attributes?.['QueueArn'] || 'Not set'}`);
      console.log(`  Visibility Timeout: ${result.Attributes?.['VisibilityTimeout'] || 'Not set'}s`);
      console.log(`  Message Retention: ${result.Attributes?.['MessageRetentionPeriod'] || 'Not set'}s`);
      console.log(`  Max Receive Count: ${(result.Attributes as any)?.['MaxReceiveCount'] || 'Not set'}`);
      console.log(`  Dead Letter Queue: ${result.Attributes?.['RedrivePolicy'] || 'None'}`);
      
      if (result.Attributes?.['Policy']) {
        const policy = JSON.parse(result.Attributes['Policy']!);
        console.log(`  Queue Policy: ${policy.Statement?.length || 0} statements`);
        
        // Check SNS permissions in detail
        policy.Statement?.forEach((stmt: any, index: number) => {
          if (stmt.Principal?.Service === 'sns.amazonaws.com' || stmt.Principal === 'sns.amazonaws.com') {
            console.log(`     SNS Statement ${index + 1}:`);
            console.log(`       Effect: ${stmt.Effect}`);
            console.log(`       Action: ${stmt.Action}`);
            console.log(`       Resource: ${stmt.Resource}`);
            console.log(`       Condition: ${JSON.stringify(stmt.Condition || {})}`);
          }
        });
      }
    }
  } catch (error) {
    console.error('  ❌ Error getting queue attributes:', error);
  }
}

async function verifyARNMatching(queueUrl: string) {
  try {
    // Get the actual queue ARN
    const queueResult = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn']
    }));
    
    const actualQueueArn = queueResult.Attributes?.['QueueArn'];
    console.log(`  Actual Queue ARN: ${actualQueueArn}`);
    
    // Get the subscription endpoint
    const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    const sqsSubscription = subscriptions.Subscriptions?.find(sub => sub.Protocol === 'sqs');
    if (sqsSubscription) {
      console.log(`  Subscription Endpoint: ${sqsSubscription.Endpoint}`);
      
      if (actualQueueArn === sqsSubscription.Endpoint) {
        console.log(`  ✅ ARNs match perfectly`);
      } else {
        console.log(`  ❌ ARN MISMATCH DETECTED!`);
        console.log(`     This is likely the cause of delivery failures`);
      }
    }
  } catch (error) {
    console.error('  ❌ Error verifying ARN matching:', error);
  }
}

async function main() {
  await checkSubscriptionConfiguration();
}

if (require.main === module) {
  main();
}

export { checkSubscriptionDetails };