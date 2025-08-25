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
success "LocalStack is ready!"

# Initialize and apply Terraform
status "Initializing Terraform..."
cd infrastructure
terraform init

status "Applying Terraform configuration..."
terraform apply -auto-approve

# Get Terraform outputs
API_ID=$(terraform output -raw api_gateway_id)
LAMBDA_FUNCTION=$(terraform output -raw lambda_function_name)
success "Terraform infrastructure provisioned!"

# Verify infrastructure
status "Verifying infrastructure..."
echo "API Gateway ID: ${API_ID}"
echo "Lambda Function: ${LAMBDA_FUNCTION}"

# Verify API Gateway endpoint
status "Verifying API Gateway endpoint..."
API_URL="http://localhost:4566/restapis/${API_ID}/local/_user_request_/hello"
until curl -s "${API_URL}" > /dev/null 2>&1; do
    echo "⏳ Waiting for API Gateway..."
    sleep 2
done
success "API Gateway is ready!"

# Populate mock data
status "Populating mock data..."
cd ..
node scripts/populate-mock-data.js

# Update frontend environment variables
status "Updating frontend environment..."
cat > frontend/.env.local << EOF
REACT_APP_API_URL=http://localhost:4566
REACT_APP_API_ID=${API_ID}
REACT_APP_STAGE=local
EOF

# Start frontend
status "Starting frontend..."
cd frontend && npm start