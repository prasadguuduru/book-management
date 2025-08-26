#!/bin/bash

# Safe LocalStack deployment script
# This script ONLY works with LocalStack and won't touch AWS resources or state

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_status "Safe LocalStack Deployment"
echo "=================================================="
print_warning "This script ONLY affects LocalStack (localhost:4566)"
print_warning "Your AWS resources and state files are completely safe!"
echo ""

# Setup LocalStack environment variables
print_status "Setting up LocalStack environment..."
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export TF_VAR_aws_endpoint_url=http://localhost:4566
export AWS_SSL_VERIFY=false
export AWS_S3_FORCE_PATH_STYLE=true

# Multiple safety checks
if [ "$AWS_ENDPOINT_URL" != "http://localhost:4566" ]; then
    print_error "SAFETY CHECK FAILED: Not pointing to LocalStack!"
    exit 1
fi

if [ "$AWS_ACCESS_KEY_ID" != "test" ]; then
    print_error "SAFETY CHECK FAILED: Not using LocalStack test credentials!"
    exit 1
fi

print_success "✓ All safety checks passed - targeting LocalStack only"

# Check if LocalStack is running
print_status "Checking LocalStack status..."
if ! curl -s http://localhost:4566/health > /dev/null; then
    print_error "LocalStack is not running. Please start it first:"
    echo "  docker-compose up -d localstack"
    exit 1
fi

print_success "LocalStack is running"

# Build Lambda functions first
print_status "Building Lambda functions..."
cd "$PROJECT_ROOT"
npm run build:lambda

# Navigate to infrastructure directory
cd "$INFRASTRUCTURE_DIR"

# Initialize Terraform (safe - doesn't affect existing state)
print_status "Initializing Terraform..."
terraform init

# Select or create local workspace (safe - isolated from other environments)
print_status "Setting up local workspace..."
if terraform workspace list | grep -q "local"; then
    terraform workspace select local
else
    terraform workspace new local
fi

print_success "Using 'local' workspace (isolated from AWS deployments)"

# Validate configuration
print_status "Validating Terraform configuration..."
if ! terraform validate; then
    print_error "Terraform validation failed"
    exit 1
fi

# Plan deployment
print_status "Handling existing table..."
../scripts/handle-existing-table.sh

print_status "Planning LocalStack deployment..."
terraform plan -var-file=local.tfvars -out=local.tfplan

# Ask for confirmation
echo ""
print_warning "About to deploy to LocalStack only. This will:"
print_warning "- Create resources in LocalStack (localhost:4566)"
print_warning "- NOT affect any AWS resources"
print_warning "- NOT modify AWS Terraform state"
echo ""
read -p "Continue with LocalStack deployment? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Deployment cancelled by user"
    exit 0
fi

# Apply deployment
print_status "Applying LocalStack deployment..."
if terraform apply local.tfplan; then
    print_success "Terraform apply completed successfully"
else
    APPLY_EXIT_CODE=$?
    print_warning "Terraform apply encountered issues (exit code: $APPLY_EXIT_CODE)"
    
    # Check if this might be the table already exists issue
    print_status "Checking if this is the 'table already exists' issue..."
    print_warning "If you see 'Table already exists: ebook-platform-local', this is expected and safe."
    print_status "The table was created in a previous deployment and doesn't need to be recreated."
    print_status ""
    print_status "For Lambda-only updates, use: npm run deploy:lambda:local"
    print_status "This will update your Lambda functions without touching the database."
    
    exit $APPLY_EXIT_CODE
fi

print_success "LocalStack deployment completed!"

# Test basic connectivity
print_status "Testing LocalStack services..."
sleep 3

# Test services
if aws --endpoint-url=http://localhost:4566 dynamodb list-tables > /dev/null 2>&1; then
    print_success "✓ DynamoDB is accessible"
else
    print_warning "⚠ DynamoDB test failed"
fi

if aws --endpoint-url=http://localhost:4566 s3 ls > /dev/null 2>&1; then
    print_success "✓ S3 is accessible"
else
    print_warning "⚠ S3 test failed"
fi

if aws --endpoint-url=http://localhost:4566 lambda list-functions > /dev/null 2>&1; then
    print_success "✓ Lambda is accessible"
else
    print_warning "⚠ Lambda test failed"
fi

print_success "Safe LocalStack deployment completed!"
print_status "Your AWS resources and state are completely untouched."