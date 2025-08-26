#!/bin/bash

# Infrastructure deployment script for Ebook Publishing Platform
# Usage: ./scripts/deploy-infrastructure.sh <environment> [action]
# Example: ./scripts/deploy-infrastructure.sh dev plan
# Example: ./scripts/deploy-infrastructure.sh prod apply

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
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install Terraform 1.0+ and try again."
        exit 1
    fi
    
    # Check terraform version
    TERRAFORM_VERSION=$(terraform version -json | jq -r '.terraform_version')
    print_status "Terraform version: $TERRAFORM_VERSION"
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI and configure credentials."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Please run 'aws configure' or set environment variables."
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install jq for JSON processing."
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to validate environment
validate_environment() {
    local env=$1
    
    case $env in
        local|dev|staging|prod)
            print_status "Environment '$env' is valid"
            ;;
        *)
            print_error "Invalid environment '$env'. Must be one of: local, dev, staging, prod"
            exit 1
            ;;
    esac
    
    # Check if environment configuration exists
    local tfvars_file="$INFRASTRUCTURE_DIR/environments/$env/terraform.tfvars"
    if [[ ! -f "$tfvars_file" ]]; then
        print_error "Environment configuration file not found: $tfvars_file"
        exit 1
    fi
    
    print_success "Environment configuration found: $tfvars_file"
}

# Function to setup LocalStack for local environment
setup_localstack() {
    print_status "Setting up LocalStack for local development..."
    
    cd "$PROJECT_ROOT"
    
    # Check if LocalStack is running
    if ! curl -s http://localhost:4566/health &> /dev/null; then
        print_status "Starting LocalStack..."
        npm run localstack:start
        
        # Wait for LocalStack to be ready
        print_status "Waiting for LocalStack to be ready..."
        npm run localstack:wait
    else
        print_success "LocalStack is already running"
    fi
    
    # Verify LocalStack health
    print_status "Checking LocalStack health..."
    npm run localstack:health
    
    print_success "LocalStack is ready"
}

# Function to initialize Terraform
init_terraform() {
    local env=$1
    
    print_status "Initializing Terraform for environment: $env"
    
    cd "$INFRASTRUCTURE_DIR"
    
    # Initialize Terraform
    terraform init
    
    # Create or select workspace
    if terraform workspace list | grep -q "$env"; then
        print_status "Selecting existing workspace: $env"
        terraform workspace select "$env"
    else
        print_status "Creating new workspace: $env"
        terraform workspace new "$env"
    fi
    
    print_success "Terraform initialized for environment: $env"
}

# Function to validate Terraform configuration
validate_terraform() {
    local env=$1
    
    print_status "Validating Terraform configuration..."
    
    cd "$INFRASTRUCTURE_DIR"
    
    # Validate configuration
    terraform validate
    
    # Format check
    if ! terraform fmt -check; then
        print_warning "Terraform files are not properly formatted. Running terraform fmt..."
        terraform fmt
    fi
    
    print_success "Terraform configuration is valid"
}

# Function to plan Terraform deployment
plan_terraform() {
    local env=$1
    
    print_status "Planning Terraform deployment for environment: $env"
    
    cd "$INFRASTRUCTURE_DIR"
    
    local tfvars_file="environments/$env/terraform.tfvars"
    local plan_file="terraform-$env.tfplan"
    
    # Create plan
    terraform plan \
        -var-file="$tfvars_file" \
        -out="$plan_file" \
        -detailed-exitcode
    
    local exit_code=$?
    
    case $exit_code in
        0)
            print_success "No changes needed for environment: $env"
            ;;
        1)
            print_error "Terraform plan failed"
            exit 1
            ;;
        2)
            print_success "Terraform plan completed with changes for environment: $env"
            print_status "Plan saved to: $plan_file"
            ;;
    esac
    
    return $exit_code
}

