#!/bin/bash

# Comprehensive infrastructure testing script
# Usage: ./scripts/test-infrastructure.sh <environment> [test-type]
# Example: ./scripts/test-infrastructure.sh local all
# Example: ./scripts/test-infrastructure.sh dev api

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

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

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    print_status "Running test: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        print_success "✓ $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        print_error "✗ $test_name"
        FAILED_TESTS+=("$test_name")
        ((TESTS_FAILED++))
        return 1
    fi
}

# Function to get API base URL
get_api_base_url() {
    local env=$1
    
    case $env in
        local)
            # For LocalStack, we need to get the API Gateway ID
            local api_id=$(aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query 'items[0].id' --output text 2>/dev/null || echo "")
            if [[ -n "$api_id" && "$api_id" != "None" ]]; then
                echo "http://localhost:4566/restapis/$api_id/local/_user_request_"
            else
                echo "http://localhost:3001"  # Fallback to direct backend
            fi
            ;;
        *)
            # For AWS environments, get from Terraform output
            cd "$PROJECT_ROOT/infrastructure"
            terraform output -raw api_gateway_url 2>/dev/null || echo "https://api-$env.example.com"
            ;;
    esac
}

# Function to test LocalStack health
test_localstack_health() {
    local env=$1
    
    if [[ "$env" != "local" ]]; then
        return 0  # Skip for non-local environments
    fi
    
    print_status "Testing LocalStack health..."
    
    run_test "LocalStack Health Check" "curl -f -s http://localhost:4566/_localstack/health"
    run_test "LocalStack DynamoDB Service" "curl -f -s http://localhost:4566/_localstack/health | jq -e '.services.dynamodb == \"running\" or .services.dynamodb == \"available\"'"
    run_test "LocalStack S3 Service" "curl -f -s http://localhost:4566/_localstack/health | jq -e '.services.s3 == \"running\" or .services.s3 == \"available\"'"
    run_test "LocalStack Lambda Service" "curl -f -s http://localhost:4566/_localstack/health | jq -e '.services.lambda == \"running\" or .services.lambda == \"available\"'"
    run_test "LocalStack API Gateway Service" "curl -f -s http://localhost:4566/_localstack/health | jq -e '.services.apigateway == \"running\" or .services.apigateway == \"available\"'"
}

# Function to test AWS services
test_aws_services() {
    local env=$1
    
    if [[ "$env" == "local" ]]; then
        # Test LocalStack services
        run_test "DynamoDB Tables" "aws --endpoint-url=http://localhost:4566 dynamodb list-tables"
        run_test "S3 Buckets" "aws --endpoint-url=http://localhost:4566 s3 ls"
        run_test "Lambda Functions" "aws --endpoint-url=http://localhost:4566 lambda list-functions"
        run_test "API Gateway APIs" "aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis"
        run_test "SNS Topics" "aws --endpoint-url=http://localhost:4566 sns list-topics"
        run_test "SQS Queues" "aws --endpoint-url=http://localhost:4566 sqs list-queues"
    else
        # Test real AWS services
        run_test "DynamoDB Tables" "aws dynamodb list-tables"
        run_test "S3 Buckets" "aws s3 ls | grep -q ebook"
        run_test "Lambda Functions" "aws lambda list-functions --query 'Functions[?starts_with(FunctionName, \`$env-\`)]'"
        run_test "API Gateway APIs" "aws apigateway get-rest-apis --query 'items[?name==\`$env-ebook-api\`]'"
        run_test "SNS Topics" "aws sns list-topics --query 'Topics[?contains(TopicArn, \`ebook\`)]'"
        run_test "SQS Queues" "aws sqs list-queues --query 'QueueUrls[?contains(@, \`ebook\`)]'"
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    local env=$1
    local api_base=$(get_api_base_url "$env")
    
    print_status "Testing API endpoints with base URL: $api_base"
    
    # Test health endpoint
    run_test "Health Endpoint" "curl -f -s '$api_base/health'"
    
    # Test CORS preflight
    run_test "CORS Preflight" "curl -f -s -X OPTIONS '$api_base/health' -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: GET'"
    
    # Test authentication endpoints (should return proper error responses)
    run_test "Auth Login Endpoint" "curl -f -s -X POST '$api_base/auth/login' -H 'Content-Type: application/json' -d '{}' | jq -e '.error'"
    run_test "Auth Register Endpoint" "curl -f -s -X POST '$api_base/auth/register' -H 'Content-Type: application/json' -d '{}' | jq -e '.error'"
    
    # Test protected endpoints (should return 401)
    local books_response=$(curl -s -w "%{http_code}" -X GET "$api_base/books" -o /dev/null)
    if [[ "$books_response" == "401" ]]; then
        print_success "✓ Books Endpoint (Protected)"
        ((TESTS_PASSED++))
    else
        print_error "✗ Books Endpoint (Expected 401, got $books_response)"
        FAILED_TESTS+=("Books Endpoint (Protected)")
        ((TESTS_FAILED++))
    fi
}

