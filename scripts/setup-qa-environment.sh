#!/bin/bash

# QA Environment Setup Script
# Ensures QA environment has the same rich experience as local development

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

# Check if AWS CLI is configured
check_aws_config() {
    print_status "Checking AWS configuration..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "AWS CLI is configured"
}

# Check if Node.js is available
check_node() {
    print_status "Checking Node.js..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    print_success "Node.js is available"
}

# Compare environments
compare_environments() {
    print_status "Comparing local vs QA environment configurations..."
    
    if [ -f "scripts/compare-environments.js" ]; then
        node scripts/compare-environments.js
    else
        print_warning "Environment comparison script not found"
    fi
}

# Test QA API endpoints
test_qa_api() {
    print_status "Testing QA API endpoints..."
    
    # Load QA environment variables
    if [ -f "frontend/.env.qa" ]; then
        source frontend/.env.qa
    else
        print_error "QA environment file not found: frontend/.env.qa"
        return 1
    fi
    
    if [ -z "$VITE_APIGATEWAY_URL" ]; then
        print_error "VITE_APIGATEWAY_URL not set in QA environment"
        return 1
    fi
    
    print_status "Testing API health endpoint..."
    if curl -s -f "${VITE_APIGATEWAY_URL}/health" > /dev/null 2>&1; then
        print_success "QA API health check passed"
    else
        print_warning "QA API health check failed - this is expected if health endpoint doesn't exist"
    fi
    
    print_status "Testing books endpoint..."
    BOOKS_RESPONSE=$(curl -s "${VITE_APIGATEWAY_URL}/api/books" || echo "FAILED")
    if [ "$BOOKS_RESPONSE" != "FAILED" ]; then
        print_success "QA books endpoint is accessible"
        echo "Response preview: $(echo "$BOOKS_RESPONSE" | head -c 200)..."
    else
        print_warning "QA books endpoint failed - may need authentication or CORS setup"
    fi
}

# Seed QA data
seed_qa_data() {
    print_status "Seeding QA environment with test data..."
    
    if [ -f "scripts/seed-qa-data.js" ]; then
        print_status "Running QA data seeding script..."
        
        # Check if we need to update the table name in the script
        if [ -f ".env.qa.temp" ]; then
            TABLE_NAME=$(grep "TABLE_NAME" .env.qa.temp | cut -d'=' -f2 | tr -d '"' | tr -d "'")
            if [ -n "$TABLE_NAME" ]; then
                print_status "Using table name from environment: $TABLE_NAME"
                # Update the script with the correct table name
                sed -i.bak "s/tableName: 'ebook-platform-data'/tableName: '$TABLE_NAME'/" scripts/seed-qa-data.js
            fi
        fi
        
        if node scripts/seed-qa-data.js; then
            print_success "QA data seeding completed"
        else
            print_error "QA data seeding failed"
            return 1
        fi
    else
        print_error "QA data seeding script not found"
        return 1
    fi
}

# Verify QA deployment
verify_qa_deployment() {
    print_status "Verifying QA Lambda deployment..."
    
    # List Lambda functions that might be related to our project
    print_status "Checking for deployed Lambda functions..."
    
    LAMBDA_FUNCTIONS=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `ebook`) || contains(FunctionName, `auth`) || contains(FunctionName, `book`)].FunctionName' --output text 2>/dev/null || echo "")
    
    if [ -n "$LAMBDA_FUNCTIONS" ]; then
        print_success "Found Lambda functions:"
        echo "$LAMBDA_FUNCTIONS" | tr '\t' '\n' | while read -r func; do
            if [ -n "$func" ]; then
                echo "  - $func"
            fi
        done
    else
        print_warning "No related Lambda functions found"
    fi
    
    # Check DynamoDB tables
    print_status "Checking for DynamoDB tables..."
    
    DYNAMO_TABLES=$(aws dynamodb list-tables --query 'TableNames[?contains(@, `ebook`) || contains(@, `platform`)]' --output text 2>/dev/null || echo "")
    
    if [ -n "$DYNAMO_TABLES" ]; then
        print_success "Found DynamoDB tables:"
        echo "$DYNAMO_TABLES" | tr '\t' '\n' | while read -r table; do
            if [ -n "$table" ]; then
                echo "  - $table"
                # Check table status
                STATUS=$(aws dynamodb describe-table --table-name "$table" --query 'Table.TableStatus' --output text 2>/dev/null || echo "UNKNOWN")
                echo "    Status: $STATUS"
            fi
        done
    else
        print_warning "No related DynamoDB tables found"
    fi
}

