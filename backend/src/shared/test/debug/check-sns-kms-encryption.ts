#!/usr/bin/env npx ts-node

/**
 * Check SNS Topic KMS Encryption - Common cause of delivery failures
 */

import { SNSClient, GetTopicAttributesCommand } from '@aws-sdk/client-sns';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

const snsClient = new SNSClient({ region: 'us-east-1' });
const sqsClient = new SQSClient({ region: 'us-east-1' });

async function checkSNSKMSEncryption() {
  console.log('🔐 Checking SNS Topic KMS Encryption...');
  
  const topicArn = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
  
  try {
    // Check SNS topic encryption
    console.log('\n📡 Checking SNS Topic attributes...');
    const topicAttrs = await snsClient.send(new GetTopicAttributesCommand({
      TopicArn: topicArn
    }));
    
    const kmsMasterKeyId = topicAttrs.Attributes?.['KmsMasterKeyId'];
    console.log(`🔑 SNS KmsMasterKeyId: ${kmsMasterKeyId || 'None (not encrypted)'}`);
    
    if (kmsMasterKeyId && kmsMasterKeyId !== 'alias/aws/sns') {
      console.log('⚠️  WARNING: SNS topic uses custom KMS key!');
      console.log('   This is a common cause of delivery failures.');
      console.log('   The KMS key policy must allow sns.amazonaws.com to use the key.');
      console.log('\n🔧 Required KMS key policy statement:');
      console.log(`{
  "Sid": "Allow-SNS-Use-Of-Key",
  "Effect": "Allow",
  "Principal": {"Service": "sns.amazonaws.com"},
  "Action": ["kms:Decrypt", "kms:GenerateDataKey", "kms:Encrypt"],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "kms:EncryptionContext:aws:sns:topicArn": "${topicArn}"
    }
  }
}`);
    } else if (kmsMasterKeyId === 'alias/aws/sns') {
      console.log('✅ SNS topic uses AWS managed key (should work)');
    } else {
      console.log('✅ SNS topic is not encrypted (should work)');
    }
    
    // Check SQS queue encryption
    console.log('\n📨 Checking SQS Queue encryption...');
    const queueAttrs = await sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['KmsMasterKeyId', 'SqsManagedSseEnabled']
    }));
    
    const sqsKmsKey = queueAttrs.Attributes?.['KmsMasterKeyId'];
    const sqsManagedSse = queueAttrs.Attributes?.['SqsManagedSseEnabled'];
    
    console.log(`🔑 SQS KmsMasterKeyId: ${sqsKmsKey || 'None'}`);
    console.log(`🔒 SQS ManagedSSE: ${sqsManagedSse || 'false'}`);
    
    if (sqsKmsKey && sqsKmsKey !== 'alias/aws/sqs') {
      console.log('⚠️  WARNING: SQS queue uses custom KMS key!');
      console.log('   SNS must have permission to use this key to deliver messages.');
    }
    
    // Check for encryption mismatch
    if (kmsMasterKeyId && sqsKmsKey && kmsMasterKeyId !== sqsKmsKey) {
      console.log('\n❌ ENCRYPTION MISMATCH DETECTED!');
      console.log(`   SNS Key: ${kmsMasterKeyId}`);
      console.log(`   SQS Key: ${sqsKmsKey}`);
      console.log('   This can cause delivery failures.');
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (kmsMasterKeyId && kmsMasterKeyId !== 'alias/aws/sns') {
      console.log('1. Check KMS key policy allows sns.amazonaws.com');
      console.log('2. Consider using AWS managed keys for simplicity');
      console.log('3. Test with unencrypted topic temporarily');
    } else {
      console.log('✅ Encryption configuration looks correct');
    }
    
  } catch (error) {
    console.error('❌ Error checking encryption:', error);
  }
}

checkSNSKMSEncryption().catch(console.error);