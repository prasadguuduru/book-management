#!/bin/bash

# Fix LocalStack deployment issues
# This script addresses common LocalStack compatibility problems

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"

print_status "LocalStack Deployment Fix"
echo "=================================================="

# Setup LocalStack environment variables
print_status "Setting up LocalStack environment..."
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export TF_VAR_aws_endpoint_url=http://localhost:4566
export AWS_SSL_VERIFY=false
export AWS_S3_FORCE_PATH_STYLE=true

# Safety check - ensure we're pointing to LocalStack
if [ "$AWS_ENDPOINT_URL" != "http://localhost:4566" ]; then
    print_error "SAFETY CHECK FAILED: Not pointing to LocalStack!"
    print_error "AWS_ENDPOINT_URL = $AWS_ENDPOINT_URL"
    print_error "This script should only be used with LocalStack"
    exit 1
fi

print_success "✓ Confirmed: All operations will target LocalStack only (localhost:4566)"

# Check if LocalStack is running
print_status "Checking LocalStack status..."
if ! curl -s http://localhost:4566/health > /dev/null; then
    print_error "LocalStack is not running. Starting LocalStack..."
    cd "$PROJECT_ROOT"
    docker-compose up -d localstack
    
    # Wait for LocalStack to be ready
    print_status "Waiting for LocalStack to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:4566/health > /dev/null; then
            break
        fi
        sleep 2
        echo -n "."
    done
    echo ""
    
    if ! curl -s http://localhost:4566/health > /dev/null; then
        print_error "LocalStack failed to start properly"
        exit 1
    fi
fi

print_success "LocalStack is running"

# Clean up LOCAL Terraform state only (not AWS!)
print_status "Cleaning up LOCAL Terraform state only..."
cd "$INFRASTRUCTURE_DIR"

# Only remove local-specific files
rm -f local.tfplan
rm -f terraform.tfstate.backup

# Clean up LOCAL workspace only (this is safe - only affects LocalStack)
if terraform workspace list 2>/dev/null | grep -q "local"; then
    print_status "Switching from local workspace to default..."
    terraform workspace select default 2>/dev/null || true
    print_status "Deleting local workspace (LocalStack only)..."
    terraform workspace delete local 2>/dev/null || true
fi

print_warning "Note: This script ONLY affects LocalStack resources, not AWS!"

# Clean up existing LocalStack resources
print_status "Cleaning up existing LocalStack resources..."

# Function to safely delete AWS resources
safe_delete() {
    local service=$1
    local command=$2
    local resource=$3
    
    if eval "$command" > /dev/null 2>&1; then
        print_status "Deleting existing $service resource: $resource"
        eval "$command" > /dev/null 2>&1 || print_warning "Failed to delete $resource"
    fi
}

# Delete DynamoDB tables
for table in "ebook-platform-local" "local-ebook-platform" $(aws --endpoint-url=http://localhost:4566 dynamodb list-tables --query 'TableNames[]' --output text 2>/dev/null | grep -E "(ebook|local)" || true); do
    if [ -n "$table" ]; then
        safe_delete "DynamoDB" "aws --endpoint-url=http://localhost:4566 dynamodb delete-table --table-name $table" "$table"
    fi
done

# Delete S3 buckets
for bucket in "ebookfrontend" "ebookassets" "ebook-frontend-local" "ebook-assets-local" $(aws --endpoint-url=http://localhost:4566 s3api list-buckets --query 'Buckets[].Name' --output text 2>/dev/null | grep -E "(ebook|local)" || true); do
    if [ -n "$bucket" ]; then
        # Empty bucket first
        aws --endpoint-url=http://localhost:4566 s3 rm "s3://$bucket" --recursive > /dev/null 2>&1 || true
        safe_delete "S3" "aws --endpoint-url=http://localhost:4566 s3api delete-bucket --bucket $bucket" "$bucket"
    fi
done

# Delete Lambda functions
for func in $(aws --endpoint-url=http://localhost:4566 lambda list-functions --query 'Functions[].FunctionName' --output text 2>/dev/null | grep -E "(ebook|local)" || true); do
    if [ -n "$func" ]; then
        safe_delete "Lambda" "aws --endpoint-url=http://localhost:4566 lambda delete-function --function-name $func" "$func"
    fi
done

# Delete API Gateway APIs
for api in $(aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query 'items[].id' --output text 2>/dev/null || true); do
    if [ -n "$api" ]; then
        safe_delete "API Gateway" "aws --endpoint-url=http://localhost:4566 apigateway delete-rest-api --rest-api-id $api" "$api"
    fi
done

# Delete SNS topics
for topic in $(aws --endpoint-url=http://localhost:4566 sns list-topics --query 'Topics[].TopicArn' --output text 2>/dev/null | grep -E "(ebook|local)" || true); do
    if [ -n "$topic" ]; then
        safe_delete "SNS" "aws --endpoint-url=http://localhost:4566 sns delete-topic --topic-arn $topic" "$topic"
    fi
done

# Delete SQS queues
for queue in $(aws --endpoint-url=http://localhost:4566 sqs list-queues --query 'QueueUrls[]' --output text 2>/dev/null | grep -E "(ebook|local)" || true); do
    if [ -n "$queue" ]; then
        safe_delete "SQS" "aws --endpoint-url=http://localhost:4566 sqs delete-queue --queue-url $queue" "$queue"
    fi
done

print_success "Resource cleanup completed"

# Wait a moment for cleanup to complete
sleep 3

# Initialize Terraform
print_status "Initializing Terraform..."
terraform init

# Create local workspace
print_status "Creating local workspace..."
terraform workspace new local || terraform workspace select local

# Validate configuration
print_status "Validating Terraform configuration..."
if ! terraform validate; then
    print_error "Terraform validation failed"
    exit 1
fi

print_success "Terraform configuration is valid"

# Plan deployment with LocalStack-compatible settings
print_status "Planning deployment with LocalStack settings..."
terraform plan -var-file=local.tfvars -out=local.tfplan

# Apply deployment
print_status "Applying deployment..."
terraform apply local.tfplan

print_success "LocalStack deployment completed successfully!"

# Test deployment
print_status "Testing deployment..."

# Wait for services to be ready
sleep 5

# Test services
services_ok=true

# Test DynamoDB
if aws --endpoint-url=http://localhost:4566 dynamodb list-tables > /dev/null 2>&1; then
    print_success "✓ DynamoDB is accessible"
else
    print_error "✗ DynamoDB test failed"
    services_ok=false
fi

# Test S3
if aws --endpoint-url=http://localhost:4566 s3 ls > /dev/null 2>&1; then
    print_success "✓ S3 is accessible"
else
    print_error "✗ S3 test failed"
    services_ok=false
fi

# Test Lambda
if aws --endpoint-url=http://localhost:4566 lambda list-functions > /dev/null 2>&1; then
    print_success "✓ Lambda is accessible"
else
    print_error "✗ Lambda test failed"
    services_ok=false
fi

# Test API Gateway
if aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis > /dev/null 2>&1; then
    print_success "✓ API Gateway is accessible"
else
    print_error "✗ API Gateway test failed"
    services_ok=false
fi

if [ "$services_ok" = true ]; then
    print_success "All services are working correctly!"
    print_status "You can now test your application with: npm run test:local"
else
    print_warning "Some services may have issues. Check the logs above."
fi

# Show outputs
print_status "Deployment outputs:"
terraform output

print_success "LocalStack deployment fix completed!"