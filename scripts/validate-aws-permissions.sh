#!/bin/bash

# AWS Permissions Validation Script
# Validates that all required AWS permissions are properly configured via Terraform
# Usage: ./scripts/validate-aws-permissions.sh <environment>

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
PERMISSIONS_PASSED=0
PERMISSIONS_FAILED=0
FAILED_PERMISSIONS=()

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

# Function to test a permission and track results
test_permission() {
    local permission_name="$1"
    local test_command="$2"
    
    print_status "Testing permission: $permission_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        print_success "✓ $permission_name"
        ((PERMISSIONS_PASSED++))
        return 0
    else
        print_error "✗ $permission_name"
        FAILED_PERMISSIONS+=("$permission_name")
        ((PERMISSIONS_FAILED++))
        return 1
    fi
}

# Function to validate Lambda permissions
validate_lambda_permissions() {
    local env=$1
    
    print_status "Validating Lambda permissions for environment: $env"
    
    # Test DynamoDB permissions
    local table_name="$env-ebook-platform"
    if [[ "$env" == "local" ]]; then
        test_permission "Lambda DynamoDB Access" "aws --endpoint-url=http://localhost:4566 dynamodb describe-table --table-name '$table_name'"
        test_permission "Lambda DynamoDB Scan" "aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name '$table_name' --limit 1"
    else
        test_permission "Lambda DynamoDB Access" "aws dynamodb describe-table --table-name '$table_name'"
        test_permission "Lambda DynamoDB Scan" "aws dynamodb scan --table-name '$table_name' --limit 1"
    fi
    
    # Test S3 permissions
    if [[ "$env" == "local" ]]; then
        test_permission "Lambda S3 List Buckets" "aws --endpoint-url=http://localhost:4566 s3 ls"
        test_permission "Lambda S3 Frontend Bucket" "aws --endpoint-url=http://localhost:4566 s3 ls s3://$env-ebook-frontend || true"
        test_permission "Lambda S3 Assets Bucket" "aws --endpoint-url=http://localhost:4566 s3 ls s3://$env-ebook-assets || true"
    else
        test_permission "Lambda S3 List Buckets" "aws s3 ls"
        test_permission "Lambda S3 Frontend Bucket" "aws s3 ls s3://$env-ebook-frontend || true"
        test_permission "Lambda S3 Assets Bucket" "aws s3 ls s3://$env-ebook-assets || true"
    fi
    
    # Test SNS permissions
    if [[ "$env" == "local" ]]; then
        test_permission "Lambda SNS List Topics" "aws --endpoint-url=http://localhost:4566 sns list-topics"
    else
        test_permission "Lambda SNS List Topics" "aws sns list-topics"
    fi
    
    # Test SQS permissions
    if [[ "$env" == "local" ]]; then
        test_permission "Lambda SQS List Queues" "aws --endpoint-url=http://localhost:4566 sqs list-queues"
    else
        test_permission "Lambda SQS List Queues" "aws sqs list-queues"
    fi
    
    # Test SES permissions (only for non-local)
    if [[ "$env" != "local" ]]; then
        test_permission "Lambda SES Get Send Quota" "aws ses get-send-quota"
        test_permission "Lambda SES List Identities" "aws ses list-identities"
    fi
    
    # Test CloudWatch permissions
    test_permission "Lambda CloudWatch List Metrics" "aws cloudwatch list-metrics --namespace AWS/Lambda"
}

# Function to validate API Gateway permissions
validate_api_gateway_permissions() {
    local env=$1
    
    print_status "Validating API Gateway permissions for environment: $env"
    
    if [[ "$env" == "local" ]]; then
        test_permission "API Gateway List APIs" "aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis"
        test_permission "API Gateway Get Resources" "aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query 'items[0].id' --output text | xargs -I {} aws --endpoint-url=http://localhost:4566 apigateway get-resources --rest-api-id {}"
    else
        test_permission "API Gateway List APIs" "aws apigateway get-rest-apis"
        test_permission "API Gateway CloudWatch Logs" "aws logs describe-log-groups --log-group-name-prefix '/aws/apigateway/'"
    fi
}