# Test authentication flow
test_qa_auth() {
    print_status "Testing QA authentication flow..."
    
    if [ -f "frontend/.env.qa" ]; then
        source frontend/.env.qa
    else
        print_error "QA environment file not found"
        return 1
    fi
    
    if [ -z "$VITE_APIGATEWAY_URL" ]; then
        print_error "VITE_APIGATEWAY_URL not set"
        return 1
    fi
    
    print_status "Testing user registration..."
    REGISTER_RESPONSE=$(curl -s -X POST "${VITE_APIGATEWAY_URL}/api/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test.user@example.com",
            "password": "testpassword123",
            "firstName": "Test",
            "lastName": "User",
            "role": "READER"
        }' 2>/dev/null || echo "FAILED")
    
    if [ "$REGISTER_RESPONSE" != "FAILED" ]; then
        print_success "Registration endpoint is accessible"
    else
        print_warning "Registration test failed - may be expected if user exists or CORS issues"
    fi
    
    print_status "Testing user login with seeded data..."
    LOGIN_RESPONSE=$(curl -s -X POST "${VITE_APIGATEWAY_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "qa.author@example.com",
            "password": "password123"
        }' 2>/dev/null || echo "FAILED")
    
    if [ "$LOGIN_RESPONSE" != "FAILED" ] && echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
        print_success "Login with seeded user successful"
    else
        print_warning "Login test failed - may need to run data seeding first"
    fi
}

# Generate QA test report
generate_test_report() {
    print_status "Generating QA environment test report..."
    
    REPORT_FILE="qa-environment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# QA Environment Test Report

Generated: $(date)

## Environment Configuration

### Frontend Environment Variables
$(cat frontend/.env.qa 2>/dev/null || echo "File not found")

### Backend Environment Variables  
$(cat .env.qa.temp 2>/dev/null || echo "File not found")

## API Endpoints Test Results

### Health Check
- Endpoint: \${VITE_APIGATEWAY_URL}/health
- Status: $(curl -s -o /dev/null -w "%{http_code}" "${VITE_APIGATEWAY_URL}/health" 2>/dev/null || echo "FAILED")

### Books Endpoint
- Endpoint: \${VITE_APIGATEWAY_URL}/api/books
- Status: $(curl -s -o /dev/null -w "%{http_code}" "${VITE_APIGATEWAY_URL}/api/books" 2>/dev/null || echo "FAILED")

### Auth Endpoint
- Endpoint: \${VITE_APIGATEWAY_URL}/api/auth/login
- Status: $(curl -s -o /dev/null -w "%{http_code}" "${VITE_APIGATEWAY_URL}/api/auth/login" 2>/dev/null || echo "FAILED")

## AWS Resources

### Lambda Functions
$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `ebook`) || contains(FunctionName, `auth`) || contains(FunctionName, `book`)].{Name:FunctionName,Runtime:Runtime,LastModified:LastModified}' --output table 2>/dev/null || echo "Unable to list Lambda functions")

### DynamoDB Tables
$(aws dynamodb list-tables --query 'TableNames[?contains(@, `ebook`) || contains(@, `platform`)]' --output table 2>/dev/null || echo "Unable to list DynamoDB tables")

## Recommendations

1. **Data Seeding**: Run \`node scripts/seed-qa-data.js\` to populate test data
2. **CORS Configuration**: Ensure API Gateway allows frontend domain
3. **Authentication**: Verify JWT token generation and validation
4. **Error Handling**: Check CloudWatch logs for any errors
5. **Performance**: Monitor response times and optimize if needed

## Test Credentials

After running data seeding, use these credentials for testing:

- **Author**: qa.author@example.com / password123
- **Editor**: qa.editor@example.com / password123  
- **Publisher**: qa.publisher@example.com / password123
- **Reader**: qa.reader@example.com / password123

EOF

    print_success "Test report generated: $REPORT_FILE"
}

# Main execution
main() {
    echo "🚀 QA Environment Setup and Verification"
    echo "========================================"
    echo ""
    
    check_aws_config
    check_node
    
    echo ""
    compare_environments
    
    echo ""
    verify_qa_deployment
    
    echo ""
    test_qa_api
    
    echo ""
    print_status "Would you like to seed QA data? (y/n)"
    read -r SEED_RESPONSE
    if [ "$SEED_RESPONSE" = "y" ] || [ "$SEED_RESPONSE" = "Y" ]; then
        seed_qa_data
    fi
    
    echo ""
    test_qa_auth
    
    echo ""
    generate_test_report
    
    echo ""
    print_success "QA environment setup completed!"
    echo ""
    print_status "Next steps:"
    echo "1. Review the generated test report"
    echo "2. Test the frontend application against QA"
    echo "3. Compare user experience with local development"
    echo "4. Address any identified issues"
}

# Run main function
main "$@"