#!/bin/bash

# LocalStack initialization script
# This script runs when LocalStack is ready and sets up initial AWS resources

echo "🚀 Initializing LocalStack resources..."

# Set AWS CLI to use LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

# Wait a bit for LocalStack to be fully ready
sleep 5

# Create S3 buckets for local development
echo "📦 Creating S3 buckets..."
aws s3 mb s3://local-ebook-frontend --endpoint-url=http://localhost:4566
aws s3 mb s3://local-ebook-assets --endpoint-url=http://localhost:4566

# Enable S3 website hosting for frontend bucket
aws s3 website s3://local-ebook-frontend \
  --index-document index.html \
  --error-document error.html \
  --endpoint-url=http://localhost:4566

# Set bucket policy for public read access
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::local-ebook-frontend/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket local-ebook-frontend \
  --policy file:///tmp/bucket-policy.json \
  --endpoint-url=http://localhost:4566

# Create SNS topics
echo "📢 Creating SNS topics..."
aws sns create-topic --name local-book-events --endpoint-url=http://localhost:4566
aws sns create-topic --name local-notification-events --endpoint-url=http://localhost:4566

# Create SQS queues
echo "📬 Creating SQS queues..."
aws sqs create-queue --queue-name local-notification-queue --endpoint-url=http://localhost:4566
aws sqs create-queue --queue-name local-email-queue --endpoint-url=http://localhost:4566

# Create IAM role for Lambda functions (basic role for LocalStack)
echo "🔐 Creating IAM roles..."
cat > /tmp/lambda-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name LocalLambdaExecutionRole \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
  --endpoint-url=http://localhost:4566

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name LocalLambdaExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --endpoint-url=http://localhost:4566

echo "✅ LocalStack initialization complete!"
echo "🌐 LocalStack Dashboard: http://localhost:4566"
echo "🗄️  DynamoDB Admin: http://localhost:8001"