# Function to test complete authentication flow
test_auth_flow() {
    local env=$1
    local api_base=$(get_api_base_url "$env")
    
    print_status "Testing complete authentication flow..."
    
    # Generate unique test user
    local test_email="test-$(date +%s)@example.com"
    local test_password="TestPassword123!"
    
    # Register user
    local register_response=$(curl -s -X POST "$api_base/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$test_email\",
            \"password\": \"$test_password\",
            \"firstName\": \"Test\",
            \"lastName\": \"User\",
            \"role\": \"AUTHOR\"
        }")
    
    if echo "$register_response" | jq -e '.accessToken' >/dev/null 2>&1; then
        print_success "✓ User Registration"
        ((TESTS_PASSED++))
        
        local access_token=$(echo "$register_response" | jq -r '.accessToken')
        local refresh_token=$(echo "$register_response" | jq -r '.refreshToken')
        
        # Test authenticated request
        if curl -f -s -X GET "$api_base/users/profile" \
            -H "Authorization: Bearer $access_token" >/dev/null 2>&1; then
            print_success "✓ Authenticated Request"
            ((TESTS_PASSED++))
        else
            print_error "✗ Authenticated Request"
            FAILED_TESTS+=("Authenticated Request")
            ((TESTS_FAILED++))
        fi
        
        # Test token refresh
        local refresh_response=$(curl -s -X POST "$api_base/auth/refresh" \
            -H "Content-Type: application/json" \
            -d "{\"refreshToken\": \"$refresh_token\"}")
        
        if echo "$refresh_response" | jq -e '.accessToken' >/dev/null 2>&1; then
            print_success "✓ Token Refresh"
            ((TESTS_PASSED++))
        else
            print_error "✗ Token Refresh"
            FAILED_TESTS+=("Token Refresh")
            ((TESTS_FAILED++))
        fi
        
        # Test login with created user
        local login_response=$(curl -s -X POST "$api_base/auth/login" \
            -H "Content-Type: application/json" \
            -d "{
                \"email\": \"$test_email\",
                \"password\": \"$test_password\"
            }")
        
        if echo "$login_response" | jq -e '.accessToken' >/dev/null 2>&1; then
            print_success "✓ User Login"
            ((TESTS_PASSED++))
        else
            print_error "✗ User Login"
            FAILED_TESTS+=("User Login")
            ((TESTS_FAILED++))
        fi
        
    else
        print_error "✗ User Registration"
        FAILED_TESTS+=("User Registration")
        ((TESTS_FAILED++))
    fi
}

# Function to test database connectivity
test_database() {
    local env=$1
    
    print_status "Testing database connectivity..."
    
    if [[ "$env" == "local" ]]; then
        # Test LocalStack DynamoDB
        local table_name="local-ebook-platform"
        run_test "DynamoDB Table Exists" "aws --endpoint-url=http://localhost:4566 dynamodb describe-table --table-name '$table_name'"
        run_test "DynamoDB Scan Test" "aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name '$table_name' --limit 1"
    else
        # Test real DynamoDB
        local table_name="$env-ebook-platform"
        run_test "DynamoDB Table Exists" "aws dynamodb describe-table --table-name '$table_name'"
        run_test "DynamoDB Scan Test" "aws dynamodb scan --table-name '$table_name' --limit 1"
    fi
}

# Function to test storage
test_storage() {
    local env=$1
    
    print_status "Testing storage services..."
    
    if [[ "$env" == "local" ]]; then
        # Test LocalStack S3
        run_test "S3 Frontend Bucket" "aws --endpoint-url=http://localhost:4566 s3 ls s3://local-ebook-frontend"
        run_test "S3 Assets Bucket" "aws --endpoint-url=http://localhost:4566 s3 ls s3://local-ebook-assets"
    else
        # Test real S3
        local frontend_bucket="$env-ebook-frontend"
        local assets_bucket="$env-ebook-assets"
        run_test "S3 Frontend Bucket" "aws s3 ls s3://$frontend_bucket"
        run_test "S3 Assets Bucket" "aws s3 ls s3://$assets_bucket"
    fi
}

