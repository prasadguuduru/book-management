#!/bin/bash
# Import existing QA resources into Terraform state in stages to handle dependencies

set -e

echo "🔄 Importing existing QA resources into Terraform state (staged approach)..."

cd infrastructure

# Verify we're in QA workspace
if [ "$(terraform workspace show)" != "qa" ]; then
    echo "❌ Not in QA workspace. Current: $(terraform workspace show)"
    echo "Run: terraform workspace select qa"
    exit 1
fi

echo "✅ In QA workspace"

# Get account ID for ARN construction
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 Account ID: $ACCOUNT_ID"

# Stage 1: Import core infrastructure (no dependencies)
echo "🏗️  Stage 1: Importing core infrastructure..."

# Import DynamoDB table
echo "📊 Importing DynamoDB table..."
terraform import -var-file=qa.tfvars module.dynamodb.aws_dynamodb_table.main qa-ebook-platform-5e7f85a1 || echo "⚠️  Already imported or failed"

# Import S3 buckets
echo "🪣 Importing S3 buckets..."
terraform import -var-file=qa.tfvars module.s3.aws_s3_bucket.frontend qa-ebook-frontend-8ab01079 || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars module.s3.aws_s3_bucket.assets qa-ebook-assets-8ab01079 || echo "⚠️  Already imported or failed"

# Import IAM roles
echo "🔐 Importing IAM roles..."
terraform import -var-file=qa.tfvars module.iam.aws_iam_role.lambda_execution qa-lambda-execution-role || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars module.iam.aws_iam_role.api_gateway_execution qa-api-gateway-execution-role || echo "⚠️  Already imported or failed"

# Import SNS topics
echo "📢 Importing SNS topics..."
terraform import -var-file=qa.tfvars module.sns.aws_sns_topic.user_notifications qa-user-notifications || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars module.sns.aws_sns_topic.system_alerts qa-system-alerts || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars module.sns.aws_sns_topic.book_workflow qa-book-workflow || echo "⚠️  Already imported or failed"

# Import SQS queues
echo "📬 Importing SQS queues..."
terraform import -var-file=qa.tfvars module.sqs.aws_sqs_queue.user_notifications qa-user-notifications || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars module.sqs.aws_sqs_queue.book_workflow qa-book-workflow || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars module.sqs.aws_sqs_queue.email_processing qa-email-processing || echo "⚠️  Already imported or failed"

# Stage 2: Apply core infrastructure to establish dependencies
echo "🔧 Stage 2: Applying core infrastructure..."
terraform apply -var-file=qa.tfvars -target=module.dynamodb -target=module.s3 -target=module.iam -target=module.sns -target=module.sqs -auto-approve

# Stage 3: Import Lambda functions
echo "⚡ Stage 3: Importing Lambda functions..."
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["auth-service"]' qa-auth-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["book-service"]' qa-book-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["user-service"]' qa-user-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["workflow-service"]' qa-workflow-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["review-service"]' qa-review-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["notification-service"]' qa-notification-service || echo "⚠️  Already imported or failed"

# Stage 4: Apply Lambda functions
echo "🔧 Stage 4: Applying Lambda functions..."
terraform apply -var-file=qa.tfvars -target=module.lambda -auto-approve

# Stage 5: Import API Gateway
echo "🌐 Stage 5: Importing API Gateway..."
terraform import -var-file=qa.tfvars module.api_gateway.aws_api_gateway_rest_api.main 7tmom26ucc || echo "⚠️  Already imported or failed"

# Stage 6: Apply API Gateway
echo "🔧 Stage 6: Applying API Gateway..."
terraform apply -var-file=qa.tfvars -target=module.api_gateway -auto-approve

# Stage 7: Import CloudWatch resources (now that Lambda functions exist)
echo "📊 Stage 7: Importing CloudWatch resources..."
# CloudWatch log groups for Lambda functions
terraform import -var-file=qa.tfvars 'module.lambda.aws_cloudwatch_log_group.lambda_logs["auth-service"]' /aws/lambda/qa-auth-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_cloudwatch_log_group.lambda_logs["book-service"]' /aws/lambda/qa-book-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_cloudwatch_log_group.lambda_logs["user-service"]' /aws/lambda/qa-user-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_cloudwatch_log_group.lambda_logs["workflow-service"]' /aws/lambda/qa-workflow-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_cloudwatch_log_group.lambda_logs["review-service"]' /aws/lambda/qa-review-service || echo "⚠️  Already imported or failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_cloudwatch_log_group.lambda_logs["notification-service"]' /aws/lambda/qa-notification-service || echo "⚠️  Already imported or failed"

# Stage 8: Final apply to sync everything
echo "🔧 Stage 8: Final apply to sync all resources..."
terraform apply -var-file=qa.tfvars -auto-approve

echo "✅ Staged import process completed!"
echo "🔍 Checking final state..."
terraform state list | wc -l
echo "📋 Running final plan to check for any remaining drift..."
terraform plan -var-file=qa.tfvars

echo "💡 If you still see changes, they might be configuration drift that needs to be accepted."