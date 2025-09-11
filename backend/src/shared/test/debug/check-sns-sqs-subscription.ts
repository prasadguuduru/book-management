#!/usr/bin/env ts-node

import { SNSClient, ListSubscriptionsByTopicCommand, GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function main() {
  console.log('🔍 Checking SNS to SQS subscription configuration...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  try {
    // Check SNS topic
    console.log('\n📡 Checking SNS topic...');
    const topicAttributes = await snsClient.send(new GetTopicAttributesCommand({
      TopicArn: topicArn
    }));
    
    console.log('✅ SNS Topic exists');
    console.log(`  Topic ARN: ${topicArn}`);
    console.log(`  Subscriptions Count: ${topicAttributes.Attributes?.['SubscriptionsConfirmed'] || 0}`);
    
    // List subscriptions
    console.log('\n📋 Checking SNS subscriptions...');
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    if (subscriptions.Subscriptions && subscriptions.Subscriptions.length > 0) {
      console.log(`✅ Found ${subscriptions.Subscriptions.length} subscriptions:`);
      subscriptions.Subscriptions.forEach(sub => {
        console.log(`  - Protocol: ${sub.Protocol}`);
        console.log(`    Endpoint: ${sub.Endpoint}`);
        console.log(`    Subscription ARN: ${sub.SubscriptionArn}`);
        console.log(`    Confirmed: ${sub.SubscriptionArn !== 'PendingConfirmation'}`);
        console.log('');
      });
    } else {
      console.log('❌ No subscriptions found for SNS topic');
    }
    
    // Check SQS queue
    console.log('\n📨 Checking SQS queue...');
    const queueAttributes = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    }));
    
    console.log('✅ SQS Queue exists');
    console.log(`  Queue URL: ${queueUrl}`);
    console.log(`  Messages: ${queueAttributes.Attributes?.ApproximateNumberOfMessages || 0}`);
    console.log(`  Queue ARN: ${queueAttributes.Attributes?.QueueArn || 'Unknown'}`);
    
    // Check if queue policy allows SNS
    if (queueAttributes.Attributes?.Policy) {
      console.log('\n🔐 Queue has a policy configured');
      try {
        const policy = JSON.parse(queueAttributes.Attributes.Policy);
        console.log('  Policy statements:', policy.Statement?.length || 0);
      } catch (e) {
        console.log('  Could not parse policy');
      }
    } else {
      console.log('\n❌ Queue has no policy - SNS cannot deliver messages');
    }
    
  } catch (error) {
    console.error('❌ Error checking SNS/SQS configuration:', error);
  }
}

main();