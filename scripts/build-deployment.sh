#!/bin/bash

# Build deployment packages for Ebook Publishing Platform
# Usage: ./scripts/build-deployment.sh <environment> [component]
# Example: ./scripts/build-deployment.sh dev
# Example: ./scripts/build-deployment.sh prod backend
# Example: ./scripts/build-deployment.sh local frontend

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

# Function to validate environment
validate_environment() {
    local env=$1
    
    case $env in
        local|dev|staging|prod)
            print_status "Building for environment: $env"
            ;;
        *)
            print_error "Invalid environment '$env'. Must be one of: local, dev, staging, prod"
            exit 1
            ;;
    esac
}

# Function to setup environment variables
setup_environment() {
    local env=$1
    
    print_status "Setting up environment variables for: $env"
    
    # Backend environment
    if [[ -f "$PROJECT_ROOT/backend/.env.$env" ]]; then
        print_status "Using backend environment file: .env.$env"
        cp "$PROJECT_ROOT/backend/.env.$env" "$PROJECT_ROOT/backend/.env"
    else
        print_warning "Backend environment file .env.$env not found, using defaults"
    fi
    
    # Frontend environment
    if [[ -f "$PROJECT_ROOT/frontend/.env.$env" ]]; then
        print_status "Using frontend environment file: .env.$env"
        cp "$PROJECT_ROOT/frontend/.env.$env" "$PROJECT_ROOT/frontend/.env"
    else
        print_warning "Frontend environment file .env.$env not found, using defaults"
    fi
}

# Function to build backend
build_backend() {
    local env=$1
    
    print_status "Building backend for environment: $env"
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [[ ! -d "backend/node_modules" ]]; then
        print_status "Installing backend dependencies..."
        npm install --workspace=backend
    fi
    
    # Clean previous build
    print_status "Cleaning previous backend build..."
    rm -rf backend/dist
    
    # TypeScript compilation
    print_status "Compiling TypeScript..."
    npm run build --workspace=backend
    
    # Package Lambda services
    print_status "Packaging Lambda services..."
    npm run package --workspace=backend
    
    # Verify packages
    print_status "Verifying Lambda packages..."
    local dist_dir="$PROJECT_ROOT/backend/dist"
    local services=("auth-service" "book-service" "user-service" "workflow-service" "review-service" "notification-service")
    
    for service in "${services[@]}"; do
        local zip_file="$dist_dir/$service.zip"
        if [[ -f "$zip_file" ]]; then
            local size=$(du -h "$zip_file" | cut -f1)
            print_success "✓ $service.zip ($size)"
        else
            print_error "✗ $service.zip not found"
            exit 1
        fi
    done
    
    print_success "Backend build completed successfully"
}

# Function to build frontend
build_frontend() {
    local env=$1
    
    print_status "Building frontend for environment: $env"
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [[ ! -d "frontend/node_modules" ]]; then
        print_status "Installing frontend dependencies..."
        npm install --workspace=frontend
    fi
    
    # Clean previous build
    print_status "Cleaning previous frontend build..."
    rm -rf frontend/dist
    
    # Build based on environment
    case $env in
        local)
            print_status "Building frontend for local development..."
            npm run build --workspace=frontend
            ;;
        dev)
            print_status "Building frontend for development..."
            npm run build:dev --workspace=frontend
            ;;
        staging)
            print_status "Building frontend for staging..."
            npm run build:staging --workspace=frontend
            ;;
        prod)
            print_status "Building frontend for production..."
            npm run build:prod --workspace=frontend
            ;;
    esac
    
    # Verify build
    if [[ -d "$PROJECT_ROOT/frontend/dist" ]]; then
        local size=$(du -sh "$PROJECT_ROOT/frontend/dist" | cut -f1)
        print_success "Frontend build completed successfully ($size)"
        
        # List key files
        print_status "Frontend build contents:"
        ls -la "$PROJECT_ROOT/frontend/dist/"
    else
        print_error "Frontend build failed - dist directory not found"
        exit 1
    fi
}

# Function to run tests
run_tests() {
    local env=$1
    
    print_status "Running tests for environment: $env"
    
    cd "$PROJECT_ROOT"
    
    # Backend tests
    print_status "Running backend tests..."
    npm run test --workspace=backend
    
    # Frontend tests
    print_status "Running frontend tests..."
    npm run test --workspace=frontend
    
    # Type checking
    print_status "Running type checks..."
    npm run type-check
    
    # Linting
    print_status "Running linting..."
    npm run lint
    
    print_success "All tests passed"
}

