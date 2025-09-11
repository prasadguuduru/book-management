#!/usr/bin/env npx ts-node

/**
 * Fix KMS encryption mismatch between SNS and SQS
 */

import { SNSClient, SetTopicAttributesCommand, GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import { SQSClient, SetQueueAttributesCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function fixEncryptionMismatch() {
  console.log('🔧 Fixing KMS encryption mismatch...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  try {
    // Option 1: Remove encryption from both (simplest)
    console.log('\n📡 Removing encryption from SNS topic...');
    await snsClient.send(new SetTopicAttributesCommand({
      TopicArn: topicArn,
      AttributeName: 'KmsMasterKeyId',
      AttributeValue: '' // Empty string removes encryption
    }));
    console.log('✅ SNS topic encryption removed');
    
    console.log('\n📨 Removing encryption from SQS queue...');
    await sqsClient.send(new SetQueueAttributesCommand({
      QueueUrl: queueUrl,
      Attributes: {
        KmsMasterKeyId: '', // Empty string removes encryption
        SqsManagedSseEnabled: 'false'
      }
    }));
    console.log('✅ SQS queue encryption removed');
    
    // Verify changes
    console.log('\n🔍 Verifying changes...');
    
    const topicAttrs = await snsClient.send(new GetTopicAttributesCommand({
      TopicArn: topicArn
    }));
    const snsKey = topicAttrs.Attributes?.['KmsMasterKeyId'];
    console.log(`📡 SNS KmsMasterKeyId: ${snsKey || 'None (unencrypted)'}`);
    
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['KmsMasterKeyId', 'SqsManagedSseEnabled']
    }));
    const sqsKey = queueAttrs.Attributes?.['KmsMasterKeyId'];
    const sqsManagedSse = queueAttrs.Attributes?.['SqsManagedSseEnabled'];
    console.log(`📨 SQS KmsMasterKeyId: ${sqsKey || 'None (unencrypted)'}`);
    console.log(`📨 SQS ManagedSSE: ${sqsManagedSse || 'false'}`);
    
    if (!snsKey && !sqsKey) {
      console.log('\n✅ SUCCESS: Both SNS and SQS are now unencrypted');
      console.log('🧪 Test SNS to SQS delivery now');
    } else {
      console.log('\n⚠️  Encryption settings may still be mismatched');
    }
    
  } catch (error) {
    console.error('❌ Error fixing encryption:', error);
    console.log('\n💡 Alternative approach:');
    console.log('1. Recreate the topic and queue without encryption');
    console.log('2. Or align both to use the same KMS key');
  }
}

fixEncryptionMismatch().catch(console.error);