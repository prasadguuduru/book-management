#!/bin/bash

# Fix DynamoDB table state issues in LocalStack
# This script properly manages the table in Terraform state

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
TABLE_NAME="ebook-platform-local"

print_status "DynamoDB State Management"
echo "=================================================="
print_status "This script fixes DynamoDB table state issues"
echo ""

# Setup LocalStack environment variables
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Navigate to infrastructure directory
cd "$INFRASTRUCTURE_DIR"

print_status "Checking current Terraform state..."

# Check if table is in state
if terraform state show module.dynamodb.aws_dynamodb_table.main >/dev/null 2>&1; then
    print_success "Table is already managed by Terraform"
    exit 0
fi

print_status "Table not in Terraform state, checking if it exists in LocalStack..."

# Check if table exists in LocalStack
if aws dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
    print_status "Table exists in LocalStack, importing to Terraform state..."
    
    # Try to import
    if terraform import module.dynamodb.aws_dynamodb_table.main "$TABLE_NAME" 2>/dev/null; then
        print_success "Table imported successfully!"
    else
        print_warning "Import failed, trying alternative approach..."
        
        # Alternative: Remove from LocalStack and let Terraform recreate
        print_status "Removing table from LocalStack to let Terraform manage it..."
        aws dynamodb delete-table --table-name "$TABLE_NAME" >/dev/null 2>&1 || true
        
        # Wait a moment for deletion
        sleep 2
        
        print_success "Table removed. Terraform can now create and manage it."
        print_status "Run your deployment script again to create the table properly."
    fi
else
    print_status "Table doesn't exist - Terraform will create it"
fi

print_success "DynamoDB state management completed!"