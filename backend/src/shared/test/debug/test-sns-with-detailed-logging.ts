#!/usr/bin/env npx ts-node

/**
 * Test SNS with detailed logging and error handling
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSClient, ReceiveMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function testSNSWithDetailedLogging() {
    console.log('🧪 Testing SNS with detailed logging...');

    const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';

    try {
        // Check initial queue state
        console.log('\n📊 Initial queue state:');
        const initialAttrs = await sqsClient.send(new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
        }));
        console.log(`   Visible messages: ${initialAttrs.Attributes?.ApproximateNumberOfMessages}`);
        console.log(`   Not visible messages: ${initialAttrs.Attributes?.ApproximateNumberOfMessagesNotVisible}`);

        // Publish message with detailed logging
        console.log('\n📤 Publishing message to SNS...');
        const testMessage = {
            eventId: 'test-' + Date.now(),
            eventType: 'BOOK_PUBLISHED',
            source: 'workflow-service',
            timestamp: new Date().toISOString(),
            data: {
                bookId: 'test-book-123',
                userId: 'test-user-456',
                title: 'Test Book',
                previousStatus: 'draft',
                newStatus: 'published',
                metadata: {
                    notificationType: 'BOOK_PUBLISHED'
                }
            }
        };

        const publishCommand = new PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify(testMessage),
            Subject: 'Test Book Status Changed',
            MessageAttributes: {
                eventType: {
                    DataType: 'String',
                    StringValue: testMessage.eventType
                },
                bookId: {
                    DataType: 'String',
                    StringValue: testMessage.data.bookId
                }
            }
        });

        console.log('📋 Publish parameters:');
        console.log(`   Topic ARN: ${topicArn}`);
        console.log(`   Message length: ${JSON.stringify(testMessage).length} characters`);
        console.log(`   Message attributes: ${Object.keys(publishCommand.input.MessageAttributes || {}).length}`);

        const publishResult = await snsClient.send(publishCommand);
        console.log(`✅ Message published successfully: ${publishResult.MessageId}`);

        // Wait and check multiple times
        for (let i = 1; i <= 6; i++) {
            console.log(`\n⏳ Waiting ${i * 5} seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));

            const attrs = await sqsClient.send(new GetQueueAttributesCommand({
                QueueUrl: queueUrl,
                AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
            }));

            const visible = parseInt(attrs.Attributes?.ApproximateNumberOfMessages || '0');
            const notVisible = parseInt(attrs.Attributes?.ApproximateNumberOfMessagesNotVisible || '0');

            console.log(`📊 Queue state (${i * 5}s):`);
            console.log(`   Visible: ${visible}, Not visible: ${notVisible}, Total: ${visible + notVisible}`);

            if (visible > 0 || notVisible > 0) {
                console.log('✅ Message detected in queue!');

                // Try to receive the message
                const receiveResult = await sqsClient.send(new ReceiveMessageCommand({
                    QueueUrl: queueUrl,
                    MaxNumberOfMessages: 1,
                    WaitTimeSeconds: 1
                }));

                if (receiveResult.Messages && receiveResult.Messages.length > 0) {
                    const message = receiveResult.Messages[0];
                    if (message) {
                        console.log('📨 Message received:');
                        console.log(`   Message ID: ${message.MessageId || 'N/A'}`);
                        console.log(`   Body length: ${message.Body?.length || 0} characters`);
                        console.log(`   Receipt handle: ${message.ReceiptHandle?.substring(0, 50) || 'N/A'}...`);
                    }
                }

                break;
            }

            if (i === 6) {
                console.log('❌ No message detected after 30 seconds');
            }
        }

    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

testSNSWithDetailedLogging().catch(console.error);