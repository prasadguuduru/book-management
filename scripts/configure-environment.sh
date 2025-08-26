#!/bin/bash

# Configure environment variables from Terraform outputs
# Usage: ./scripts/configure-environment.sh <environment>
# Example: ./scripts/configure-environment.sh dev

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

# Function to get Terraform output
get_terraform_output() {
    local key=$1
    local default_value=${2:-""}
    
    cd "$INFRASTRUCTURE_DIR"
    
    local value=$(terraform output -raw "$key" 2>/dev/null || echo "$default_value")
    echo "$value"
}

# Function to configure backend environment
configure_backend_env() {
    local env=$1
    
    print_status "Configuring backend environment for: $env"
    
    local backend_env_file="$PROJECT_ROOT/backend/.env.$env"
    local backend_env_template="$PROJECT_ROOT/backend/.env.$env.template"
    
    # Create template if it doesn't exist
    if [[ ! -f "$backend_env_template" ]]; then
        cp "$backend_env_file" "$backend_env_template"
    fi
    
    # Get Terraform outputs
    local table_name=$(get_terraform_output "dynamodb_table_name" "$env-ebook-platform")
    local assets_bucket=$(get_terraform_output "assets_bucket_name" "$env-ebook-assets")
    local frontend_bucket=$(get_terraform_output "frontend_bucket_name" "$env-ebook-frontend")
    local api_url=$(get_terraform_output "api_gateway_url" "")
    local notification_topic=$(get_terraform_output "sns_topic_arns" | jq -r '.user_notifications // ""' 2>/dev/null || echo "")
    local workflow_queue=$(get_terraform_output "sqs_queue_urls" | jq -r '.book_workflow // ""' 2>/dev/null || echo "")
    
    # Update environment file
    cp "$backend_env_template" "$backend_env_file"
    
    # Replace placeholders with actual values
    if [[ "$env" != "local" ]]; then
        sed -i.bak "s|TABLE_NAME=.*|TABLE_NAME=$table_name|g" "$backend_env_file"
        sed -i.bak "s|ASSETS_BUCKET=.*|ASSETS_BUCKET=$assets_bucket|g" "$backend_env_file"
        sed -i.bak "s|FRONTEND_BUCKET=.*|FRONTEND_BUCKET=$frontend_bucket|g" "$backend_env_file"
        
        if [[ -n "$notification_topic" ]]; then
            sed -i.bak "s|NOTIFICATION_TOPIC_ARN=.*|NOTIFICATION_TOPIC_ARN=$notification_topic|g" "$backend_env_file"
        fi
        
        if [[ -n "$workflow_queue" ]]; then
            sed -i.bak "s|WORKFLOW_QUEUE_URL=.*|WORKFLOW_QUEUE_URL=$workflow_queue|g" "$backend_env_file"
        fi
        
        # Remove AWS endpoint for real AWS
        sed -i.bak "/AWS_ENDPOINT_URL=/d" "$backend_env_file"
        sed -i.bak "/DYNAMODB_ENDPOINT=/d" "$backend_env_file"
        
        # Clean up backup files
        rm -f "$backend_env_file.bak"
    fi
    
    print_success "Backend environment configured: $backend_env_file"
}

# Function to configure frontend environment
configure_frontend_env() {
    local env=$1
    
    print_status "Configuring frontend environment for: $env"
    
    local frontend_env_file="$PROJECT_ROOT/frontend/.env.$env"
    local frontend_env_template="$PROJECT_ROOT/frontend/.env.$env.template"
    
    # Create template if it doesn't exist
    if [[ ! -f "$frontend_env_template" ]]; then
        cp "$frontend_env_file" "$frontend_env_template"
    fi
    
    # Get Terraform outputs
    local api_url=$(get_terraform_output "api_gateway_url" "http://localhost:3001")
    local ws_url=$(get_terraform_output "websocket_api_url" "ws://localhost:3001")
    local frontend_url=$(get_terraform_output "frontend_url" "http://localhost:3000")
    
    # Update environment file
    cp "$frontend_env_template" "$frontend_env_file"
    
    # Replace placeholders with actual values
    if [[ "$env" != "local" ]]; then
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=$api_url|g" "$frontend_env_file"
        sed -i.bak "s|VITE_WS_URL=.*|VITE_WS_URL=$ws_url|g" "$frontend_env_file"
        
        # Clean up backup files
        rm -f "$frontend_env_file.bak"
    fi
    
    print_success "Frontend environment configured: $frontend_env_file"
}

