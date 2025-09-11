#!/usr/bin/env npx ts-node

/**
 * Check SQS CloudWatch Metrics for Message Receive Patterns
 * Monitors SQS queue metrics to identify delivery issues
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const cloudwatch = new AWS.CloudWatch();
const sqs = new AWS.SQS();

async function checkSQSMetrics() {
  console.log('🔍 Checking SQS CloudWatch Metrics...');

  try {
    const queueName = 'qa-user-notifications-queue';
    const dlqName = 'qa-user-notifications-dlq';
    
    console.log(`📊 Checking metrics for queues: ${queueName}, ${dlqName}`);

    // Define time range (last 24 hours)
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    console.log(`📅 Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);

    // Metrics to check for both queues
    const metricsToCheck = [
      'NumberOfMessagesSent',
      'NumberOfMessagesReceived',
      'NumberOfMessagesDeleted',
      'ApproximateNumberOfMessages',
      'ApproximateNumberOfMessagesVisible',
      'ApproximateNumberOfMessagesNotVisible',
      'NumberOfEmptyReceives',
      'ApproximateAgeOfOldestMessage'
    ];

    const queues = [
      { name: queueName, displayName: 'Main Queue' },
      { name: dlqName, displayName: 'Dead Letter Queue' }
    ];

    for (const queue of queues) {
      console.log(`\n📈 ${queue.displayName} (${queue.name}) Metrics:`);
      console.log('='.repeat(60));

      for (const metricName of metricsToCheck) {
        try {
          const params = {
            Namespace: 'AWS/SQS',
            MetricName: metricName,
            Dimensions: [
              {
                Name: 'QueueName',
                Value: queue.name
              }
            ],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300, // 5 minutes
            Statistics: ['Sum', 'Average', 'Maximum']
          };

          const result = await cloudwatch.getMetricStatistics(params).promise();
          
          if (result.Datapoints && result.Datapoints.length > 0) {
            const totalSum = result.Datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0);
            const avgValue = result.Datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / result.Datapoints.length;
            const maxValue = Math.max(...result.Datapoints.map(dp => dp.Maximum || 0));
            
            console.log(`\n📊 ${metricName}:`);
            console.log(`   Total: ${totalSum}`);
            console.log(`   Average: ${avgValue.toFixed(2)}`);
            console.log(`   Maximum: ${maxValue}`);
            console.log(`   Data points: ${result.Datapoints.length}`);
            
            // Highlight concerning metrics
            if (metricName === 'ApproximateNumberOfMessages' && maxValue > 10) {
              console.log(`   ⚠️  WARNING: Queue backlog detected (${maxValue} messages)!`);
            }
            if (metricName === 'ApproximateAgeOfOldestMessage' && maxValue > 300) {
              console.log(`   ⚠️  WARNING: Old messages detected (${maxValue} seconds)!`);
            }
            if (metricName === 'NumberOfEmptyReceives' && totalSum > 1000) {
              console.log(`   ⚠️  INFO: High empty receives (${totalSum}) - normal for polling`);
            }
          } else {
            console.log(`\n📊 ${metricName}: No data available`);
          }
        } catch (error) {
          console.log(`\n❌ Error getting ${metricName}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    // Check current queue attributes
    console.log('\n📋 Current Queue Attributes:');
    console.log('='.repeat(50));

    try {
      const queueUrl = `https://sqs.us-east-1.amazonaws.com/582491219315/${queueName}`;
      const attributes = await sqs.getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      }).promise();

      if (attributes.Attributes) {
        console.log('\n🔍 Main Queue Attributes:');
        Object.entries(attributes.Attributes).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    } catch (error) {
      console.log('❌ Error getting queue attributes:', error instanceof Error ? error.message : String(error));
    }

    // Check DLQ attributes
    try {
      const dlqUrl = `https://sqs.us-east-1.amazonaws.com/582491219315/${dlqName}`;
      const dlqAttributes = await sqs.getQueueAttributes({
        QueueUrl: dlqUrl,
        AttributeNames: ['All']
      }).promise();

      if (dlqAttributes.Attributes) {
        console.log('\n🔍 Dead Letter Queue Attributes:');
        Object.entries(dlqAttributes.Attributes).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    } catch (error) {
      console.log('❌ Error getting DLQ attributes:', error instanceof Error ? error.message : String(error));
    }

    // Calculate delivery success rate
    console.log('\n📊 Delivery Analysis:');
    console.log('='.repeat(50));

    try {
      // Get messages sent to main queue
      const sentParams = {
        Namespace: 'AWS/SQS',
        MetricName: 'NumberOfMessagesSent',
        Dimensions: [{ Name: 'QueueName', Value: queueName }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum']
      };

      const sentResult = await cloudwatch.getMetricStatistics(sentParams).promise();
      const totalSent = sentResult.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

      // Get messages in DLQ
      const dlqParams = {
        Namespace: 'AWS/SQS',
        MetricName: 'NumberOfMessagesSent',
        Dimensions: [{ Name: 'QueueName', Value: dlqName }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum']
      };

      const dlqResult = await cloudwatch.getMetricStatistics(dlqParams).promise();
      const totalDLQ = dlqResult.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

      console.log(`📤 Total messages sent to main queue: ${totalSent}`);
      console.log(`💀 Total messages sent to DLQ: ${totalDLQ}`);
      
      if (totalSent > 0) {
        const successRate = ((totalSent - totalDLQ) / totalSent * 100).toFixed(2);
        console.log(`✅ Delivery success rate: ${successRate}%`);
        
        if (parseFloat(successRate) < 95) {
          console.log(`⚠️  WARNING: Low delivery success rate!`);
        }
      }

    } catch (error) {
      console.log('❌ Error calculating delivery analysis:', error instanceof Error ? error.message : String(error));
    }

  } catch (error) {
    console.error('❌ Error checking SQS metrics:', error);
  }
}

// Run the check
checkSQSMetrics().then(() => {
  console.log('\n🎯 SQS metrics check completed');
}).catch(error => {
  console.error('💥 SQS metrics check failed:', error);
  process.exit(1);
});