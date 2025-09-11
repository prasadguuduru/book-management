#!/usr/bin/env npx ts-node

/**
 * Check SNS Configuration
 * Verifies SNS topic and subscription configuration
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const sns = new AWS.SNS();
const sqs = new AWS.SQS();

async function checkSNSConfiguration() {
  console.log('� Checkingn SNS Configuration...');

  try {
    const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
    
    // Step 1: Check SNS topic attributes
    console.log('📋 Step 1: Checking SNS topic attributes...');
    const topicAttributes = await sns.getTopicAttributes({
      TopicArn: topicArn
    }).promise();
    
    console.log('✅ SNS Topic Attributes:', {
      topicArn,
      subscriptionsConfirmed: topicAttributes.Attributes?.['SubscriptionsConfirmed'],
      subscriptionsPending: topicAttributes.Attributes?.['SubscriptionsPending'],
      policy: topicAttributes.Attributes?.['Policy'] ? 'Present' : 'Missing',
      displayName: topicAttributes.Attributes?.['DisplayName']
    });

    // Step 2: List SNS subscriptions
    console.log('\n📋 Step 2: Checking SNS subscriptions...');
    const subscriptions = await sns.listSubscriptionsByTopic({
      TopicArn: topicArn
    }).promise();
    
    console.log('📊 SNS Subscriptions:', subscriptions.Subscriptions?.map(sub => ({
      subscriptionArn: sub.SubscriptionArn,
      protocol: sub.Protocol,
      endpoint: sub.Endpoint
    })));

    // Step 3: Check SQS queue attributes
    console.log('\n📋 Step 3: Checking SQS queue attributes...');
    try {
      const queueAttributes = await sqs.getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      }).promise();
      
      console.log('✅ SQS Queue Attributes:', {
        queueUrl,
        policy: queueAttributes.Attributes?.['Policy'] ? 'Present' : 'Missing',
        visibilityTimeout: queueAttributes.Attributes?.['VisibilityTimeout'],
        messageRetentionPeriod: queueAttributes.Attributes?.['MessageRetentionPeriod'],
        redrivePolicy: queueAttributes.Attributes?.['RedrivePolicy'] ? 'Present' : 'Missing'
      });

      // Check if the queue policy allows SNS to send messages
      if (queueAttributes.Attributes?.['Policy']) {
        const policy = JSON.parse(queueAttributes.Attributes['Policy']);
        console.log('📋 SQS Queue Policy:', JSON.stringify(policy, null, 2));
      }

    } catch (error) {
      console.error('❌ Error checking SQS queue:', error);
    }

    // Step 4: Test SNS to SQS connectivity
    console.log('\n📋 Step 4: Testing SNS to SQS connectivity...');
    
    try {
      // Send a test message to SNS
      const testMessage = {
        eventType: 'test_connectivity',
        eventId: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: 'sns-configuration-test',
        version: '1.0',
        data: {
          message: 'Testing SNS to SQS connectivity'
        }
      };

      console.log('📤 Sending test message to SNS...');
      const publishResult = await sns.publish({
        TopicArn: topicArn,
        Message: JSON.stringify(testMessage),
        Subject: 'SNS Configuration Test',
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: 'test_connectivity'
          }
        }
      }).promise();

      console.log('✅ Test message published to SNS:', {
        messageId: publishResult.MessageId
      });

      // Wait a moment and check if message appears in SQS
      console.log('⏳ Waiting 10 seconds to check SQS...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check SQS for the message
      const sqsMessages = await sqs.receiveMessage({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 5
      }).promise();

      if (sqsMessages.Messages && sqsMessages.Messages.length > 0) {
        console.log('✅ Test message received in SQS!');
        const message = sqsMessages.Messages[0];
        if (message) {
          console.log('Message body preview:', message.Body?.substring(0, 200));
          
          // Delete the test message
          if (message.ReceiptHandle) {
            await sqs.deleteMessage({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle
            }).promise();
          }
        }
        
      } else {
        console.log('❌ Test message NOT received in SQS - connectivity issue confirmed');
      }

    } catch (error) {
      console.error('❌ Error testing SNS to SQS connectivity:', error);
    }

    // Step 5: Summary and recommendations
    console.log('\n🎯 Summary and Recommendations:');
    console.log('1. Check if SQS queue policy allows SNS to send messages');
    console.log('2. Verify SNS subscription is confirmed and active');
    console.log('3. Check AWS IAM permissions for SNS to access SQS');
    console.log('4. Review CloudWatch logs for detailed error messages');

  } catch (error) {
    console.error('❌ Error checking SNS configuration:', error);
  }
}

// Run the check
checkSNSConfiguration().then(() => {
  console.log('🎯 SNS configuration check completed');
}).catch(error => {
  console.error('💥 SNS configuration check failed:', error);
  process.exit(1);
});