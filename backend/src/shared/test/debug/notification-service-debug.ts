/**
 * Notification Service Debug Script
 * Checks if the notification service is processing messages and sending emails
 */

import { SQS, CloudWatchLogs, Lambda } from 'aws-sdk';

const sqs = new SQS({ region: 'us-east-1' });
const cloudWatchLogs = new CloudWatchLogs({ region: 'us-east-1' });
const lambda = new Lambda({ region: 'us-east-1' });

async function debugNotificationService() {
  console.log('🔍 Starting Notification Service Debug...');
  
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  const functionName = 'qa-notification-service';
  const logGroupName = '/aws/lambda/qa-notification-service';
  
  try {
    // 1. Check Lambda function status
    console.log('📋 Checking Lambda function...');
    try {
      const functionConfig = await lambda.getFunctionConfiguration({ FunctionName: functionName }).promise();
      console.log('✅ Lambda function exists:', {
        functionName: functionConfig.FunctionName,
        state: functionConfig.State,
        lastModified: functionConfig.LastModified,
        runtime: functionConfig.Runtime,
        timeout: functionConfig.Timeout
      });
    } catch (error) {
      console.log('❌ Lambda function not found or not accessible:', error);
      return;
    }
    
    // 2. Check SQS queue and DLQ
    console.log('📋 Checking SQS Queue details...');
    const queueAttributes = await sqs.getQueueAttributes({
      QueueUrl: queueUrl,
      AttributeNames: ['All']
    }).promise();
    
    console.log('✅ Queue details:', {
      approximateNumberOfMessages: queueAttributes.Attributes?.['ApproximateNumberOfMessages'],
      approximateNumberOfMessagesNotVisible: queueAttributes.Attributes?.['ApproximateNumberOfMessagesNotVisible'],
      approximateNumberOfMessagesDelayed: queueAttributes.Attributes?.['ApproximateNumberOfMessagesDelayed'],
      visibilityTimeout: queueAttributes.Attributes?.['VisibilityTimeout'],
      messageRetentionPeriod: queueAttributes.Attributes?.['MessageRetentionPeriod'],
      redrivePolicy: queueAttributes.Attributes?.['RedrivePolicy']
    });
    
    // 3. Check for DLQ
    const redrivePolicy = queueAttributes.Attributes?.['RedrivePolicy'];
    if (redrivePolicy) {
      const policy = JSON.parse(redrivePolicy);
      console.log('📋 Checking Dead Letter Queue...');
      
      // Extract DLQ ARN and convert to URL
      const dlqArn = policy.deadLetterTargetArn;
      const dlqName = dlqArn.split(':').pop();
      const dlqUrl = `https://sqs.us-east-1.amazonaws.com/582491219315/${dlqName}`;
      
      try {
        const dlqAttributes = await sqs.getQueueAttributes({
          QueueUrl: dlqUrl,
          AttributeNames: ['ApproximateNumberOfMessages']
        }).promise();
        
        console.log('✅ DLQ status:', {
          dlqName,
          messagesInDLQ: dlqAttributes.Attributes?.['ApproximateNumberOfMessages']
        });
        
        // Check for messages in DLQ
        if (parseInt(dlqAttributes.Attributes?.['ApproximateNumberOfMessages'] || '0') > 0) {
          console.log('⚠️ Found messages in DLQ - checking them...');
          const dlqMessages = await sqs.receiveMessage({
            QueueUrl: dlqUrl,
            MaxNumberOfMessages: 5
          }).promise();
          
          if (dlqMessages.Messages) {
            dlqMessages.Messages.forEach((msg, index) => {
              console.log(`DLQ Message ${index + 1}:`, {
                messageId: msg.MessageId,
                body: JSON.parse(msg.Body || '{}')
              });
            });
          }
        }
      } catch (error) {
        console.log('❌ Could not check DLQ:', error);
      }
    }
    
    // 4. Check recent CloudWatch logs
    console.log('📋 Checking recent CloudWatch logs...');
    try {
      const logStreams = await cloudWatchLogs.describeLogStreams({
        logGroupName,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 5
      }).promise();
      
      if (logStreams.logStreams && logStreams.logStreams.length > 0) {
        console.log('✅ Found log streams:', logStreams.logStreams.length);
        
        // Get recent logs from the most recent stream
        const mostRecentStream = logStreams.logStreams[0];
        if (mostRecentStream && mostRecentStream.logStreamName) {
          console.log('📋 Checking most recent log stream:', mostRecentStream.logStreamName);
          
          const logEvents = await cloudWatchLogs.getLogEvents({
            logGroupName,
            logStreamName: mostRecentStream.logStreamName,
            startTime: Date.now() - (60 * 60 * 1000), // Last hour
            limit: 20
          }).promise();
          
          if (logEvents.events && logEvents.events.length > 0) {
            console.log('✅ Recent log events:');
            logEvents.events.forEach((event, index) => {
              console.log(`Log ${index + 1}:`, {
                timestamp: new Date(event.timestamp!).toISOString(),
                message: event.message
              });
            });
          } else {
            console.log('⚠️ No recent log events found');
          }
        } else {
          console.log('⚠️ No valid log stream found');
        }
      } else {
        console.log('⚠️ No log streams found');
      }
    } catch (error) {
      console.log('❌ Could not access CloudWatch logs:', error);
    }
    
    // 5. Send a test message directly to the queue
    console.log('📋 Sending test message directly to SQS...');
    const testSQSMessage = {
      Type: 'Notification',
      MessageId: 'test-direct-' + Date.now(),
      TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events',
      Message: JSON.stringify({
        eventType: 'book_status_changed',
        eventId: 'test-direct-' + Date.now(),
        timestamp: new Date().toISOString(),
        source: 'debug-script',
        version: '1.0',
        data: {
          bookId: 'test-book-direct',
          title: 'Direct SQS Test Book',
          author: 'debug-author',
          previousStatus: 'DRAFT',
          newStatus: 'SUBMITTED_FOR_EDITING',
          changedBy: 'debug-user',
          metadata: {
            notificationType: 'book_submitted'
          }
        }
      }),
      Timestamp: new Date().toISOString(),
      MessageAttributes: {
        eventType: {
          Type: 'String',
          Value: 'book_status_changed'
        }
      }
    };
    
    const sqsResult = await sqs.sendMessage({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(testSQSMessage)
    }).promise();
    
    console.log('✅ Test message sent directly to SQS:', {
      messageId: sqsResult.MessageId
    });
    
    // 6. Wait and check if it gets processed
    console.log('📋 Waiting to see if message gets processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalQueueCheck = await sqs.getQueueAttributes({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages']
    }).promise();
    
    console.log('✅ Final queue check:', {
      messagesRemaining: finalQueueCheck.Attributes?.['ApproximateNumberOfMessages']
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug if this file is executed directly
if (require.main === module) {
  debugNotificationService().then(() => {
    console.log('🎉 Notification service debug completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  });
}

export { debugNotificationService };