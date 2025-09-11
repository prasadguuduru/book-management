#!/usr/bin/env ts-node

/**
 * SNS to SQS Troubleshooting Checklist
 * 
 * This script systematically checks the 10 most common reasons
 * why SNS messages fail to reach SQS queues.
 */

import { SNSClient, GetTopicAttributesCommand, ListSubscriptionsByTopicCommand, GetSubscriptionAttributesCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });
const cloudWatchClient = new CloudWatchClient({ region: 'us-east-1' });

const TOPIC_ARN = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
const QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
const QUEUE_ARN = 'arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue';

interface CheckResult {
  id: number;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'UNKNOWN';
  details: string;
  recommendation?: string;
}

async function runTroubleshootingChecklist(): Promise<CheckResult[]> {
  console.log('🔍 SNS to SQS Troubleshooting Checklist');
  console.log('=====================================');
  console.log(`📡 SNS Topic: ${TOPIC_ARN}`);
  console.log(`📨 SQS Queue: ${QUEUE_URL}`);
  console.log('');

  const results: CheckResult[] = [];

  // Check 1: SNS Topic Exists and is Accessible
  console.log('1️⃣  Checking if SNS topic exists and is accessible...');
  try {
    const topicAttrs = await snsClient.send(new GetTopicAttributesCommand({
      TopicArn: TOPIC_ARN
    }));

    results.push({
      id: 1,
      description: 'SNS Topic exists and is accessible',
      status: 'PASS',
      details: `Topic found with ${topicAttrs.Attributes?.SubscriptionsConfirmed || 0} confirmed subscriptions`
    });
  } catch (error) {
    results.push({
      id: 1,
      description: 'SNS Topic exists and is accessible',
      status: 'FAIL',
      details: `Error: ${error}`,
      recommendation: 'Verify the SNS topic ARN and ensure it exists in the correct region'
    });
  }

  // Check 2: SQS Queue Exists and is Accessible
  console.log('2️⃣  Checking if SQS queue exists and is accessible...');
  try {
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: QUEUE_URL,
      AttributeNames: ['QueueArn']
    }));

    const actualQueueArn = queueAttrs.Attributes?.QueueArn;
    if (actualQueueArn === QUEUE_ARN) {
      results.push({
        id: 2,
        description: 'SQS Queue exists and ARN matches',
        status: 'PASS',
        details: `Queue ARN: ${actualQueueArn}`
      });
    } else {
      results.push({
        id: 2,
        description: 'SQS Queue exists and ARN matches',
        status: 'FAIL',
        details: `Expected: ${QUEUE_ARN}, Got: ${actualQueueArn}`,
        recommendation: 'Verify the SQS queue ARN matches the subscription endpoint'
      });
    }
  } catch (error) {
    results.push({
      id: 2,
      description: 'SQS Queue exists and is accessible',
      status: 'FAIL',
      details: `Error: ${error}`,
      recommendation: 'Verify the SQS queue URL and ensure it exists in the correct region'
    });
  }

  // Check 3: SNS Subscription Exists and is Confirmed
  console.log('3️⃣  Checking SNS subscription status...');
  try {
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: TOPIC_ARN
    }));

    const sqsSubscription = subscriptions.Subscriptions?.find(sub =>
      sub.Protocol === 'sqs' && sub.Endpoint === QUEUE_ARN
    );

    if (sqsSubscription) {
      if (sqsSubscription.SubscriptionArn === 'PendingConfirmation') {
        results.push({
          id: 3,
          description: 'SNS subscription exists and is confirmed',
          status: 'FAIL',
          details: 'Subscription is pending confirmation',
          recommendation: 'The subscription needs to be confirmed. Check SQS queue policy allows SNS to deliver confirmation.'
        });
      } else {
        results.push({
          id: 3,
          description: 'SNS subscription exists and is confirmed',
          status: 'PASS',
          details: `Subscription ARN: ${sqsSubscription.SubscriptionArn}`
        });
      }
    } else {
      results.push({
        id: 3,
        description: 'SNS subscription exists and is confirmed',
        status: 'FAIL',
        details: 'No SQS subscription found for this topic',
        recommendation: 'Create an SNS subscription from the topic to the SQS queue'
      });
    }
  } catch (error) {
    results.push({
      id: 3,
      description: 'SNS subscription exists and is confirmed',
      status: 'FAIL',
      details: `Error: ${error}`,
      recommendation: 'Check SNS permissions and subscription configuration'
    });
  }

  // Check 4: SQS Queue Policy Allows SNS to Send Messages
  console.log('4️⃣  Checking SQS queue policy for SNS permissions...');
  try {
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: QUEUE_URL,
      AttributeNames: ['Policy']
    }));

    if (queueAttrs.Attributes?.Policy) {
      const policy = JSON.parse(queueAttrs.Attributes.Policy);
      const snsStatements = policy.Statement?.filter((stmt: any) =>
        stmt.Principal?.Service === 'sns.amazonaws.com' &&
        stmt.Action?.includes('sqs:SendMessage')
      );

      if (snsStatements && snsStatements.length > 0) {
        const hasCorrectSourceArn = snsStatements.some((stmt: any) =>
          stmt.Condition?.ArnEquals?.['aws:SourceArn'] === TOPIC_ARN
        );

        if (hasCorrectSourceArn) {
          results.push({
            id: 4,
            description: 'SQS queue policy allows SNS to send messages',
            status: 'PASS',
            details: 'Found valid SNS permission with correct source ARN condition'
          });
        } else {
          results.push({
            id: 4,
            description: 'SQS queue policy allows SNS to send messages',
            status: 'WARNING',
            details: 'SNS permission exists but source ARN condition may be incorrect',
            recommendation: 'Verify the aws:SourceArn condition matches the SNS topic ARN'
          });
        }
      } else {
        results.push({
          id: 4,
          description: 'SQS queue policy allows SNS to send messages',
          status: 'FAIL',
          details: 'No SNS permissions found in queue policy',
          recommendation: 'Add a policy statement allowing sns.amazonaws.com to perform sqs:SendMessage'
        });
      }
    } else {
      results.push({
        id: 4,
        description: 'SQS queue policy allows SNS to send messages',
        status: 'FAIL',
        details: 'No queue policy found',
        recommendation: 'Create a queue policy allowing SNS to send messages'
      });
    }
  } catch (error) {
    results.push({
      id: 4,
      description: 'SQS queue policy allows SNS to send messages',
      status: 'FAIL',
      details: `Error: ${error}`,
      recommendation: 'Check SQS queue policy configuration'
    });
  }

  // Check 5: SNS Topic Policy Allows Publishing
  console.log('5️⃣  Checking SNS topic policy for publish permissions...');
  try {
    const topicAttrs = await snsClient.send(new GetTopicAttributesCommand({
      TopicArn: TOPIC_ARN
    }));

    if (topicAttrs.Attributes?.Policy) {
      const policy = JSON.parse(topicAttrs.Attributes.Policy);
      const publishStatements = policy.Statement?.filter((stmt: any) =>
        stmt.Action?.includes('sns:Publish')
      );

      if (publishStatements && publishStatements.length > 0) {
        results.push({
          id: 5,
          description: 'SNS topic policy allows publishing',
          status: 'PASS',
          details: `Found ${publishStatements.length} publish permission statement(s)`
        });
      } else {
        results.push({
          id: 5,
          description: 'SNS topic policy allows publishing',
          status: 'FAIL',
          details: 'No publish permissions found in topic policy',
          recommendation: 'Add a policy statement allowing sns:Publish action'
        });
      }
    } else {
      results.push({
        id: 5,
        description: 'SNS topic policy allows publishing',
        status: 'WARNING',
        details: 'No explicit topic policy found (using default permissions)',
        recommendation: 'Consider adding an explicit topic policy for better security'
      });
    }
  } catch (error) {
    results.push({
      id: 5,
      description: 'SNS topic policy allows publishing',
      status: 'FAIL',
      details: `Error: ${error}`,
      recommendation: 'Check SNS topic policy configuration'
    });
  }

  // Check 6: No Subscription Filter Policy Blocking Messages
  console.log('6️⃣  Checking for subscription filter policies...');
  try {
    const subscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: TOPIC_ARN
    }));

    const sqsSubscription = subscriptions.Subscriptions?.find(sub =>
      sub.Protocol === 'sqs' && sub.Endpoint === QUEUE_ARN
    );

    if (sqsSubscription && sqsSubscription.SubscriptionArn !== 'PendingConfirmation') {
      const subAttrs = await snsClient.send(new GetSubscriptionAttributesCommand({
        SubscriptionArn: sqsSubscription.SubscriptionArn!
      }));

      if (subAttrs.Attributes?.FilterPolicy) {
        results.push({
          id: 6,
          description: 'No subscription filter policy blocking messages',
          status: 'WARNING',
          details: `Filter policy exists: ${subAttrs.Attributes.FilterPolicy}`,
          recommendation: 'Verify the filter policy allows your message attributes to pass through'
        });
      } else {
        results.push({
          id: 6,
          description: 'No subscription filter policy blocking messages',
          status: 'PASS',
          details: 'No filter policy - all messages should pass through'
        });
      }
    } else {
      results.push({
        id: 6,
        description: 'No subscription filter policy blocking messages',
        status: 'UNKNOWN',
        details: 'Cannot check - subscription not found or not confirmed'
      });
    }
  } catch (error) {
    results.push({
      id: 6,
      description: 'No subscription filter policy blocking messages',
      status: 'FAIL',
      details: `Error: ${error}`,
      recommendation: 'Check subscription filter policy configuration'
    });
  }

  // Check 7: SNS and SQS are in the Same Region
  console.log('7️⃣  Checking if SNS and SQS are in the same region...');
  const snsRegion = TOPIC_ARN.split(':')[3];
  const sqsRegion = QUEUE_ARN.split(':')[3];

  if (snsRegion === sqsRegion) {
    results.push({
      id: 7,
      description: 'SNS and SQS are in the same region',
      status: 'PASS',
      details: `Both in region: ${snsRegion}`
    });
  } else {
    results.push({
      id: 7,
      description: 'SNS and SQS are in the same region',
      status: 'FAIL',
      details: `SNS in ${snsRegion}, SQS in ${sqsRegion}`,
      recommendation: 'SNS and SQS must be in the same region for direct delivery'
    });
  }

  // Check 8: Recent SNS Delivery Failures
  console.log('8️⃣  Checking for recent SNS delivery failures...');
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 30 * 60 * 1000); // 30 minutes ago

    const failedDeliveries = await cloudWatchClient.send(new GetMetricStatisticsCommand({
      Namespace: 'AWS/SNS',
      MetricName: 'NumberOfNotificationsFailed',
      Dimensions: [
        {
          Name: 'TopicName',
          Value: TOPIC_ARN.split(':').pop()!
        }
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 300,
      Statistics: ['Sum']
    }));

    const totalFailures = failedDeliveries.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

    if (totalFailures > 0) {
      results.push({
        id: 8,
        description: 'No recent SNS delivery failures',
        status: 'FAIL',
        details: `${totalFailures} delivery failures in the last 30 minutes`,
        recommendation: 'Check CloudWatch logs for detailed error messages'
      });
    } else {
      results.push({
        id: 8,
        description: 'No recent SNS delivery failures',
        status: 'PASS',
        details: 'No delivery failures detected in the last 30 minutes'
      });
    }
  } catch (error) {
    results.push({
      id: 8,
      description: 'No recent SNS delivery failures',
      status: 'UNKNOWN',
      details: `Could not retrieve metrics: ${error}`,
      recommendation: 'Check CloudWatch metrics manually'
    });
  }

  // Check 9: SQS Queue is Not at Message Limit
  console.log('9️⃣  Checking SQS queue message limits...');
  try {
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: QUEUE_URL,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
    }));

    const visibleMessages = parseInt(queueAttrs.Attributes?.ApproximateNumberOfMessages || '0');
    const inFlightMessages = parseInt(queueAttrs.Attributes?.ApproximateNumberOfMessagesNotVisible || '0');
    const totalMessages = visibleMessages + inFlightMessages;

    // SQS standard queues have no hard limit, but check for reasonable numbers
    if (totalMessages < 100000) {
      results.push({
        id: 9,
        description: 'SQS queue is not at message limit',
        status: 'PASS',
        details: `${totalMessages} total messages (${visibleMessages} visible, ${inFlightMessages} in-flight)`
      });
    } else {
      results.push({
        id: 9,
        description: 'SQS queue is not at message limit',
        status: 'WARNING',
        details: `${totalMessages} total messages - queue may be experiencing issues`,
        recommendation: 'Check if messages are being processed properly'
      });
    }
  } catch (error) {
    results.push({
      id: 9,
      description: 'SQS queue is not at message limit',
      status: 'FAIL',
      details: `Error: ${error}`,
      recommendation: 'Check SQS queue status and accessibility'
    });
  }

  // Check 10: Lambda Function Not Consuming Messages Too Quickly
  console.log('🔟 Checking if Lambda is consuming messages immediately...');
  try {
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: QUEUE_URL,
      AttributeNames: ['ApproximateNumberOfMessages']
    }));

    const currentMessages = parseInt(queueAttrs.Attributes?.ApproximateNumberOfMessages || '0');

    // This is a heuristic check - if there are 0 messages but we know SNS is publishing,
    // Lambda might be consuming them immediately
    if (currentMessages === 0) {
      results.push({
        id: 10,
        description: 'Lambda function not consuming messages too quickly',
        status: 'WARNING',
        details: 'Queue is empty - Lambda may be consuming messages immediately upon delivery',
        recommendation: 'Temporarily disable Lambda event source mapping to test message accumulation'
      });
    } else {
      results.push({
        id: 10,
        description: 'Lambda function not consuming messages too quickly',
        status: 'PASS',
        details: `${currentMessages} messages in queue - Lambda is not consuming immediately`
      });
    }
  } catch (error) {
    results.push({
      id: 10,
      description: 'Lambda function not consuming messages too quickly',
      status: 'UNKNOWN',
      details: `Error: ${error}`,
      recommendation: 'Check Lambda event source mapping configuration'
    });
  }

  return results;
}