# Function to apply Terraform deployment
apply_terraform() {
    local env=$1
    
    print_status "Applying Terraform deployment for environment: $env"
    
    cd "$INFRASTRUCTURE_DIR"
    
    local plan_file="terraform-$env.tfplan"
    
    if [[ -f "$plan_file" ]]; then
        # Apply from plan file
        terraform apply "$plan_file"
    else
        # Apply directly with tfvars
        local tfvars_file="environments/$env/terraform.tfvars"
        terraform apply -var-file="$tfvars_file" -auto-approve
    fi
    
    print_success "Terraform deployment completed for environment: $env"
}

# Function to destroy Terraform deployment
destroy_terraform() {
    local env=$1
    
    print_warning "Destroying Terraform deployment for environment: $env"
    print_warning "This action cannot be undone!"
    
    read -p "Are you sure you want to destroy the $env environment? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        print_status "Destruction cancelled"
        exit 0
    fi
    
    cd "$INFRASTRUCTURE_DIR"
    
    local tfvars_file="environments/$env/terraform.tfvars"
    
    terraform destroy -var-file="$tfvars_file" -auto-approve
    
    print_success "Terraform deployment destroyed for environment: $env"
}

# Function to show Terraform outputs
show_outputs() {
    local env=$1
    
    print_status "Terraform outputs for environment: $env"
    
    cd "$INFRASTRUCTURE_DIR"
    
    terraform output -json | jq '.'
}

# Function to run post-deployment tests
run_tests() {
    local env=$1
    
    print_status "Running post-deployment tests for environment: $env"
    
    cd "$PROJECT_ROOT"
    
    case $env in
        local)
            # Test LocalStack endpoints
            npm run localstack:test
            ;;
        dev|staging|prod)
            # Test AWS endpoints
            print_status "Testing API Gateway endpoints..."
            
            # Get API Gateway URL from Terraform output
            cd "$INFRASTRUCTURE_DIR"
            local api_url=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")
            
            if [[ -n "$api_url" ]]; then
                print_status "Testing health endpoint: $api_url/health"
                if curl -f -s "$api_url/health" > /dev/null; then
                    print_success "Health endpoint is responding"
                else
                    print_warning "Health endpoint is not responding"
                fi
            else
                print_warning "Could not retrieve API Gateway URL"
            fi
            ;;
    esac
    
    print_success "Post-deployment tests completed"
}

# Main function
main() {
    local env=${1:-}
    local action=${2:-plan}
    
    # Print banner
    echo "=================================================="
    echo "  Ebook Publishing Platform Infrastructure"
    echo "  Environment: $env"
    echo "  Action: $action"
    echo "=================================================="
    
    # Validate inputs
    if [[ -z "$env" ]]; then
        print_error "Usage: $0 <environment> [action]"
        print_error "Environments: local, dev, staging, prod"
        print_error "Actions: plan, apply, destroy, output, test"
        exit 1
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Validate environment
    validate_environment "$env"
    
    # Setup LocalStack for local environment
    if [[ "$env" == "local" ]]; then
        setup_localstack
    fi
    
    # Initialize Terraform
    init_terraform "$env"
    
    # Validate Terraform configuration
    validate_terraform "$env"
    
    # Execute action
    case $action in
        plan)
            plan_terraform "$env"
            ;;
        apply)
            plan_terraform "$env"
            if [[ $? -eq 2 ]]; then  # Changes detected
                apply_terraform "$env"
                show_outputs "$env"
                run_tests "$env"
            fi
            ;;
        destroy)
            destroy_terraform "$env"
            ;;
        output)
            show_outputs "$env"
            ;;
        test)
            run_tests "$env"
            ;;
        *)
            print_error "Invalid action '$action'. Must be one of: plan, apply, destroy, output, test"
            exit 1
            ;;
    esac
    
    print_success "Infrastructure deployment script completed successfully!"
}

# Run main function with all arguments
main "$@"