#!/bin/bash

# Setup LocalStack environment variables for Terraform
# Usage: source ./scripts/setup-localstack-env.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[INFO]${NC} Setting up LocalStack environment variables..."

# LocalStack AWS Configuration
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Terraform LocalStack Configuration
export TF_VAR_aws_endpoint_url=http://localhost:4566

# LocalStack specific settings
export LOCALSTACK_ENDPOINT=http://localhost:4566

# Disable SSL verification for LocalStack
export AWS_SSL_VERIFY=false

# Use path-style S3 URLs for LocalStack
export AWS_S3_FORCE_PATH_STYLE=true

echo -e "${GREEN}[SUCCESS]${NC} LocalStack environment variables set:"
echo "  AWS_ENDPOINT_URL=$AWS_ENDPOINT_URL"
echo "  AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID"
echo "  AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION"
echo "  TF_VAR_aws_endpoint_url=$TF_VAR_aws_endpoint_url"
echo ""
echo -e "${BLUE}[INFO]${NC} You can now run Terraform commands with LocalStack"
echo "  Example: terraform plan -var-file=local.tfvars"