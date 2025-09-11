#!/usr/bin/env ts-node

/**
 * Fix SQS Policy for SNS Delivery
 * 
 * This script updates the SQS queue policy to ensure SNS can deliver messages
 * by adding the proper source ARN condition.
 */

import { SQSClient, SetQueueAttributesCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({ region: 'us-east-1' });

async function fixSQSPolicy() {
    console.log('🔧 Fixing SQS queue policy for SNS delivery...');

    const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
    const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';

    try {
        // Get current policy
        const currentResult = await sqsClient.send(new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ['Policy']
        }));

        console.log('📋 Current policy retrieved');

        // Create updated policy with proper SNS source ARN condition
        const updatedPolicy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "AllowSNSPublish",
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "sns.amazonaws.com"
                    },
                    "Action": "sqs:SendMessage",
                    "Resource": "arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue",
                    "Condition": {
                        "StringEquals": {
                            "aws:SourceAccount": "582491219315"
                        },
                        "ArnEquals": {
                            "aws:SourceArn": topicArn
                        }
                    }
                },
                {
                    "Sid": "AllowLambdaAccess",
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": "arn:aws:iam::582491219315:root"
                    },
                    "Action": [
                        "sqs:ReceiveMessage",
                        "sqs:DeleteMessage",
                        "sqs:GetQueueAttributes"
                    ],
                    "Resource": "arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue",
                    "Condition": {
                        "StringEquals": {
                            "aws:PrincipalServiceName": "lambda.amazonaws.com"
                        }
                    }
                }
            ]
        };

        console.log('🔄 Updating SQS queue policy...');
        console.log('📋 New policy includes:');
        console.log(`   - Source account condition: 582491219315`);
        console.log(`   - Source ARN condition: ${topicArn}`);

        // Update the queue policy
        await sqsClient.send(new SetQueueAttributesCommand({
            QueueUrl: queueUrl,
            Attributes: {
                Policy: JSON.stringify(updatedPolicy)
            }
        }));

        console.log('✅ SQS queue policy updated successfully!');
        console.log('');
        console.log('🧪 Now test the flow:');
        console.log('   1. Publish a book to trigger workflow');
        console.log('   2. Check if notification service receives SQS events');
        console.log('   3. Verify email delivery');

    } catch (error) {
        console.error('❌ Error updating SQS policy:', error);
    }
}

async function main() {
    await fixSQSPolicy();
}

if (require.main === module) {
    main();
}

export { fixSQSPolicy };