async function main() {
  const results = await runTroubleshootingChecklist();

  console.log('\n📋 TROUBLESHOOTING RESULTS');
  console.log('==========================');

  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  let unknownCount = 0;

  results.forEach(result => {
    const statusEmoji = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARNING': '⚠️',
      'UNKNOWN': '❓'
    }[result.status];

    console.log(`\n${result.id}️⃣  ${statusEmoji} ${result.description}`);
    console.log(`    ${result.details}`);

    if (result.recommendation) {
      console.log(`    💡 ${result.recommendation}`);
    }

    switch (result.status) {
      case 'PASS': passCount++; break;
      case 'FAIL': failCount++; break;
      case 'WARNING': warningCount++; break;
      case 'UNKNOWN': unknownCount++; break;
    }
  });

  console.log('\n📊 SUMMARY');
  console.log('===========');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⚠️  Warnings: ${warningCount}`);
  console.log(`❓ Unknown: ${unknownCount}`);

  if (failCount > 0) {
    console.log('\n🔧 NEXT STEPS');
    console.log('==============');
    console.log('Focus on fixing the failed checks first, then address warnings.');
    console.log('The most critical issues are likely related to permissions and subscription configuration.');
  } else if (warningCount > 0) {
    console.log('\n🔧 NEXT STEPS');
    console.log('==============');
    console.log('Address the warnings to ensure optimal message delivery.');
    console.log('Consider temporarily disabling Lambda to test message accumulation.');
  } else {
    console.log('\n🎉 All checks passed! The SNS to SQS configuration appears correct.');
    console.log('If messages are still not being delivered, consider:');
    console.log('1. Checking message format compatibility');
    console.log('2. Verifying Lambda function is processing messages correctly');
    console.log('3. Looking for AWS service limits or throttling');
  }
}

if (require.main === module) {
  main();
}

export { runTroubleshootingChecklist };