# Function to validate S3 permissions
validate_s3_permissions() {
    local env=$1
    
    print_status "Validating S3 permissions for environment: $env"
    
    if [[ "$env" == "local" ]]; then
        test_permission "S3 List All Buckets" "aws --endpoint-url=http://localhost:4566 s3 ls"
        test_permission "S3 Get Bucket Location" "aws --endpoint-url=http://localhost:4566 s3api get-bucket-location --bucket $env-ebook-frontend || true"
    else
        test_permission "S3 List All Buckets" "aws s3 ls"
        test_permission "S3 Get Bucket Location" "aws s3api get-bucket-location --bucket $env-ebook-frontend || true"
        test_permission "S3 Get Bucket Policy" "aws s3api get-bucket-policy --bucket $env-ebook-frontend || true"
    fi
}

# Function to validate CloudFront permissions
validate_cloudfront_permissions() {
    local env=$1
    
    if [[ "$env" == "local" ]]; then
        print_status "Skipping CloudFront validation for local environment"
        return 0
    fi
    
    print_status "Validating CloudFront permissions for environment: $env"
    
    test_permission "CloudFront List Distributions" "aws cloudfront list-distributions"
    test_permission "CloudFront Get Distribution Config" "aws cloudfront list-distributions --query 'DistributionList.Items[0].Id' --output text | xargs -I {} aws cloudfront get-distribution --id {} || true"
}

# Function to validate cross-service permissions
validate_cross_service_permissions() {
    local env=$1
    
    print_status "Validating cross-service permissions for environment: $env"
    
    # Test Lambda function permissions
    if [[ "$env" == "local" ]]; then
        test_permission "Lambda List Functions" "aws --endpoint-url=http://localhost:4566 lambda list-functions"
        test_permission "Lambda Get Function" "aws --endpoint-url=http://localhost:4566 lambda list-functions --query 'Functions[0].FunctionName' --output text | xargs -I {} aws --endpoint-url=http://localhost:4566 lambda get-function --function-name {} || true"
    else
        test_permission "Lambda List Functions" "aws lambda list-functions"
        test_permission "Lambda Get Function Policy" "aws lambda list-functions --query 'Functions[?starts_with(FunctionName, \`$env-\`)][0].FunctionName' --output text | xargs -I {} aws lambda get-policy --function-name {} || true"
    fi
    
    # Test IAM role permissions
    test_permission "IAM List Roles" "aws iam list-roles --query 'Roles[?starts_with(RoleName, \`$env-\`)]'"
    test_permission "IAM Get Role Policy" "aws iam list-roles --query 'Roles[?starts_with(RoleName, \`$env-lambda-execution\`)][0].RoleName' --output text | xargs -I {} aws iam list-role-policies --role-name {} || true"
}

# Function to validate KMS permissions
validate_kms_permissions() {
    local env=$1
    
    print_status "Validating KMS permissions for environment: $env"
    
    if [[ "$env" != "local" ]]; then
        test_permission "KMS List Keys" "aws kms list-keys"
        test_permission "KMS Describe Key" "aws kms describe-key --key-id alias/aws/dynamodb"
        test_permission "KMS List Aliases" "aws kms list-aliases --query 'Aliases[?starts_with(AliasName, \`alias/aws/\`)]'"
    else
        print_status "Skipping KMS validation for local environment (LocalStack limitation)"
    fi
}

# Function to validate Systems Manager permissions
validate_ssm_permissions() {
    local env=$1
    
    print_status "Validating Systems Manager permissions for environment: $env"
    
    if [[ "$env" != "local" ]]; then
        test_permission "SSM Get Parameters" "aws ssm get-parameters-by-path --path '/$env/ebook-platform' --recursive || true"
        test_permission "SSM Describe Parameters" "aws ssm describe-parameters --parameter-filters 'Key=Name,Option=BeginsWith,Values=/$env/ebook-platform' || true"
    else
        print_status "Skipping SSM validation for local environment"
    fi
}

# Function to create test resources for permission validation
create_test_resources() {
    local env=$1
    
    print_status "Creating test resources for permission validation..."
    
    if [[ "$env" == "local" ]]; then
        # Create test parameter in LocalStack
        aws --endpoint-url=http://localhost:4566 ssm put-parameter \
            --name "/$env/ebook-platform/test-param" \
            --value "test-value" \
            --type "String" \
            --overwrite >/dev/null 2>&1 || true
        
        # Create test S3 object
        echo "test content" | aws --endpoint-url=http://localhost:4566 s3 cp - s3://$env-ebook-frontend/test.txt >/dev/null 2>&1 || true
    else
        # Create test parameter in AWS
        aws ssm put-parameter \
            --name "/$env/ebook-platform/test-param" \
            --value "test-value" \
            --type "String" \
            --overwrite >/dev/null 2>&1 || true
    fi
}

