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
check_localstack() {
    if ! curl -s http://localhost:4566/_localstack/health | grep -q '"status": "running"'; then
        error "LocalStack is not running. Please start it first."
    fi
}

# Initialize Terraform
init_terraform() {
    status "Initializing Terraform..."
    cd infrastructure
    terraform init
    success "Terraform initialized!"
}

# Plan Terraform changes
plan_terraform() {
    status "Planning Terraform changes..."
    terraform plan -out=tfplan
    success "Terraform plan created!"
}

# Apply Terraform changes
apply_terraform() {
    status "Applying Terraform changes..."
    terraform apply -auto-approve
    success "Terraform changes applied!"
}

# Destroy infrastructure
destroy_terraform() {
    status "Destroying infrastructure..."
    terraform destroy -auto-approve
    success "Infrastructure destroyed!"
}

# Show infrastructure state
show_state() {
    status "Current infrastructure state:"
    terraform show
    echo ""
    status "Terraform outputs:"
    terraform output
}

# Main execution
case "$1" in
    "init")
        check_localstack
        init_terraform
        ;;
    "plan")
        check_localstack
        init_terraform
        plan_terraform
        ;;
    "apply")
        check_localstack
        init_terraform
        apply_terraform
        ;;
    "destroy")
        check_localstack
        init_terraform
        destroy_terraform
        ;;
    "show")
        check_localstack
        show_state
        ;;
    *)
        echo "Usage: $0 {init|plan|apply|destroy|show}"
        echo "  init    - Initialize Terraform"
        echo "  plan    - Plan Terraform changes"
        echo "  apply   - Apply Terraform changes"
        echo "  destroy - Destroy infrastructure"
        echo "  show    - Show current state"
        exit 1
        ;;
esac