# Function to create deployment artifacts
create_deployment_artifacts() {
    local env=$1
    
    print_status "Creating deployment artifacts for environment: $env"
    
    local artifacts_dir="$PROJECT_ROOT/deployment-artifacts/$env"
    rm -rf "$artifacts_dir"
    mkdir -p "$artifacts_dir"
    
    # Copy Lambda packages
    if [[ -d "$PROJECT_ROOT/backend/dist" ]]; then
        print_status "Copying Lambda packages..."
        cp "$PROJECT_ROOT/backend/dist"/*.zip "$artifacts_dir/"
    fi
    
    # Copy frontend build
    if [[ -d "$PROJECT_ROOT/frontend/dist" ]]; then
        print_status "Creating frontend archive..."
        cd "$PROJECT_ROOT/frontend"
        tar -czf "$artifacts_dir/frontend-build.tar.gz" -C dist .
        cd "$PROJECT_ROOT"
    fi
    
    # Copy infrastructure
    print_status "Copying infrastructure configuration..."
    cp -r "$PROJECT_ROOT/infrastructure" "$artifacts_dir/"
    
    # Create deployment manifest
    cat > "$artifacts_dir/deployment-manifest.json" << EOF
{
  "environment": "$env",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "artifacts": {
    "lambda_functions": [
      "auth-service.zip",
      "book-service.zip",
      "user-service.zip",
      "workflow-service.zip",
      "review-service.zip",
      "notification-service.zip"
    ],
    "frontend": "frontend-build.tar.gz",
    "infrastructure": "infrastructure/"
  }
}
EOF
    
    print_success "Deployment artifacts created in: $artifacts_dir"
    
    # Show artifact summary
    print_status "Deployment artifact summary:"
    du -sh "$artifacts_dir"/*
}

# Function to validate build
validate_build() {
    local env=$1
    
    print_status "Validating build for environment: $env"
    
    # Check backend packages
    local backend_valid=true
    local services=("auth-service" "book-service" "user-service" "workflow-service" "review-service" "notification-service")
    
    for service in "${services[@]}"; do
        local zip_file="$PROJECT_ROOT/backend/dist/$service.zip"
        if [[ ! -f "$zip_file" ]]; then
            print_error "Missing Lambda package: $service.zip"
            backend_valid=false
        else
            # Check if ZIP is valid
            if ! unzip -t "$zip_file" >/dev/null 2>&1; then
                print_error "Invalid ZIP file: $service.zip"
                backend_valid=false
            fi
        fi
    done
    
    # Check frontend build
    local frontend_valid=true
    if [[ ! -d "$PROJECT_ROOT/frontend/dist" ]]; then
        print_error "Frontend build directory not found"
        frontend_valid=false
    elif [[ ! -f "$PROJECT_ROOT/frontend/dist/index.html" ]]; then
        print_error "Frontend index.html not found"
        frontend_valid=false
    fi
    
    if [[ "$backend_valid" == true && "$frontend_valid" == true ]]; then
        print_success "Build validation passed"
        return 0
    else
        print_error "Build validation failed"
        return 1
    fi
}

# Main function
main() {
    local env=${1:-}
    local component=${2:-all}
    
    # Print banner
    echo "=================================================="
    echo "  Ebook Publishing Platform Build Script"
    echo "  Environment: $env"
    echo "  Component: $component"
    echo "=================================================="
    
    # Validate inputs
    if [[ -z "$env" ]]; then
        print_error "Usage: $0 <environment> [component]"
        print_error "Environments: local, dev, staging, prod"
        print_error "Components: all, backend, frontend, test"
        exit 1
    fi
    
    validate_environment "$env"
    setup_environment "$env"
    
    # Build based on component
    case $component in
        all)
            build_backend "$env"
            build_frontend "$env"
            run_tests "$env"
            validate_build "$env"
            create_deployment_artifacts "$env"
            ;;
        backend)
            build_backend "$env"
            ;;
        frontend)
            build_frontend "$env"
            ;;
        test)
            run_tests "$env"
            ;;
        *)
            print_error "Invalid component '$component'. Must be one of: all, backend, frontend, test"
            exit 1
            ;;
    esac
    
    print_success "Build completed successfully for environment: $env"
}

# Run main function with all arguments
main "$@"