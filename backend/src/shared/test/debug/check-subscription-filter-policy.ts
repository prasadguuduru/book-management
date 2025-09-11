#!/usr/bin/env ts-node

/**
 * Check Subscription Filter Policy
 * 
 * This script checks if there's a filter policy on the SNS subscription
 * that might be blocking message delivery.
 */

import { SNSClient, GetSubscriptionAttributesCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'us-east-1' });

async function checkSubscriptionFilterPolicy() {
  console.log('🔍 Checking SNS subscription filter policy...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  try {
    // Get all subscriptions for the topic
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    if (!subscriptions.Subscriptions || subscriptions.Subscriptions.length === 0) {
      console.log('❌ No subscriptions found');
      return;
    }
    
    for (const subscription of subscriptions.Subscriptions) {
      if (subscription.Protocol === 'sqs' && subscription.SubscriptionArn && subscription.SubscriptionArn !== 'PendingConfirmation') {
        console.log(`\n📡 Checking SQS subscription: ${subscription.SubscriptionArn}`);
        
        const attributes = await snsClient.send(new GetSubscriptionAttributesCommand({
          SubscriptionArn: subscription.SubscriptionArn
        }));
        
        if (attributes.Attributes) {
          console.log(`  Protocol: ${attributes.Attributes['Protocol']}`);
          console.log(`  Endpoint: ${attributes.Attributes['Endpoint']}`);
          console.log(`  Confirmed: ${attributes.Attributes['ConfirmationWasAuthenticated']}`);
          console.log(`  Raw Message Delivery: ${attributes.Attributes['RawMessageDelivery'] || 'false'}`);
          
          // Check for filter policy
          const filterPolicy = attributes.Attributes['FilterPolicy'];
          if (filterPolicy) {
            console.log(`  🚨 FILTER POLICY FOUND: ${filterPolicy}`);
            console.log(`  🔍 This might be blocking message delivery!`);
            
            try {
              const parsedFilter = JSON.parse(filterPolicy);
              console.log(`  📋 Parsed filter policy:`);
              console.log(JSON.stringify(parsedFilter, null, 4));
            } catch (e) {
              console.log(`  ❌ Could not parse filter policy`);
            }
          } else {
            console.log(`  ✅ No filter policy (all messages should pass)`);
          }
          
          // Check delivery policy
          const deliveryPolicy = attributes.Attributes['DeliveryPolicy'];
          if (deliveryPolicy) {
            console.log(`  📋 Delivery Policy: ${deliveryPolicy}`);
          } else {
            console.log(`  📋 Delivery Policy: Default`);
          }
          
          // Check redrive policy
          const redrivePolicy = attributes.Attributes['RedrivePolicy'];
          if (redrivePolicy) {
            console.log(`  📋 Redrive Policy: ${redrivePolicy}`);
          } else {
            console.log(`  📋 Redrive Policy: None`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking subscription filter policy:', error);
  }
}

async function main() {
  await checkSubscriptionFilterPolicy();
}

if (require.main === module) {
  main();
}

export { checkSubscriptionFilterPolicy };