# Function to create deployment configuration
create_deployment_config() {
    local env=$1
    
    print_status "Creating deployment configuration for: $env"
    
    local config_dir="$PROJECT_ROOT/deployment-config/$env"
    mkdir -p "$config_dir"
    
    # Get all Terraform outputs
    cd "$INFRASTRUCTURE_DIR"
    local terraform_outputs=$(terraform output -json 2>/dev/null || echo "{}")
    
    # Create deployment configuration file
    cat > "$config_dir/deployment-config.json" << EOF
{
  "environment": "$env",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "terraform_outputs": $terraform_outputs,
  "deployment_urls": {
    "frontend": "$(echo "$terraform_outputs" | jq -r '.frontend_url.value // "http://localhost:3000"')",
    "api": "$(echo "$terraform_outputs" | jq -r '.api_gateway_url.value // "http://localhost:3001"')",
    "websocket": "$(echo "$terraform_outputs" | jq -r '.websocket_api_url.value // "ws://localhost:3001"')"
  },
  "aws_resources": {
    "dynamodb_table": "$(echo "$terraform_outputs" | jq -r '.dynamodb_table_name.value // ""')",
    "s3_buckets": {
      "frontend": "$(echo "$terraform_outputs" | jq -r '.frontend_bucket_name.value // ""')",
      "assets": "$(echo "$terraform_outputs" | jq -r '.assets_bucket_name.value // ""')"
    },
    "lambda_functions": $(echo "$terraform_outputs" | jq '.lambda_function_names.value // {}'),
    "cloudfront_distribution": "$(echo "$terraform_outputs" | jq -r '.cloudfront_distribution_id.value // ""')"
  }
}
EOF
    
    print_success "Deployment configuration created: $config_dir/deployment-config.json"
}

# Function to validate configuration
validate_configuration() {
    local env=$1
    
    print_status "Validating configuration for: $env"
    
    local backend_env="$PROJECT_ROOT/backend/.env.$env"
    local frontend_env="$PROJECT_ROOT/frontend/.env.$env"
    
    local validation_passed=true
    
    # Check backend environment file
    if [[ ! -f "$backend_env" ]]; then
        print_error "Backend environment file not found: $backend_env"
        validation_passed=false
    else
        # Check for required variables
        local required_backend_vars=("NODE_ENV" "TABLE_NAME" "JWT_PUBLIC_KEY" "JWT_PRIVATE_KEY" "ENCRYPTION_KEY")
        for var in "${required_backend_vars[@]}"; do
            if ! grep -q "^$var=" "$backend_env"; then
                print_error "Missing required backend variable: $var"
                validation_passed=false
            fi
        done
    fi
    
    # Check frontend environment file
    if [[ ! -f "$frontend_env" ]]; then
        print_error "Frontend environment file not found: $frontend_env"
        validation_passed=false
    else
        # Check for required variables
        local required_frontend_vars=("VITE_API_URL" "VITE_ENVIRONMENT")
        for var in "${required_frontend_vars[@]}"; do
            if ! grep -q "^$var=" "$frontend_env"; then
                print_error "Missing required frontend variable: $var"
                validation_passed=false
            fi
        done
    fi
    
    if [[ "$validation_passed" == true ]]; then
        print_success "Configuration validation passed"
        return 0
    else
        print_error "Configuration validation failed"
        return 1
    fi
}

# Function to show configuration summary
show_configuration_summary() {
    local env=$1
    
    print_status "Configuration summary for environment: $env"
    
    echo ""
    echo "Backend Configuration:"
    if [[ -f "$PROJECT_ROOT/backend/.env.$env" ]]; then
        grep -E "^(NODE_ENV|TABLE_NAME|AWS_REGION|CORS_ORIGIN)=" "$PROJECT_ROOT/backend/.env.$env" | sed 's/^/  /'
    fi
    
    echo ""
    echo "Frontend Configuration:"
    if [[ -f "$PROJECT_ROOT/frontend/.env.$env" ]]; then
        grep -E "^(VITE_API_URL|VITE_WS_URL|VITE_ENVIRONMENT)=" "$PROJECT_ROOT/frontend/.env.$env" | sed 's/^/  /'
    fi
    
    echo ""
    echo "Deployment URLs:"
    if [[ -f "$PROJECT_ROOT/deployment-config/$env/deployment-config.json" ]]; then
        jq -r '.deployment_urls | to_entries[] | "  \(.key): \(.value)"' "$PROJECT_ROOT/deployment-config/$env/deployment-config.json"
    fi
}

# Main function
main() {
    local env=${1:-}
    
    # Print banner
    echo "=================================================="
    echo "  Environment Configuration Script"
    echo "  Environment: $env"
    echo "=================================================="
    
    # Validate inputs
    if [[ -z "$env" ]]; then
        print_error "Usage: $0 <environment>"
        print_error "Environments: local, dev, qa, staging, prod"
        exit 1
    fi
    
    case $env in
        local|dev|qa|staging|prod)
            print_status "Configuring environment: $env"
            ;;
        *)
            print_error "Invalid environment '$env'. Must be one of: local, dev, qa, staging, prod"
            exit 1
            ;;
    esac
    
    # Check if Terraform state exists (except for local)
    if [[ "$env" != "local" ]]; then
        cd "$INFRASTRUCTURE_DIR"
        if ! terraform workspace list | grep -q "$env"; then
            print_warning "Terraform workspace '$env' not found. Run infrastructure deployment first."
        fi
    fi
    
    # Configure environments
    configure_backend_env "$env"
    configure_frontend_env "$env"
    create_deployment_config "$env"
    
    # Validate configuration
    if validate_configuration "$env"; then
        show_configuration_summary "$env"
        print_success "Environment configuration completed successfully!"
    else
        print_error "Environment configuration failed!"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"