#!/bin/bash
# QA Frontend Deployment Script
# Handles installation, build, and deployment to S3 + CloudFront

set -e

# Set AWS CLI to non-interactive mode
export AWS_PAGER=""
export AWS_CLI_AUTO_PROMPT=off

# Calculate paths at the beginning and store them
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/deployment-artifacts/local/infrastructure"

echo "🚀 Starting QA Frontend-Only Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Step 1: Install frontend dependencies
print_status "Installing frontend dependencies..."
cd "$FRONTEND_DIR"

# Clean install to ensure fresh dependencies
if [ -d "node_modules" ]; then
    print_status "Cleaning existing node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
fi

npm install
print_success "Frontend dependencies installed"

# Step 2: Get infrastructure outputs
print_status "Getting QA infrastructure configuration..."
cd "$INFRASTRUCTURE_DIR"

# Check if terraform state exists for QA environment
if [ ! -f "terraform.tfstate.d/qa/terraform.tfstate" ]; then
    print_error "QA Terraform state not found. Please deploy QA infrastructure first."
    print_status "Expected state file: deployment-artifacts/local/infrastructure/terraform.tfstate.d/qa/terraform.tfstate"
    exit 1
fi

# Switch to QA workspace to get outputs
terraform workspace select qa 2>/dev/null || {
    print_error "QA terraform workspace not found"
    exit 1
}

# Get outputs using terraform output
QA_BUCKET=$(terraform output -raw frontend_bucket_name 2>/dev/null || echo "")
QA_API_GATEWAY_ID=$(terraform output -raw api_gateway_id 2>/dev/null || echo "")
QA_API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")

if [ -z "$QA_API_GATEWAY_ID" ]; then
    print_error "Could not get API Gateway ID from terraform output"
    exit 1
fi

print_status "Using API Gateway ID from Terraform: $QA_API_GATEWAY_ID"
# Try to get CloudFront distribution ID from terraform first, then fallback to AWS CLI
CLOUDFRONT_DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")

# If terraform doesn't have it, try to find it via AWS CLI
if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ] || [ "$CLOUDFRONT_DISTRIBUTION_ID" = "null" ]; then
    print_status "Terraform CloudFront ID not found, searching via AWS CLI..."
    CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront list-distributions \
        --query 'DistributionList.Items[?contains(Comment, `qa`) && contains(Comment, `Ebook`)].Id' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ] && [ "$CLOUDFRONT_DISTRIBUTION_ID" != "null" ]; then
        print_success "Found CloudFront distribution via AWS CLI: $CLOUDFRONT_DISTRIBUTION_ID"
    fi
fi

if [ -z "$QA_BUCKET" ]; then
    print_error "Could not get S3 bucket name from terraform output"
    exit 1
fi

if [ -z "$QA_API_URL" ]; then
    print_warning "Could not get API Gateway URL, using placeholder"
    QA_API_URL="https://api-placeholder.execute-api.us-west-2.amazonaws.com/qa"
fi

print_success "Infrastructure configuration retrieved:"
print_status "  S3 Bucket: $QA_BUCKET"
print_status "  API URL: $QA_API_URL"
print_status "  CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"

# Step 3: Get CloudFront URL for unified domain
print_status "Getting CloudFront distribution URL..."

# Get CloudFront domain name from terraform first, then fallback to AWS CLI
CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_domain_name 2>/dev/null || echo "")

# If terraform doesn't have it, get it from the distribution ID
if [ -z "$CLOUDFRONT_DOMAIN" ] || [ "$CLOUDFRONT_DOMAIN" = "null" ]; then
    if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ] && [ "$CLOUDFRONT_DISTRIBUTION_ID" != "null" ]; then
        print_status "Getting CloudFront domain from distribution ID..."
        CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
            --id "$CLOUDFRONT_DISTRIBUTION_ID" \
            --query 'Distribution.DomainName' \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "null" ]; then
            print_success "Found CloudFront domain: $CLOUDFRONT_DOMAIN"
        fi
    fi
fi