# Function to test messaging
test_messaging() {
    local env=$1
    
    print_status "Testing messaging services..."
    
    if [[ "$env" == "local" ]]; then
        # Test LocalStack SNS/SQS
        run_test "SNS Topics List" "aws --endpoint-url=http://localhost:4566 sns list-topics"
        run_test "SQS Queues List" "aws --endpoint-url=http://localhost:4566 sqs list-queues"
    else
        # Test real SNS/SQS
        run_test "SNS Topics List" "aws sns list-topics"
        run_test "SQS Queues List" "aws sqs list-queues"
    fi
}

# Function to test performance
test_performance() {
    local env=$1
    local api_base=$(get_api_base_url "$env")
    
    print_status "Testing API performance..."
    
    # Test response times
    local start_time=$(date +%s%N)
    curl -f -s "$api_base/health" >/dev/null
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
    
    if [[ $duration -lt 5000 ]]; then  # Less than 5 seconds
        print_success "✓ API Response Time (${duration}ms)"
        ((TESTS_PASSED++))
    else
        print_error "✗ API Response Time (${duration}ms - too slow)"
        FAILED_TESTS+=("API Response Time")
        ((TESTS_FAILED++))
    fi
    
    # Test concurrent requests
    print_status "Testing concurrent requests..."
    local concurrent_success=0
    local pids=()
    
    # Start concurrent requests
    for i in {1..5}; do
        curl -f -s "$api_base/health" >/dev/null 2>&1 &
        pids+=($!)
    done
    
    # Wait for all requests and count successes
    for pid in "${pids[@]}"; do
        if wait "$pid"; then
            ((concurrent_success++))
        fi
    done
    
    if [[ $concurrent_success -eq 5 ]]; then
        print_success "✓ Concurrent Requests (5/5)"
        ((TESTS_PASSED++))
    else
        print_error "✗ Concurrent Requests ($concurrent_success/5)"
        FAILED_TESTS+=("Concurrent Requests")
        ((TESTS_FAILED++))
    fi
}

# Function to generate test report
generate_test_report() {
    local env=$1
    
    echo ""
    echo "=================================================="
    echo "  Test Report for Environment: $env"
    echo "=================================================="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
    
    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo ""
        echo "Failed Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  ✗ $test"
        done
        echo ""
        print_error "Some tests failed. Please check the infrastructure and try again."
        return 1
    else
        echo ""
        print_success "All tests passed! Infrastructure is working correctly."
        return 0
    fi
}

# Main function
main() {
    local env=${1:-local}
    local test_type=${2:-all}
    
    # Print banner
    echo "=================================================="
    echo "  Infrastructure Testing Script"
    echo "  Environment: $env"
    echo "  Test Type: $test_type"
    echo "=================================================="
    
    # Validate environment
    case $env in
        local|dev|qa|staging|prod)
            print_status "Testing environment: $env"
            ;;
        *)
            print_error "Invalid environment '$env'. Must be one of: local, dev, qa, staging, prod"
            exit 1
            ;;
    esac
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is required but not installed"
        exit 1
    fi
    
    # Run tests based on type
    case $test_type in
        all)
            test_localstack_health "$env"
            test_aws_services "$env"
            test_database "$env"
            test_storage "$env"
            test_messaging "$env"
            test_api_endpoints "$env"
            test_auth_flow "$env"
            test_performance "$env"
            ;;
        health)
            test_localstack_health "$env"
            ;;
        aws)
            test_aws_services "$env"
            ;;
        api)
            test_api_endpoints "$env"
            test_auth_flow "$env"
            ;;
        database)
            test_database "$env"
            ;;
        storage)
            test_storage "$env"
            ;;
        messaging)
            test_messaging "$env"
            ;;
        performance)
            test_performance "$env"
            ;;
        *)
            print_error "Invalid test type '$test_type'. Must be one of: all, health, aws, api, database, storage, messaging, performance"
            exit 1
            ;;
    esac
    
    # Generate report
    generate_test_report "$env"
}

# Run main function with all arguments
main "$@"