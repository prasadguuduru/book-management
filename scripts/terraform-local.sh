#!/bin/bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display status
status() {
    echo -e "${BLUE}🚀 $1${NC}"
}

# Function to display success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to display error and exit
error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if LocalStack is running
status "Checking LocalStack..."
if ! curl -s http://localhost:4566/_localstack/health | grep -q '"status": "running"'; then
    error "LocalStack is not running. Please start it first."
fi

# Navigate to infrastructure directory
cd ../infrastructure

# Initialize Terraform
status "Initializing Terraform..."
terraform init

# Plan Terraform changes
status "Planning Terraform changes..."
terraform plan -out=tfplan

# Apply Terraform changes
status "Applying Terraform changes..."
terraform apply tfplan

# Get outputs
status "Getting API Gateway URL..."
API_URL=$(terraform output -raw api_url)
FUNCTION_NAME=$(terraform output -raw lambda_function_name)

success "Infrastructure deployment complete!"
echo "
📝 Infrastructure Details:
- API URL: ${API_URL}
- Lambda Function: ${FUNCTION_NAME}

To test the API:
curl ${API_URL}

To view Lambda logs:
awslocal logs get /aws/lambda/${FUNCTION_NAME}
"
