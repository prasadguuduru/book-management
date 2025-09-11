#!/usr/bin/env npx ts-node

/**
 * Check SNS CloudWatch Metrics
 * Monitors SNS topic metrics to see if events are being published
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const cloudwatch = new AWS.CloudWatch();
const sns = new AWS.SNS();

async function checkSNSMetrics() {
  console.log('� Checkiing SNS CloudWatch Metrics...');

  try {
    // First, verify the SNS topic exists
    const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
    
    console.log('📋 Verifying SNS topic...');
    try {
      const topicAttributes = await sns.getTopicAttributes({
        TopicArn: topicArn
      }).promise();
      
      console.log('✅ SNS Topic exists:', {
        topicArn,
        subscriptionsConfirmed: topicAttributes.Attributes?.['SubscriptionsConfirmed'],
        subscriptionsPending: topicAttributes.Attributes?.['SubscriptionsPending']
      });
    } catch (error) {
      console.error('❌ Error checking SNS topic:', error);
      return;
    }

    // Get current time and 1 hour ago
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (60 * 60 * 1000)); // 1 hour ago

    console.log(`📊 Checking metrics from ${startTime.toISOString()} to ${endTime.toISOString()}`);

    // Check SNS metrics
    const metricsToCheck = [
      'NumberOfMessagesPublished',
      'NumberOfNotificationsDelivered',
      'NumberOfNotificationsFailed'
    ];

    for (const metricName of metricsToCheck) {
      try {
        const params = {
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
          Statistics: ['Sum', 'Average']
        };

        const result = await cloudwatch.getMetricStatistics(params).promise();
        
        console.log(`📈 ${metricName}:`, {
          dataPoints: result.Datapoints?.length || 0,
          totalSum: result.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0,
          recentDataPoints: result.Datapoints?.slice(-3).map(dp => ({
            timestamp: dp.Timestamp,
            sum: dp.Sum,
            average: dp.Average
          })) || []
        });

      } catch (error) {
        console.error(`❌ Error getting ${metricName}:`, error);
      }
    }

    // Check recent SNS topic activity
    console.log('\n📋 Checking recent SNS topic activity...');
    
    // Get CloudWatch logs for SNS (if available)
    const logs = new AWS.CloudWatchLogs();
    
    try {
      const logGroups = await logs.describeLogGroups({
        logGroupNamePrefix: '/aws/sns/'
      }).promise();
      
      console.log('📋 Available SNS log groups:', logGroups.logGroups?.map(lg => lg.logGroupName) || []);
      
    } catch (error) {
      console.log('ℹ️ No SNS CloudWatch logs available (this is normal)');
    }

    // Check if there are any recent CloudTrail events for SNS
    console.log('\n🔍 Summary:');
    console.log('- Check the metrics above for recent SNS activity');
    console.log('- NumberOfMessagesPublished should increase when events are published');
    console.log('- NumberOfNotificationsDelivered should increase when SQS receives messages');
    console.log('- If both are 0, events are not being published to SNS');

  } catch (error) {
    console.error('❌ Error checking SNS metrics:', error);
  }
}

// Run the check
checkSNSMetrics().then(() => {
  console.log('🎯 SNS metrics check completed');
}).catch(error => {
  console.error('💥 SNS metrics check failed:', error);
  process.exit(1);
});