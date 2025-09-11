#!/usr/bin/env npx ts-node

/**
 * Verify SQS Queue ARN matches subscription endpoint
 */

import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { SNSClient, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';

const sqsClient = new SQSClient({ region: 'us-east-1' });
const snsClient = new SNSClient({ region: 'us-east-1' });

async function verifyQueueArn() {
  console.log('🔍 Verifying SQS Queue ARN matches SNS subscription endpoint...');
  
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  try {
    // Get actual queue ARN
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn']
    }));
    
    const actualQueueArn = queueAttrs.Attributes?.QueueArn;
    console.log(`📨 Actual Queue ARN: ${actualQueueArn}`);
    
    // Get subscription endpoint
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    const sqsSubscription = subscriptions.Subscriptions?.find(sub => sub.Protocol === 'sqs');
    console.log(`📡 Subscription Endpoint: ${sqsSubscription?.Endpoint}`);
    
    // Compare
    if (actualQueueArn === sqsSubscription?.Endpoint) {
      console.log('✅ Queue ARN matches subscription endpoint perfectly');
    } else {
      console.log('❌ MISMATCH DETECTED!');
      console.log(`   Queue ARN:    ${actualQueueArn}`);
      console.log(`   Subscription: ${sqsSubscription?.Endpoint}`);
    }
    
    // Also check if subscription is confirmed
    console.log(`📋 Subscription Status:`);
    console.log(`   Protocol: ${sqsSubscription?.Protocol}`);
    console.log(`   Confirmed: ${sqsSubscription?.SubscriptionArn !== 'PendingConfirmation'}`);
    console.log(`   Subscription ARN: ${sqsSubscription?.SubscriptionArn}`);
    
  } catch (error) {
    console.error('❌ Error verifying queue ARN:', error);
  }
}

verifyQueueArn().catch(console.error);