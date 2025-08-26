#!/bin/bash

# Smart Lambda deployment - creates or updates Lambda functions
# Automatically detects if functions exist and chooses the right approach

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

print_status "Smart Lambda Deployment"
echo "=================================================="
print_status "Automatically creates or updates Lambda functions in LocalStack"
echo ""

# Setup LocalStack environment variables
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Check if LocalStack is running
print_status "Checking LocalStack status..."
if ! curl -s http://localhost:4566/health > /dev/null; then
    print_error "LocalStack is not running. Please start it first:"
    echo "  docker-compose up -d localstack"
    exit 1
fi

print_success "LocalStack is running"

# Check if all required Lambda functions exist
print_status "Checking existing Lambda functions..."
REQUIRED_FUNCTIONS=("local-auth-service" "local-book-service" "local-user-service" "local-review-service" "local-workflow-service" "local-notification-service")
EXISTING_COUNT=0

for func in "${REQUIRED_FUNCTIONS[@]}"; do
    if aws lambda get-function --function-name "$func" --endpoint-url=http://localhost:4566 --region=us-east-1 > /dev/null 2>&1; then
        ((EXISTING_COUNT++))
    fi
done

if [ $EXISTING_COUNT -eq ${#REQUIRED_FUNCTIONS[@]} ]; then
    print_status "All Lambda functions exist - updating code..."
    cd "$PROJECT_ROOT"
    ./scripts/update-lambda-code.sh
else
    print_status "Missing Lambda functions ($EXISTING_COUNT/${#REQUIRED_FUNCTIONS[@]} found) - creating all functions..."
    cd "$PROJECT_ROOT"
    ./scripts/create-lambda-functions.sh
fi

print_success "Smart Lambda deployment completed!"
print_status "Your Lambda functions are ready in LocalStack."