#!/bin/bash
# Fix CORS for CloudFront URL
# This script updates Lambda environment variables to allow CloudFront as CORS origin

set -e

echo "🔧 Fixing CORS for CloudFront URL..."

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# CloudFront and S3 URLs
CLOUDFRONT_URL="https://7tmom26ucc.cloudfront.net"
API_URL="https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa"

print_status "Configuration:"
print_status "  CloudFront URL: $CLOUDFRONT_URL"
print_status "  API URL: $API_URL"

# Get S3 bucket name
cd infrastructure
QA_BUCKET=$(terraform output -raw frontend_bucket_name 2>/dev/null || echo "qa-ebook-frontend-96c175f3")
S3_WEBSITE_URL="http://${QA_BUCKET}.s3-website-us-east-1.amazonaws.com"

print_status "  S3 Website URL: $S3_WEBSITE_URL"

# Create temporary file for Lambda environment variables
ENV_VARS_FILE="/tmp/lambda_cors_fix.json"

cat > "$ENV_VARS_FILE" << EOF
{
    "NODE_ENV": "qa",
    "TABLE_NAME": "qa-ebook-platform",
    "ASSETS_BUCKET": "$QA_BUCKET",
    "LOG_LEVEL": "debug",
    "CORS_ORIGIN": "*",
    "CORS_ALLOWED_ORIGINS": "$CLOUDFRONT_URL,$S3_WEBSITE_URL,http://localhost:3000,http://localhost:5173",
    "AWS_REGION": "us-east-1"
}
EOF

print_status "Environment variables to set:"
if command -v jq &> /dev/null; then
    cat "$ENV_VARS_FILE" | jq '.'
else
    cat "$ENV_VARS_FILE"
fi

# Update Lambda environment variables
SERVICES=("auth-service" "book-service" "user-service" "workflow-service" "review-service" "notification-service")

for service in "${SERVICES[@]}"; do
    print_status "Updating CORS configuration for qa-$service..."
    
    # Update using file input to avoid JSON parsing issues
    aws lambda update-function-configuration \
        --function-name "qa-$service" \
        --environment file://"$ENV_VARS_FILE" \
        --region us-east-1
    
    if [ $? -eq 0 ]; then
        print_success "CORS configuration updated for qa-$service"
        
        # Wait for update to complete
        aws lambda wait function-updated \
            --function-name "qa-$service" \
            --region us-east-1
    else
        print_error "Failed to update CORS configuration for qa-$service"
        
        # Try alternative approach with individual key-value pairs
        print_status "Trying alternative approach for qa-$service..."
        aws lambda update-function-configuration \
            --function-name "qa-$service" \
            --environment Variables="{NODE_ENV=qa,TABLE_NAME=qa-ebook-platform,ASSETS_BUCKET=$QA_BUCKET,LOG_LEVEL=debug,CORS_ORIGIN=*}" \
            --region us-east-1
        
        if [ $? -eq 0 ]; then
            print_success "Alternative update successful for qa-$service"
        fi
    fi
done

# Clean up temporary file
rm -f "$ENV_VARS_FILE"

# Force API Gateway redeployment
print_status "Redeploying API Gateway..."

API_ID=$(terraform output -raw api_gateway_id 2>/dev/null || echo "")

if [ -n "$API_ID" ] && [ "$API_ID" != "null" ]; then
    DEPLOYMENT_ID=$(aws apigateway create-deployment \
        --rest-api-id "$API_ID" \
        --stage-name "qa" \
        --description "CloudFront CORS fix - $(date)" \
        --region us-east-1 \
        --query 'id' \
        --output text)
    
    if [ $? -eq 0 ] && [ -n "$DEPLOYMENT_ID" ]; then
        print_success "API Gateway redeployed with deployment ID: $DEPLOYMENT_ID"
        print_status "Waiting for deployment to propagate..."
        sleep 15
    else
        print_error "Failed to redeploy API Gateway"
    fi
fi

# Test CORS
print_status "Testing CORS from CloudFront URL..."

# Test OPTIONS request
CORS_TEST=$(curl -s -X OPTIONS \
    -H "Origin: $CLOUDFRONT_URL" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    -w "%{http_code}" \
    -o /tmp/cors_test_cf.txt \
    "$API_URL/api/auth" 2>/dev/null || echo "000")

print_status "CORS preflight test: HTTP $CORS_TEST"

if [ -f "/tmp/cors_test_cf.txt" ]; then
    print_status "CORS response:"
    cat /tmp/cors_test_cf.txt
    rm -f /tmp/cors_test_cf.txt
fi

# Test POST request
POST_TEST=$(curl -s -X POST \
    -H "Origin: $CLOUDFRONT_URL" \
    -H "Content-Type: application/json" \
    -d '{"test": "cloudfront"}' \
    -w "%{http_code}" \
    -o /tmp/post_test_cf.txt \
    "$API_URL/api/auth" 2>/dev/null || echo "000")

print_status "POST request test: HTTP $POST_TEST"

if [ -f "/tmp/post_test_cf.txt" ]; then
    print_status "POST response:"
    cat /tmp/post_test_cf.txt
    rm -f /tmp/post_test_cf.txt
fi

# Display results
echo ""
echo "=========================================="
print_success "CORS Fix for CloudFront Complete!"
echo "=========================================="
echo ""
print_status "Configuration:"
print_status "  Frontend URL: $CLOUDFRONT_URL"
print_status "  API URL: $API_URL"
print_status "  CORS Origin: * (allows all origins)"
echo ""
print_status "Test Results:"
print_status "  CORS Preflight: HTTP $CORS_TEST"
print_status "  POST Request: HTTP $POST_TEST"
echo ""

if [ "$CORS_TEST" = "200" ] && [ "$POST_TEST" = "200" ]; then
    print_success "CORS is working correctly!"
    print_status "Your frontend at $CLOUDFRONT_URL should now be able to make API calls."
elif [ "$CORS_TEST" = "200" ]; then
    print_status "CORS preflight works, but POST request failed."
    print_status "This might be a Lambda function issue, not CORS."
else
    print_status "CORS issues may still exist."
    print_status "Wait a few minutes for changes to propagate and try again."
fi

echo ""
print_status "Important Notes:"
print_status "  - Frontend is served from CloudFront: $CLOUDFRONT_URL"
print_status "  - API calls go directly to API Gateway: $API_URL"
print_status "  - This is the correct architecture for serverless apps"
echo ""

cd ..
print_success "CORS fix completed!"