#!/usr/bin/env ts-node

import { SNSClient, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function main() {
  console.log('🔍 Simple SNS to SQS debugging...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  try {
    // Get actual queue ARN
    const queueResult = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn']
    }));
    
    const actualQueueArn = queueResult.Attributes?.QueueArn;
    console.log(`\n📨 Actual Queue ARN: ${actualQueueArn}`);
    
    // Get subscription endpoint
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    const sqsSubscription = subscriptions.Subscriptions?.find(sub => sub.Protocol === 'sqs');
    if (sqsSubscription) {
      console.log(`📡 Subscription Endpoint: ${sqsSubscription.Endpoint}`);
      console.log(`🔗 Subscription ARN: ${sqsSubscription.SubscriptionArn}`);
      
      if (actualQueueArn === sqsSubscription.Endpoint) {
        console.log(`✅ ARNs match perfectly`);
        console.log(`\n🤔 ARNs match but delivery is failing. This suggests:`);
        console.log(`   1. SQS queue policy might be too restrictive`);
        console.log(`   2. SNS topic might have delivery policy issues`);
        console.log(`   3. There might be a filter policy blocking messages`);
      } else {
        console.log(`❌ ARN MISMATCH DETECTED!`);
        console.log(`   Expected: ${actualQueueArn}`);
        console.log(`   Got:      ${sqsSubscription.Endpoint}`);
        console.log(`   This is the cause of delivery failures!`);
      }
    } else {
      console.log(`❌ No SQS subscription found`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();