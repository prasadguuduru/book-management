#!/usr/bin/env ts-node

/**
 * Comprehensive diagnostic script to trace where the approval flow is failing
 */

import { CloudWatchLogs, SNS, SQS } from 'aws-sdk';

const cloudWatchLogs = new CloudWatchLogs({ region: 'us-east-1' });
const sns = new SNS({ region: 'us-east-1' });
const sqs = new SQS({ region: 'us-east-1' });

async function traceApprovalFlowFailure() {
  console.log('🔍 Tracing approval flow failure...');
  console.log('📅 Checking logs from the last 30 minutes');

  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  const now = Date.now();

  // 1. Check workflow service logs for recent activity
  console.log('\n📋 1. CHECKING WORKFLOW SERVICE LOGS');
  console.log('=====================================');
  
  try {
    const workflowLogs = await cloudWatchLogs.filterLogEvents({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime: thirtyMinutesAgo,
      endTime: now,
      filterPattern: 'book_status_changed OR PUBLISHED OR APPROVED OR SNS'
    }).promise();

    if (workflowLogs.events && workflowLogs.events.length > 0) {
      console.log(`✅ Found ${workflowLogs.events.length} workflow service events`);
      workflowLogs.events.forEach((event, index) => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`${index + 1}. ${timestamp}: ${event.message?.substring(0, 200)}...`);
      });
    } else {
      console.log('❌ No workflow service events found in the last 30 minutes');
      console.log('   This suggests the workflow service is not processing book approvals');
    }
  } catch (error) {
    console.error('❌ Error checking workflow service logs:', error);
  }

  // 2. Check SNS topic metrics
  console.log('\n📊 2. CHECKING SNS TOPIC METRICS');
  console.log('=================================');
  
  try {
    const snsMetrics = await sns.getTopicAttributes({
      TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events'
    }).promise();
    
    console.log('📈 SNS Topic Configuration:');
    console.log(`   Topic ARN: ${snsMetrics.Attributes?.['TopicArn']}`);
    console.log(`   Subscriptions: ${snsMetrics.Attributes?.['SubscriptionsConfirmed']}`);
    console.log(`   Policy: ${snsMetrics.Attributes?.['Policy'] ? 'Present' : 'Missing'}`);
  } catch (error) {
    console.error('❌ Error checking SNS topic:', error);
  }

  // 3. Check SQS queue for recent messages
  console.log('\n📦 3. CHECKING SQS QUEUE ACTIVITY');
  console.log('==================================');
  
  try {
    const queueAttributes = await sqs.getQueueAttributes({
      QueueUrl: 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue',
      AttributeNames: ['All']
    }).promise();

    console.log('📊 SQS Queue Status:');
    console.log(`   Messages Available: ${queueAttributes.Attributes?.['ApproximateNumberOfMessages']}`);
    console.log(`   Messages In Flight: ${queueAttributes.Attributes?.['ApproximateNumberOfMessagesNotVisible']}`);
    console.log(`   Last Modified: ${new Date(parseInt(queueAttributes.Attributes?.['LastModifiedTimestamp']!) * 1000).toISOString()}`);
  } catch (error) {
    console.error('❌ Error checking SQS queue:', error);
  }

  // 4. Check notification service logs for recent SQS processing
  console.log('\n📧 4. CHECKING NOTIFICATION SERVICE LOGS');
  console.log('=========================================');
  
  try {
    const notificationLogs = await cloudWatchLogs.filterLogEvents({
      logGroupName: '/aws/lambda/qa-notification-service',
      startTime: thirtyMinutesAgo,
      endTime: now,
      filterPattern: 'SQS OR book_status_changed OR EMAIL'
    }).promise();

    if (notificationLogs.events && notificationLogs.events.length > 0) {
      console.log(`✅ Found ${notificationLogs.events.length} notification service events`);
      notificationLogs.events.slice(-5).forEach((event, index) => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`${index + 1}. ${timestamp}: ${event.message?.substring(0, 200)}...`);
      });
    } else {
      console.log('❌ No notification service SQS events found in the last 30 minutes');
    }
  } catch (error) {
    console.error('❌ Error checking notification service logs:', error);
  }

  // 5. Check for any error patterns in all services
  console.log('\n🚨 5. CHECKING FOR ERROR PATTERNS');
  console.log('==================================');
  
  const services = [
    '/aws/lambda/qa-workflow-service',
    '/aws/lambda/qa-book-service',
    '/aws/lambda/qa-notification-service'
  ];

  for (const logGroup of services) {
    try {
      const errorLogs = await cloudWatchLogs.filterLogEvents({
        logGroupName: logGroup,
        startTime: thirtyMinutesAgo,
        endTime: now,
        filterPattern: 'ERROR OR Failed OR Exception'
      }).promise();

      if (errorLogs.events && errorLogs.events.length > 0) {
        console.log(`❌ Found ${errorLogs.events.length} errors in ${logGroup}:`);
        errorLogs.events.slice(-3).forEach((event, index) => {
          const timestamp = new Date(event.timestamp!).toISOString();
          console.log(`   ${index + 1}. ${timestamp}: ${event.message?.substring(0, 150)}...`);
        });
      } else {
        console.log(`✅ No errors found in ${logGroup}`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${logGroup}:`, error);
    }
  }

  // 6. Recommendations
  console.log('\n💡 6. DIAGNOSTIC RECOMMENDATIONS');
  console.log('=================================');
  console.log('Based on the analysis above:');
  console.log('');
  console.log('If workflow service has no recent activity:');
  console.log('  → The book approval is not triggering the workflow service');
  console.log('  → Check if the book service is calling the workflow service');
  console.log('');
  console.log('If workflow service is active but no SNS messages:');
  console.log('  → The workflow service is not publishing to SNS');
  console.log('  → Check the workflow service event publishing logic');
  console.log('');
  console.log('If SNS messages exist but no SQS processing:');
  console.log('  → SNS to SQS subscription might be broken');
  console.log('  → Check SNS topic subscriptions');
  console.log('');
  console.log('If SQS messages exist but no email:');
  console.log('  → Notification service processing is failing');
  console.log('  → Check notification service error logs');

  console.log('\n🎉 Diagnostic trace completed');
}

traceApprovalFlowFailure().catch(console.error);