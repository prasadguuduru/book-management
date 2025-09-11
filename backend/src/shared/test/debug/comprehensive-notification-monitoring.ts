#!/usr/bin/env npx ts-node

/**
 * Comprehensive Notification Monitoring
 * Deep dive into SNS subscription and delivery issues
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const sns = new AWS.SNS();
const sqs = new AWS.SQS();
const cloudwatch = new AWS.CloudWatch();

async function comprehensiveMonitoring() {
  console.log('🔍 Comprehensive Notification Monitoring...');

  try {
    const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
    const subscriptionArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events:32a1e0ad-c670-4ceb-83a6-d64e478b134b';

    // Step 1: Check subscription attributes in detail
    console.log('📋 Step 1: Checking subscription attributes...');
    try {
      const subAttributes = await sns.getSubscriptionAttributes({
        SubscriptionArn: subscriptionArn
      }).promise();
      
      console.log('📊 Subscription Attributes:', {
        subscriptionArn,
        confirmationWasAuthenticated: subAttributes.Attributes?.['ConfirmationWasAuthenticated'],
        deliveryPolicy: subAttributes.Attributes?.['DeliveryPolicy'] || 'Default',
        effectiveDeliveryPolicy: subAttributes.Attributes?.['EffectiveDeliveryPolicy'] || 'Default',
        filterPolicy: subAttributes.Attributes?.['FilterPolicy'] || 'None',
        owner: subAttributes.Attributes?.['Owner'],
        pendingConfirmation: subAttributes.Attributes?.['PendingConfirmation'],
        protocol: subAttributes.Attributes?.['Protocol'],
        rawMessageDelivery: subAttributes.Attributes?.['RawMessageDelivery'],
        topicArn: subAttributes.Attributes?.['TopicArn']
      });

    } catch (error) {
      console.error('❌ Error getting subscription attributes:', error);
    }

    // Step 2: Check detailed CloudWatch metrics
    console.log('\n📋 Step 2: Checking detailed CloudWatch metrics...');
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours ago

    // Check SNS metrics by subscription
    try {
      const subscriptionMetrics = await cloudwatch.getMetricStatistics({
        Namespace: 'AWS/SNS',
        MetricName: 'NumberOfNotificationsFailed',
        Dimensions: [
          {
            Name: 'TopicName',
            Value: 'qa-book-workflow-events'
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum', 'Average']
      }).promise();

      console.log('📈 Failed Notifications Details:', {
        dataPoints: subscriptionMetrics.Datapoints?.length || 0,
        recentFailures: subscriptionMetrics.Datapoints?.slice(-5).map(dp => ({
          timestamp: dp.Timestamp,
          failures: dp.Sum
        })) || []
      });

    } catch (error) {
      console.error('❌ Error getting subscription metrics:', error);
    }

    // Step 3: Check SQS queue depth and processing
    console.log('\n📋 Step 3: Checking SQS queue status...');
    try {
      const queueAttributes = await sqs.getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible', 'ApproximateNumberOfMessagesDelayed']
      }).promise();

      console.log('📊 SQS Queue Status:', {
        messagesAvailable: queueAttributes.Attributes?.['ApproximateNumberOfMessages'] || '0',
        messagesInFlight: queueAttributes.Attributes?.['ApproximateNumberOfMessagesNotVisible'] || '0',
        messagesDelayed: queueAttributes.Attributes?.['ApproximateNumberOfMessagesDelayed'] || '0'
      });

    } catch (error) {
      console.error('❌ Error checking SQS queue:', error);
    }

    // Step 4: Test with a simple message
    console.log('\n📋 Step 4: Testing with minimal message...');
    try {
      const testResult = await sns.publish({
        TopicArn: topicArn,
        Message: 'Simple test message',
        Subject: 'Test'
      }).promise();

      console.log('✅ Simple test message published:', testResult.MessageId);

      // Wait and check
      await new Promise(resolve => setTimeout(resolve, 15000));

      const messages = await sqs.receiveMessage({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 5
      }).promise();

      if (messages.Messages && messages.Messages.length > 0) {
        console.log('✅ Simple test message received!');
        // Clean up
        if (messages.Messages[0]?.ReceiptHandle) {
          await sqs.deleteMessage({
            QueueUrl: queueUrl,
            ReceiptHandle: messages.Messages[0].ReceiptHandle
          }).promise();
        }
      } else {
        console.log('❌ Simple test message NOT received');
      }

    } catch (error) {
      console.error('❌ Error with simple test:', error);
    }

    // Step 5: Check if subscription needs to be recreated
    console.log('\n📋 Step 5: Recommendations...');
    console.log('🔧 Potential fixes:');
    console.log('1. Subscription may need to be recreated');
    console.log('2. Check if SQS queue was recreated after subscription');
    console.log('3. Verify AWS account permissions');
    console.log('4. Check for any AWS service issues');
    
    console.log('\n💡 To fix:');
    console.log('1. Delete and recreate the SNS subscription');
    console.log('2. Ensure SQS queue exists before creating subscription');
    console.log('3. Verify queue policy allows SNS access');

  } catch (error) {
    console.error('❌ Error in comprehensive monitoring:', error);
  }
}

// Run the monitoring
comprehensiveMonitoring().then(() => {
  console.log('🎯 Comprehensive monitoring completed');
}).catch(error => {
  console.error('💥 Monitoring failed:', error);
  process.exit(1);
});