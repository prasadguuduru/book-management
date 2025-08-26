#!/bin/bash

# Quick deployment script for local testing
# This script deploys the infrastructure step by step to avoid dependency issues

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

print_status "Quick Local Infrastructure Deployment"
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

# Check if LocalStack is running
print_status "Checking LocalStack status..."
if ! curl -s http://localhost:4566/health > /dev/null; then
    print_error "LocalStack is not running. Please start it first:"
    echo "  npm run localstack:start"
    exit 1
fi

print_success "LocalStack is running and environment is configured"

# Clean up existing LocalStack resources to avoid conflicts
print_status "Cleaning up existing LocalStack resources..."
print_warning "Note: This ONLY affects LocalStack (localhost:4566), not AWS!"

# Safety check
if [ "$AWS_ENDPOINT_URL" != "http://localhost:4566" ]; then
    print_error "SAFETY CHECK FAILED: Not pointing to LocalStack!"
    exit 1
fi

# Delete existing DynamoDB table if it exists
if aws --endpoint-url=http://localhost:4566 dynamodb describe-table --table-name ebook-platform-local > /dev/null 2>&1; then
    print_status "Deleting existing LocalStack DynamoDB table..."
    aws --endpoint-url=http://localhost:4566 dynamodb delete-table --table-name ebook-platform-local > /dev/null 2>&1 || true
    sleep 2
fi

# Delete existing S3 buckets if they exist
for bucket in "ebookfrontend" "ebookassets" "ebook-frontend-local" "ebook-assets-local"; do
    if aws --endpoint-url=http://localhost:4566 s3api head-bucket --bucket "$bucket" > /dev/null 2>&1; then
        print_status "Deleting existing LocalStack S3 bucket: $bucket"
        aws --endpoint-url=http://localhost:4566 s3 rm "s3://$bucket" --recursive > /dev/null 2>&1 || true
        aws --endpoint-url=http://localhost:4566 s3api delete-bucket --bucket "$bucket" > /dev/null 2>&1 || true
    fi
done

print_success "LocalStack resource cleanup completed"

# Navigate to infrastructure directory
cd "$INFRASTRUCTURE_DIR"

# Initialize Terraform
print_status "Initializing Terraform..."
terraform init

# Select or create local workspace
print_status "Setting up local workspace..."
if terraform workspace list | grep -q "local"; then
    terraform workspace select local
else
    terraform workspace new local
fi

# Build Lambda functions first
print_status "Building Lambda functions..."
cd "$PROJECT_ROOT"
npm run build:lambda

# Create tmp directory for Lambda functions
print_status "Creating temporary directory for Lambda functions..."
mkdir -p "$PROJECT_ROOT/tmp"

# Validate Terraform configuration
print_status "Validating Terraform configuration..."
if ! terraform validate; then
    print_error "Terraform validation failed"
    exit 1
fi

print_success "Terraform configuration is valid"

# Plan deployment
print_status "Planning deployment..."
terraform plan -var-file=local.tfvars -out=local.tfplan

# Apply deployment
print_status "Applying deployment..."
terraform apply local.tfplan

print_success "Infrastructure deployed successfully!"

# Get outputs
print_status "Getting deployment outputs..."
terraform output

# Test basic connectivity
print_status "Testing basic connectivity..."

# Wait a moment for services to be ready
sleep 5

# Test LocalStack services
print_status "Testing LocalStack services..."

# Test DynamoDB
if aws --endpoint-url=http://localhost:4566 dynamodb list-tables > /dev/null 2>&1; then
    print_success "✓ DynamoDB is accessible"
else
    print_warning "⚠ DynamoDB test failed"
fi

# Test S3
if aws --endpoint-url=http://localhost:4566 s3 ls > /dev/null 2>&1; then
    print_success "✓ S3 is accessible"
else
    print_warning "⚠ S3 test failed"
fi

# Test Lambda
if aws --endpoint-url=http://localhost:4566 lambda list-functions > /dev/null 2>&1; then
    print_success "✓ Lambda is accessible"
else
    print_warning "⚠ Lambda test failed"
fi

# Test API Gateway
if aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis > /dev/null 2>&1; then
    print_success "✓ API Gateway is accessible"
else
    print_warning "⚠ API Gateway test failed"
fi

print_success "Quick deployment completed!"
print_status "You can now run: npm run test:infra:health"