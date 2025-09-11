#!/usr/bin/env npx ts-node

/**
 * Check SNS Delivery Policy and other advanced settings
 */

import { SNSClient, GetSubscriptionAttributesCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: 'us-east-1' });

async function checkDeliveryPolicy() {
  console.log('📋 Checking SNS Delivery Policy and Subscription Settings...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  try {
    // Get all subscriptions
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    const sqsSubscription = subscriptions.Subscriptions?.find(sub => sub.Protocol === 'sqs');
    
    if (!sqsSubscription?.SubscriptionArn) {
      console.log('❌ No SQS subscription found');
      return;
    }
    
    console.log(`📡 Checking subscription: ${sqsSubscription.SubscriptionArn}`);
    
    // Get detailed subscription attributes
    const subAttrs = await snsClient.send(new GetSubscriptionAttributesCommand({
      SubscriptionArn: sqsSubscription.SubscriptionArn
    }));
    
    console.log('\n📊 Subscription Attributes:');
    Object.entries(subAttrs.Attributes || {}).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    // Check specific problematic attributes
    const deliveryPolicy = subAttrs.Attributes?.['DeliveryPolicy'];
    const filterPolicy = subAttrs.Attributes?.['FilterPolicy'];
    const rawMessageDelivery = subAttrs.Attributes?.['RawMessageDelivery'];
    const confirmationWasAuthenticated = subAttrs.Attributes?.['ConfirmationWasAuthenticated'];
    
    console.log('\n🔍 Key Settings Analysis:');
    
    if (deliveryPolicy && deliveryPolicy !== '{}') {
      console.log(`⚠️  Custom Delivery Policy: ${deliveryPolicy}`);
      console.log('   This might affect delivery behavior');
    } else {
      console.log('✅ Using default delivery policy');
    }
    
    if (filterPolicy && filterPolicy !== '{}') {
      console.log(`⚠️  Filter Policy Active: ${filterPolicy}`);
      console.log('   This might be filtering out messages!');
    } else {
      console.log('✅ No filter policy (all messages should pass)');
    }
    
    console.log(`📨 Raw Message Delivery: ${rawMessageDelivery || 'false'}`);
    console.log(`🔐 Confirmation Authenticated: ${confirmationWasAuthenticated || 'false'}`);
    
    // Check if subscription is actually confirmed
    const isConfirmed = sqsSubscription.SubscriptionArn !== 'PendingConfirmation';
    console.log(`✅ Subscription Confirmed: ${isConfirmed}`);
    
    if (!isConfirmed) {
      console.log('❌ CRITICAL: Subscription is not confirmed!');
      console.log('   This would prevent all message delivery.');
    }
    
  } catch (error) {
    console.error('❌ Error checking delivery policy:', error);
  }
}

checkDeliveryPolicy().catch(console.error);