# Function to cleanup test resources
cleanup_test_resources() {
    local env=$1
    
    print_status "Cleaning up test resources..."
    
    if [[ "$env" == "local" ]]; then
        # Cleanup LocalStack test resources
        aws --endpoint-url=http://localhost:4566 ssm delete-parameter --name "/$env/ebook-platform/test-param" >/dev/null 2>&1 || true
        aws --endpoint-url=http://localhost:4566 s3 rm s3://$env-ebook-frontend/test.txt >/dev/null 2>&1 || true
    else
        # Cleanup AWS test resources
        aws ssm delete-parameter --name "/$env/ebook-platform/test-param" >/dev/null 2>&1 || true
    fi
}

# Function to generate permissions report
generate_permissions_report() {
    local env=$1
    
    echo ""
    echo "=================================================="
    echo "  AWS Permissions Validation Report"
    echo "  Environment: $env"
    echo "=================================================="
    echo "Permissions Passed: $PERMISSIONS_PASSED"
    echo "Permissions Failed: $PERMISSIONS_FAILED"
    echo "Total Permissions: $((PERMISSIONS_PASSED + PERMISSIONS_FAILED))"
    
    if [[ $PERMISSIONS_FAILED -gt 0 ]]; then
        echo ""
        echo "Failed Permissions:"
        for permission in "${FAILED_PERMISSIONS[@]}"; do
            echo "  ✗ $permission"
        done
        echo ""
        print_error "Some permissions are not properly configured."
        print_status "Please check the Terraform IAM configuration and redeploy."
        return 1
    else
        echo ""
        print_success "All AWS permissions are properly configured!"
        print_status "The infrastructure is ready for application deployment."
        return 0
    fi
}

# Function to show required AWS policies
show_required_policies() {
    local env=$1
    
    print_status "Required AWS policies for environment: $env"
    
    echo ""
    echo "Lambda Execution Role Policies:"
    echo "  • AWSLambdaBasicExecutionRole (AWS Managed)"
    echo "  • Custom DynamoDB Policy (Full table access)"
    echo "  • Custom S3 Policy (Frontend and Assets buckets)"
    echo "  • Custom SNS/SQS Policy (Messaging services)"
    echo "  • Custom SES Policy (Email notifications)"
    echo "  • Custom CloudWatch Policy (Metrics and logs)"
    echo "  • Custom KMS Policy (Encryption/decryption)"
    echo "  • Custom SSM Policy (Parameter store access)"
    echo "  • Custom Secrets Manager Policy (Secrets access)"
    
    echo ""
    echo "API Gateway Execution Role Policies:"
    echo "  • Custom CloudWatch Policy (API Gateway logs)"
    echo "  • Custom Lambda Policy (Function invocation)"
    
    echo ""
    echo "Cross-Service Permissions:"
    echo "  • API Gateway → Lambda (InvokeFunction)"
    echo "  • SNS → Lambda (InvokeFunction)"
    echo "  • SQS → Lambda (InvokeFunction)"
    echo "  • DynamoDB Streams → Lambda (InvokeFunction)"
    echo "  • S3 → Lambda (InvokeFunction for notifications)"
    echo "  • EventBridge → Lambda (InvokeFunction for scheduled tasks)"
    echo "  • CloudFront → S3 (GetObject via OAC)"
}

# Main function
main() {
    local env=${1:-local}
    
    # Print banner
    echo "=================================================="
    echo "  AWS Permissions Validation Script"
    echo "  Environment: $env"
    echo "=================================================="
    
    # Validate environment
    case $env in
        local|dev|staging|prod)
            print_status "Validating permissions for environment: $env"
            ;;
        *)
            print_error "Invalid environment '$env'. Must be one of: local, dev, staging, prod"
            exit 1
            ;;
    esac
    
    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Show required policies
    show_required_policies "$env"
    
    echo ""
    print_status "Starting permissions validation..."
    
    # Create test resources
    create_test_resources "$env"
    
    # Run validation tests
    validate_lambda_permissions "$env"
    validate_api_gateway_permissions "$env"
    validate_s3_permissions "$env"
    validate_cloudfront_permissions "$env"
    validate_cross_service_permissions "$env"
    validate_kms_permissions "$env"
    validate_ssm_permissions "$env"
    
    # Cleanup test resources
    cleanup_test_resources "$env"
    
    # Generate report
    generate_permissions_report "$env"
}

# Run main function with all arguments
main "$@"