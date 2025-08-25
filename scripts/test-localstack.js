#!/usr/bin/env node

/**
 * Test LocalStack functionality by creating a simple S3 bucket
 */

const { execSync } = require('child_process');

function runAWSCommand(command) {
  try {
    const result = execSync(`aws --endpoint-url=http://localhost:4566 ${command}`, {
      encoding: 'utf8',
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
        AWS_DEFAULT_REGION: 'us-east-1'
      }
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testLocalStack() {
  console.log('🧪 Testing LocalStack functionality...');
  console.log('');
  
  // Test S3
  console.log('📦 Testing S3...');
  const s3Test = runAWSCommand('s3 mb s3://test-bucket-' + Date.now());
  if (s3Test.success) {
    console.log('✅ S3 is working');
  } else {
    console.log('❌ S3 test failed:', s3Test.error);
  }
  
  // Test DynamoDB
  console.log('🗄️ Testing DynamoDB...');
  const dynamoTest = runAWSCommand('dynamodb list-tables');
  if (dynamoTest.success) {
    console.log('✅ DynamoDB is working');
    console.log('📋 Tables:', dynamoTest.output || 'No tables found');
  } else {
    console.log('❌ DynamoDB test failed:', dynamoTest.error);
  }
  
  // Test IAM
  console.log('🔐 Testing IAM...');
  const iamTest = runAWSCommand('iam list-roles');
  if (iamTest.success) {
    console.log('✅ IAM is working');
  } else {
    console.log('❌ IAM test failed:', iamTest.error);
  }
  
  console.log('');
  console.log('🎉 LocalStack functionality test complete!');
}

if (require.main === module) {
  testLocalStack().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}