#!/usr/bin/env ts-node

/**
 * Check SNS Delivery Logs
 * 
 * This script checks CloudWatch logs for SNS delivery failures
 * and provides detailed diagnostics.
 */

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { SNSClient, GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });
const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function checkSNSDeliveryLogs() {
  console.log('🔍 Checking SNS delivery logs and diagnostics...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  // Check SNS topic attributes
  console.log('\n📡 Checking SNS topic configuration...');
  try {
    const topicAttrs = await snsClient.send(new GetTopicAttributesCommand({
      TopicArn: topicArn
    }));
    
    console.log('✅ SNS Topic attributes:');
    Object.entries(topicAttrs.Attributes || {}).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  } catch (error) {
    console.error('❌ Error getting SNS topic attributes:', error);
  }
  
  // Check SQS queue attributes
  console.log('\n📨 Checking SQS queue configuration...');
  try {
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    }));
    
    console.log('✅ SQS Queue attributes:');
    Object.entries(queueAttrs.Attributes || {}).forEach(([key, value]) => {
      if (key === 'Policy') {
        console.log(`   ${key}: [Policy JSON - see below]`);
      } else {
        console.log(`   ${key}: ${value}`);
      }
    });
    
    // Parse and display policy
    if (queueAttrs.Attributes?.Policy) {
      console.log('\n🔐 SQS Queue Policy:');
      try {
        const policy = JSON.parse(queueAttrs.Attributes.Policy);
        console.log(JSON.stringify(policy, null, 2));
      } catch (e) {
        console.log('   Failed to parse policy JSON');
      }
    }
  } catch (error) {
    console.error('❌ Error getting SQS queue attributes:', error);
  }
  
  // Check for SNS delivery failure logs
  console.log('\n📋 Checking for SNS delivery failure logs...');
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 30 * 60 * 1000); // 30 minutes ago
  
  try {
    // Check SNS logs (if they exist)
    const snsLogs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/sns/us-east-1/582491219315/qa-book-workflow-events/Failure',
      startTime: startTime.getTime(),
      endTime: endTime.getTime()
    }));
    
    if (snsLogs.events && snsLogs.events.length > 0) {
      console.log(`✅ Found ${snsLogs.events.length} SNS failure log events:`);
      snsLogs.events.forEach(event => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`[${timestamp}] ${event.message}`);
      });
    } else {
      console.log('❌ No SNS failure logs found (or log group does not exist)');
    }
  } catch (error) {
    console.log('❌ SNS failure log group does not exist or is not accessible');
  }
  
  // Provide troubleshooting steps
  console.log('\n🔧 Troubleshooting steps:');
  console.log('1. Verify SQS queue ARN matches subscription endpoint');
  console.log('2. Check if SQS queue exists and is accessible');
  console.log('3. Verify SNS topic has permission to write to SQS');
  console.log('4. Check for AWS service limits or throttling');
  console.log('5. Ensure both SNS and SQS are in the same region');
  
  // Test queue accessibility
  console.log('\n🧪 Testing queue accessibility...');
  try {
    const testResult = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['QueueArn']
    }));
    
    console.log(`✅ Queue is accessible`);
    console.log(`   Queue ARN: ${testResult.Attributes?.QueueArn}`);
    
    // Compare with subscription endpoint
    const expectedEndpoint = testResult.Attributes?.QueueArn;
    console.log(`   Expected subscription endpoint: ${expectedEndpoint}`);
    
  } catch (error) {
    console.error('❌ Queue accessibility test failed:', error);
  }
}

async function main() {
  await checkSNSDeliveryLogs();
}

if (require.main === module) {
  main();
}

export { checkSNSDeliveryLogs };