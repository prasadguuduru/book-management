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

# Check Docker
status "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
fi

# Start LocalStack
status "Starting LocalStack..."
docker-compose up -d localstack

# Wait for LocalStack to be ready
status "Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"status": "running"'; do
    echo "⏳ Waiting for LocalStack..."
    sleep 2
done

# Initialize Terraform
status "Initializing Terraform..."
cd ../infrastructure
terraform init

# Apply Terraform configuration
status "Applying Terraform configuration..."
terraform apply -auto-approve

# Get outputs
API_URL=$(terraform output -raw api_url)
FUNCTION_NAME=$(terraform output -raw lambda_function_name)

# Populate mock data
status "Populating mock data..."
cd ../scripts
node populate-mock-data.js

success "LocalStack setup complete!"
echo "
📝 Environment Details:
- API URL: ${API_URL}
- Lambda Function: ${FUNCTION_NAME}
- DynamoDB Table: books-local

To test the API:
curl '${API_URL}?status=PUBLISHED'

To view Lambda logs:
awslocal logs get /aws/lambda/${FUNCTION_NAME}

To view DynamoDB data:
awslocal dynamodb scan --table-name books-local
"
