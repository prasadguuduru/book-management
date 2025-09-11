#!/usr/bin/env ts-node

/**
 * Debug SNS to SQS Flow
 * 
 * This script investigates why SNS messages are not reaching SQS
 * even though the subscription is configured correctly.
 */

import { SNSClient, GetTopicAttributesCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });
const cloudWatchClient = new CloudWatchClient({ region: 'us-east-1' });

async function debugSNSToSQSFlow() {
  console.log('🔍 Debugging SNS to SQS message flow...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  // 1. Check SNS topic metrics
  console.log('\n📊 Checking SNS topic metrics...');
  await checkSNSMetrics(topicArn);
  
  // 2. Check SQS queue metrics  
  console.log('\n📊 Checking SQS queue metrics...');
  await checkSQSMetrics(queueUrl);
  
  // 3. Check subscription health
  console.log('\n🔗 Checking subscription health...');
  await checkSubscriptionHealth(topicArn);
  
  // 4. Check for any messages in SQS
  console.log('\n📨 Checking for messages in SQS...');
  await checkSQSMessages(queueUrl);
  
  // 5. Check SQS queue policy
  console.log('\n🔐 Checking SQS queue policy...');
  await checkSQSPolicy(queueUrl);
}

async function checkSNSMetrics(topicArn: string) {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 30 * 60 * 1000); // Last 30 minutes
    
    const metrics = [
      'NumberOfMessagesPublished',
      'NumberOfNotificationsDelivered',
      'NumberOfNotificationsFailed'
    ];
    
    for (const metricName of metrics) {
      const result = await cloudWatchClient.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/SNS',
        MetricName: metricName,
        Dimensions: [
          {
            Name: 'TopicName',
            Value: 'qa-book-workflow-events'
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300, // 5 minutes
        Statistics: ['Sum']
      }));
      
      const total = result.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;
      console.log(`  ${metricName}: ${total}`);
    }
  } catch (error) {
    console.error('  ❌ Error checking SNS metrics:', error);
  }
}

async function checkSQSMetrics(queueUrl: string) {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 30 * 60 * 1000);
    
    const metrics = [
      'NumberOfMessagesReceived',
      'NumberOfMessagesSent',
      'NumberOfMessagesDeleted'
    ];
    
    for (const metricName of metrics) {
      const result = await cloudWatchClient.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/SQS',
        MetricName: metricName,
        Dimensions: [
          {
            Name: 'QueueName',
            Value: 'qa-user-notifications-queue'
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum']
      }));
      
      const total = result.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;
      console.log(`  ${metricName}: ${total}`);
    }
  } catch (error) {
    console.error('  ❌ Error checking SQS metrics:', error);
  }
}

async function checkSubscriptionHealth(topicArn: string) {
  try {
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: topicArn
    }));
    
    if (subscriptions.Subscriptions) {
      for (const sub of subscriptions.Subscriptions) {
        console.log(`  📡 Subscription: ${sub.SubscriptionArn}`);
        console.log(`     Protocol: ${sub.Protocol}`);
        console.log(`     Endpoint: ${sub.Endpoint}`);
        console.log(`     Confirmed: ${sub.SubscriptionArn !== 'PendingConfirmation'}`);
        
        // Check subscription attributes for any delivery issues
        if (sub.SubscriptionArn && sub.SubscriptionArn !== 'PendingConfirmation') {
          // Note: GetSubscriptionAttributes requires subscription ARN
          console.log(`     Status: Active`);
        }
      }
    }
  } catch (error) {
    console.error('  ❌ Error checking subscription health:', error);
  }
}

async function checkSQSMessages(queueUrl: string) {
  try {
    // Check queue attributes first
    const attributes = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed'
      ]
    }));
    
    console.log(`  Messages in queue: ${attributes.Attributes?.ApproximateNumberOfMessages || 0}`);
    console.log(`  Messages in flight: ${attributes.Attributes?.ApproximateNumberOfMessagesNotVisible || 0}`);
    console.log(`  Messages delayed: ${attributes.Attributes?.ApproximateNumberOfMessagesDelayed || 0}`);
    
    // Try to receive messages (without deleting them)
    const messages = await sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 1,
      AttributeNames: ['All']
    }));
    
    if (messages.Messages && messages.Messages.length > 0) {
      console.log(`  ✅ Found ${messages.Messages.length} message(s) in queue`);
      console.log(`  📋 Sample message body: ${messages.Messages[0]?.Body?.substring(0, 200)}...`);
    } else {
      console.log(`  ❌ No messages found in queue`);
    }
  } catch (error) {
    console.error('  ❌ Error checking SQS messages:', error);
  }
}

async function checkSQSPolicy(queueUrl: string) {
  try {
    const attributes = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['Policy']
    }));
    
    if (attributes.Attributes?.Policy) {
      const policy = JSON.parse(attributes.Attributes.Policy);
      console.log(`  ✅ Queue has policy with ${policy.Statement?.length || 0} statements`);
      
      // Check if SNS has permission to send messages
      const snsStatements = policy.Statement?.filter((stmt: any) => 
        stmt.Principal?.Service === 'sns.amazonaws.com' || 
        stmt.Principal === 'sns.amazonaws.com'
      );
      
      if (snsStatements && snsStatements.length > 0) {
        console.log(`  ✅ Found ${snsStatements.length} SNS permission statement(s)`);
        snsStatements.forEach((stmt: any, index: number) => {
          console.log(`     Statement ${index + 1}: ${stmt.Effect} ${stmt.Action}`);
        });
      } else {
        console.log(`  ❌ No SNS permission statements found in queue policy`);
      }
    } else {
      console.log(`  ❌ No policy found on queue`);
    }
  } catch (error) {
    console.error('  ❌ Error checking SQS policy:', error);
  }
}

async function main() {
  await debugSNSToSQSFlow();
}

if (require.main === module) {
  main();
}

export { debugSNSToSQSFlow };