if [ -n "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "null" ]; then
    # Use CloudFront for both frontend and API
    FRONTEND_URL="https://$CLOUDFRONT_DOMAIN"
    API_URL="https://$CLOUDFRONT_DOMAIN/api"
    print_success "Using CloudFront unified domain:"
    print_status "  Frontend URL: $FRONTEND_URL"
    print_status "  API URL: $API_URL"
else
    # Fallback to direct URLs
    FRONTEND_URL="http://$QA_BUCKET.s3-website-us-east-1.amazonaws.com"
    API_URL="$QA_API_URL"
    print_warning "CloudFront domain not available, using direct URLs:"
    print_status "  Frontend URL: $FRONTEND_URL"
    print_status "  API URL: $API_URL"
fi

# Step 4: Create QA environment file
print_status "Creating QA environment configuration..."
cd "$FRONTEND_DIR"

cat > .env.qa << EOF
# QA Environment Configuration
VITE_ENVIRONMENT=qa
VITE_APIGATEWAY_URL=$API_URL
VITE_APP_NAME=Ebook Platform QA
VITE_DEBUG_MODE=true
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_REAL_TIME=true
EOF
print_status "CLOUDFRONT_DOMAIN AND API_URL###"
print_status "$CLOUDFRONT_DOMAIN"
print_status "$API_URL"

# Runtime environment will be injected directly into HTML after build

print_success "QA environment file created"
print_status "Frontend configuration:"
if [ -n "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "null" ]; then
    print_status "  Frontend will be served from: CloudFront (unified domain)"
    print_status "  API calls will go to: $API_URL"
    print_status "  This is optimal - same domain for frontend and API (no CORS issues)"
else
    print_status "  Frontend will be served from: S3 website"
    print_status "  API calls will go to: $API_URL"
    print_status "  This uses separate domains - CORS configured"
fi

# Step 5: Build frontend for QA
print_status "Building frontend for QA environment..."

# Ensure TypeScript compilation first
npx tsc --noEmit
if [ $? -ne 0 ]; then
    print_error "TypeScript compilation failed"
    exit 1
fi

# Build with npm script (includes TypeScript compilation)
npm run build:qa
if [ $? -ne 0 ]; then
    print_error "Frontend build failed"
    exit 1
fi

print_success "Frontend build completed"

# Step 6: Verify build output
if [ ! -d "dist" ]; then
    print_error "Build output directory 'dist' not found"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    print_error "index.html not found in build output"
    exit 1
fi

print_status "Build verification passed"

# Step 7: Skip Lambda provisioning - Frontend deployment only
print_status "Skipping Lambda provisioning - this script focuses on frontend deployment only"
print_status "Note: Lambda functions should be deployed separately using backend deployment scripts"

# Go to frontend directory for S3 deployment
print_status "Going to frontend directory for S3 deployment: $FRONTEND_DIR"
cd "$FRONTEND_DIR"

# Step 8: Deploy to S3
print_status "Deploying to S3 bucket: $QA_BUCKET"

# Check if bucket exists
aws s3 ls "s3://$QA_BUCKET" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    print_error "S3 bucket $QA_BUCKET does not exist or is not accessible"
    exit 1
fi

# Set AWS CLI to non-interactive mode
export AWS_PAGER=""
export AWS_CLI_AUTO_PROMPT=off

# Upload files with appropriate cache headers
print_status "Uploading static assets (with long-term caching)..."
aws s3 sync dist/ s3://$QA_BUCKET \
    --exclude "*.html" \
    --cache-control "public, max-age=31536000, immutable" \
    --delete \
    --no-cli-pager \
    --quiet

print_status "Force uploading HTML files (with short-term caching)..."
# Force upload HTML files by copying them individually
aws s3 cp dist/index.html s3://$QA_BUCKET/index.html \
    --cache-control "public, max-age=300, must-revalidate" \
    --metadata-directive REPLACE \
    --no-cli-pager \
    --quiet

# Upload any other HTML files if they exist
if ls dist/*.html 1> /dev/null 2>&1; then
    for html_file in dist/*.html; do
        filename=$(basename "$html_file")
        if [ "$filename" != "index.html" ]; then
            aws s3 cp "$html_file" s3://$QA_BUCKET/"$filename" \
                --cache-control "public, max-age=300, must-revalidate" \
                --metadata-directive REPLACE \
                --no-cli-pager \
                --quiet
        fi
    done
fi

print_success "Files uploaded to S3"

# Step 9: Skip API Gateway redeployment (no Lambda changes)
print_status "Skipping API Gateway redeployment - no Lambda changes made"

print_status "API Gateway redeployment skipped - use backend deployment scripts to update Lambda functions"

# Step 10: Invalidate CloudFront cache (if distribution exists)
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ] && [ "$CLOUDFRONT_DISTRIBUTION_ID" != "null" ]; then
    print_status "Invalidating CloudFront cache..."
    
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    if [ $? -eq 0 ]; then
        print_success "CloudFront invalidation created: $INVALIDATION_ID"
        print_status "Waiting for invalidation to complete..."
        
        aws cloudfront wait invalidation-completed \
            --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
            --id $INVALIDATION_ID
        
        print_success "CloudFront cache invalidated"
    else
        print_warning "CloudFront invalidation failed, but deployment continues"
    fi
else
    print_warning "CloudFront distribution ID not found, skipping cache invalidation"
fi

# Step 11: Test API endpoints after deployment
print_status "Testing API endpoints..."

# Determine which API URL to test
TEST_API_URL="$API_URL"
TEST_ORIGIN="$PRIMARY_CORS_ORIGIN"

print_status "Testing with:"
print_status "  API URL: $TEST_API_URL"
print_status "  Origin: $TEST_ORIGIN"

# Test CORS preflight
print_status "Testing CORS preflight request..."
CORS_TEST=$(curl -s -X OPTIONS \
    -H "Origin: $TEST_ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    -w "%{http_code}" \
    -o /tmp/cors_preflight_response.txt \
    "$TEST_API_URL/auth" 2>/dev/null || echo "000")

print_status "CORS preflight test: HTTP $CORS_TEST"

if [ -f "/tmp/cors_preflight_response.txt" ]; then
    print_status "CORS Preflight Response:"
    cat /tmp/cors_preflight_response.txt
    echo ""
    rm -f /tmp/cors_preflight_response.txt
fi

# Test actual API call
print_status "Testing API endpoint..."
API_TEST=$(curl -s -X POST \
    -H "Origin: $TEST_ORIGIN" \
    -H "Content-Type: application/json" \
    -d '{"test": "cors"}' \
    -w "%{http_code}" \
    -o /tmp/api_test_response.txt \
    "$TEST_API_URL/auth" 2>/dev/null || echo "000")

print_status "API endpoint test: HTTP $API_TEST"

if [ -f "/tmp/api_test_response.txt" ]; then
    print_status "API Response:"
    cat /tmp/api_test_response.txt
    echo ""
    rm -f /tmp/api_test_response.txt
fi

# Test CORS headers in response
print_status "Testing CORS headers in response..."
CORS_HEADERS_TEST=$(curl -s -I -X POST \
    -H "Origin: $TEST_ORIGIN" \
    -H "Content-Type: application/json" \
    "$TEST_API_URL/auth" 2>/dev/null | grep -i "access-control" || echo "No CORS headers found")

print_status "CORS Headers in Response:"
echo "$CORS_HEADERS_TEST"

# If CloudFront is available, also test the direct API Gateway URL for comparison
if [ -n "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "null" ]; then
    print_status "Testing direct API Gateway URL for comparison..."
    DIRECT_API_TEST=$(curl -s -X POST \
        -H "Origin: $TEST_ORIGIN" \
        -H "Content-Type: application/json" \
        -d '{"test": "direct"}' \
        -w "%{http_code}" \
        -o /tmp/direct_api_test.txt \
        "$QA_API_URL/api/auth" 2>/dev/null || echo "000")
    
    print_status "Direct API Gateway test: HTTP $DIRECT_API_TEST"
    
    if [ -f "/tmp/direct_api_test.txt" ]; then
        print_status "Direct API Response:"
        cat /tmp/direct_api_test.txt
        echo ""
        rm -f /tmp/direct_api_test.txt
    fi
fi

# Step 12: Get deployment URLs
print_status "Getting deployment URLs..."

# S3 website URL (fallback)
S3_FALLBACK_URL="http://$QA_BUCKET.s3-website-us-east-1.amazonaws.com"

# CloudFront URL (primary)
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ] && [ "$CLOUDFRONT_DISTRIBUTION_ID" != "null" ]; then
    CLOUDFRONT_URL=$(aws cloudfront get-distribution \
        --id $CLOUDFRONT_DISTRIBUTION_ID \
        --query 'Distribution.DomainName' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$CLOUDFRONT_URL" ]; then
        CLOUDFRONT_URL="https://$CLOUDFRONT_URL"
    fi
fi

# Step 13: Verify deployment
print_status "Verifying deployment..."

# Test CloudFront endpoint (primary)
if [ -n "$CLOUDFRONT_URL" ]; then
    print_status "Testing CloudFront frontend endpoint..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL" || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "CloudFront frontend endpoint is accessible"
    else
        print_warning "CloudFront frontend endpoint returned status: $HTTP_STATUS (may need time to propagate)"
    fi
    
    # Test CloudFront API endpoint
    print_status "Testing CloudFront API endpoint..."
    API_HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/api/auth" || echo "000")
    if [ "$API_HTTP_STATUS" = "200" ]; then
        print_success "CloudFront API endpoint is accessible"
    else
        print_warning "CloudFront API endpoint returned status: $API_HTTP_STATUS"
    fi
fi

# Test S3 website endpoint (fallback)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$S3_FALLBACK_URL" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    print_success "S3 website endpoint is accessible (fallback)"
else
    print_warning "S3 website endpoint returned status: $HTTP_STATUS"
fi

# Step 14: Display results
echo ""
echo "=========================================="
print_success "QA Frontend-Only Deployment Complete!"
echo "=========================================="
echo ""
print_status "Deployment Details:"
print_status "  Environment: QA (Frontend Only)"
print_status "  S3 Bucket: $QA_BUCKET"
print_status "  CloudFront Distribution: ${CLOUDFRONT_DISTRIBUTION_ID:-'Not available'}"
print_status "  Lambda Functions: Not updated (use backend deployment scripts)"
echo ""
print_status "Access URLs:"
if [ -n "$CLOUDFRONT_URL" ]; then
    print_success "  🌟 CloudFront (Unified Domain): $CLOUDFRONT_URL"
    print_status "     - Frontend: $CLOUDFRONT_URL"
    print_status "     - API: $CLOUDFRONT_URL/api"
    print_status "  📦 S3 Website (Fallback): $S3_FALLBACK_URL"
else
    print_status "  📦 S3 Website: $S3_FALLBACK_URL"
    print_status "  🔗 Direct API: $QA_API_URL"
fi
echo ""
print_status "API Test Results:"
print_status "  CORS Preflight: HTTP $CORS_TEST"
print_status "  API Endpoint: HTTP $API_TEST"
if [ -n "$DIRECT_API_TEST" ]; then
    print_status "  Direct API Gateway: HTTP $DIRECT_API_TEST"
fi
echo ""
if [ "$CORS_TEST" = "200" ] && [ "$API_TEST" = "200" ]; then
    print_success "🎉 CORS appears to be working correctly!"
    if [ -n "$CLOUDFRONT_URL" ]; then
        print_success "✨ Using unified CloudFront domain - no CORS issues expected!"
    fi
elif [ "$CORS_TEST" = "200" ]; then
    print_warning "CORS preflight works, but API endpoint may have issues"
else
    print_warning "CORS issues detected. Check Lambda function logs."
fi
echo ""
print_status "Environment Configuration:"
print_status "  NODE_ENV: qa"
print_status "  TABLE_NAME: ${TABLE_NAME:-qa-ebook-platform}"
print_status "  Primary CORS Origin: $PRIMARY_CORS_ORIGIN"
print_status "  All CORS Origins: $ALL_CORS_ORIGINS"
echo ""
if [ -n "$CLOUDFRONT_URL" ]; then
    print_success "🚀 Recommended: Use CloudFront URL for best performance and unified domain!"
    print_status "Benefits of CloudFront:"
    print_status "  ✅ No CORS issues (same domain for frontend and API)"
    print_status "  ✅ Better performance with global CDN"
    print_status "  ✅ HTTPS by default"
    print_status "  ✅ Caching for static assets"
fi
echo ""
print_status "Next Steps:"
print_status "  1. Test the frontend at: ${CLOUDFRONT_URL:-$S3_FALLBACK_URL}"
print_status "  2. Deploy Lambda functions separately if needed (use backend deployment scripts)"
print_status "  3. Verify API connectivity after Lambda deployment"
print_status "  4. Check browser console for any errors"
print_status "  5. Monitor CloudFront logs if needed"
echo ""

# Return to project root
cd "$PROJECT_ROOT"

print_success "Deployment script completed successfully!"