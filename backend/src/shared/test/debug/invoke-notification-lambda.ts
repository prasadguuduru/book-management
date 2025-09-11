/**
 * Direct Lambda Invocation Debug Script
 * Invokes the notification service Lambda directly with a test SQS event
 */

import { Lambda } from 'aws-sdk';

const lambda = new Lambda({ region: 'us-east-1' });

async function invokeNotificationLambda() {
    console.log('🔍 Starting Direct Lambda Invocation...');

    const functionName = 'qa-notification-service';

    // Create a test SQS event that mimics what SNS would send
    const testSQSEvent = {
        Records: [
            {
                messageId: 'test-message-' + Date.now(),
                receiptHandle: 'test-receipt-handle',
                body: JSON.stringify({
                    Type: 'Notification',
                    MessageId: 'test-sns-message-' + Date.now(),
                    TopicArn: 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events',
                    Message: JSON.stringify({
                        eventType: 'book_status_changed',
                        eventId: '3e678a7d-cc32-4c3d-b4c5-5d8bb8395df1', // Use the event ID from our recent SNS test
                        timestamp: new Date().toISOString(),
                        source: 'workflow-service',
                        version: '1.0',
                        data: {
                            bookId: 'test-direct-sns-' + Date.now(),
                            title: 'Direct SNS Test Book',
                            author: 'test-author-id',
                            previousStatus: 'DRAFT',
                            newStatus: 'SUBMITTED_FOR_EDITING',
                            changedBy: 'test-user-id',
                            changeReason: 'Testing direct lambda invocation',
                            metadata: {
                                notificationType: 'book_submitted',
                                bookGenre: 'Technology',
                                bookDescription: 'A test book for debugging'
                            }
                        }
                    }),
                    Timestamp: new Date().toISOString(),
                    MessageAttributes: {
                        eventType: {
                            Type: 'String',
                            Value: 'book_status_changed'
                        },
                        bookId: {
                            Type: 'String',
                            Value: 'test-book-direct-invoke'
                        },
                        newStatus: {
                            Type: 'String',
                            Value: 'SUBMITTED_FOR_EDITING'
                        },
                        source: {
                            Type: 'String',
                            Value: 'workflow-service'
                        }
                    }
                }),
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: Date.now().toString(),
                    SenderId: 'test-sender',
                    ApproximateFirstReceiveTimestamp: Date.now().toString()
                },
                messageAttributes: {},
                md5OfBody: 'test-md5',
                eventSource: 'aws:sqs',
                eventSourceARN: 'arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue',
                awsRegion: 'us-east-1'
            }
        ]
    };

    try {
        console.log('📋 Invoking Lambda function with test SQS event...');
        console.log('Event payload:', JSON.stringify(testSQSEvent, null, 2));

        const result = await lambda.invoke({
            FunctionName: functionName,
            InvocationType: 'RequestResponse', // Synchronous invocation
            LogType: 'Tail', // Include logs in response
            Payload: JSON.stringify(testSQSEvent)
        }).promise();

        console.log('✅ Lambda invocation completed');
        console.log('Status Code:', result.StatusCode);

        if (result.LogResult) {
            const logs = Buffer.from(result.LogResult, 'base64').toString('utf-8');
            console.log('📋 Lambda Logs:');
            console.log('================');
            console.log(logs);
            console.log('================');
        }

        if (result.Payload) {
            const payload = JSON.parse(result.Payload.toString());
            console.log('📋 Lambda Response:');
            console.log(JSON.stringify(payload, null, 2));
        }

        if (result.FunctionError) {
            console.log('❌ Function Error:', result.FunctionError);
        }

    } catch (error) {
        console.error('❌ Lambda invocation failed:', error);
    }
}

// Run the debug if this file is executed directly
if (require.main === module) {
    invokeNotificationLambda().then(() => {
        console.log('🎉 Direct Lambda invocation debug completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Debug failed:', error);
        process.exit(1);
    });
}

export { invokeNotificationLambda };