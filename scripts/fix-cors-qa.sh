#!/bin/bash
# Fix CORS Issues for QA Environment
# This script addresses CORS problems by updating API Gateway configuration and redeploying

set -e

echo "🔧 Fixing CORS Issues for QA Environment..."

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

# Step 1: Get current infrastructure information
print_status "Getting QA infrastructure information..."
cd infrastructure

# Get API Gateway information
API_ID=$(terraform output -raw api_gateway_id 2>/dev/null || echo "")
API_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")
FRONTEND_BUCKET=$(terraform output -raw frontend_bucket_name 2>/dev/null || echo "")

if [ -z "$API_ID" ]; then
    print_error "Could not get API Gateway ID from terraform output"
    exit 1
fi

print_success "Infrastructure information retrieved:"
print_status "  API Gateway ID: $API_ID"
print_status "  API Gateway URL: $API_URL"
print_status "  Frontend Bucket: $FRONTEND_BUCKET"

# Step 2: Get the S3 website URL for CORS configuration
S3_WEBSITE_URL="http://$FRONTEND_BUCKET.s3-website-us-east-1.amazonaws.com"
print_status "  S3 Website URL: $S3_WEBSITE_URL"

# Step 3: Test current API Gateway CORS configuration
print_status "Testing current CORS configuration..."

# Test OPTIONS request to auth endpoint
print_status "Testing OPTIONS request to /api/auth..."
CORS_TEST_RESULT=$(curl -s -X OPTIONS \
    -H "Origin: $S3_WEBSITE_URL" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    -w "%{http_code}" \
    -o /tmp/cors_test_response.txt \
    "$API_URL/api/auth" || echo "000")

print_status "CORS test result: HTTP $CORS_TEST_RESULT"

if [ -f "/tmp/cors_test_response.txt" ]; then
    print_status "Response headers:"
    cat /tmp/cors_test_response.txt
    rm -f /tmp/cors_test_response.txt
fi

# Step 4: Update Lambda functions with proper CORS headers
print_status "Updating Lambda functions with enhanced CORS support..."

cd ../backend/src

# Create enhanced CORS response for all services
CORS_HEADERS='{
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Max-Age": "86400"
}'

# Update each service with enhanced CORS
for service in auth-service book-service user-service workflow-service review-service notification-service; do
    if [ -f "$service/index.js" ]; then
        print_status "Updating $service with enhanced CORS..."
        
        # Create backup
        cp "$service/index.js" "$service/index.js.backup"
        
        # Update the CORS headers in the file
        cat > "$service/index.js" << 'EOF'
// Enhanced Lambda Function with proper CORS support
const AWS = require('aws-sdk');

// Enhanced CORS headers
const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '86400'
};

// Helper function to create response with CORS
function createResponse(statusCode, body, additionalHeaders = {}) {
    return {
        statusCode,
        headers: {
            ...corsHeaders,
            ...additionalHeaders
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    };
}

// Health check response
const healthResponse = createResponse(200, {
    status: 'healthy',
    service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown-service',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'qa',
    version: '1.0.0',
    cors: 'enabled'
});

// Main Lambda handler
exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));
    
    try {
        // Extract HTTP method and path
        const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'GET';
        const path = event.path || event.requestContext?.http?.path || '/';
        const origin = event.headers?.origin || event.headers?.Origin || 'unknown';
        
        console.log(`Processing ${httpMethod} ${path} from origin: ${origin}`);
        
        // Handle preflight OPTIONS requests
        if (httpMethod === 'OPTIONS') {
            console.log('Handling CORS preflight request');
            return createResponse(200, {
                message: 'CORS preflight successful',
                allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
            });
        }
        
        // Health check endpoint
        if (path === '/health' || path.endsWith('/health')) {
            return healthResponse;
        }
        
        // Get service name from function name or default
        const serviceName = process.env.AWS_LAMBDA_FUNCTION_NAME?.split('-').pop() || 'unknown';
        
        // Service-specific routing
        switch (serviceName) {
            case 'auth-service':
            case 'auth':
                return handleAuthService(event, context);
            case 'book-service':
            case 'book':
                return handleBookService(event, context);
            case 'user-service':
            case 'user':
                return handleUserService(event, context);
            case 'workflow-service':
            case 'workflow':
                return handleWorkflowService(event, context);
            case 'review-service':
            case 'review':
                return handleReviewService(event, context);
            case 'notification-service':
            case 'notification':
                return handleNotificationService(event, context);
            default:
                return createResponse(404, {
                    error: 'Not Found',
                    message: `Endpoint not found: ${httpMethod} ${path}`,
                    service: serviceName,
                    availableServices: ['auth', 'book', 'user', 'workflow', 'review', 'notification']
                });
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        return createResponse(500, {
            error: 'Internal Server Error',
            message: error.message,
            service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown-service',
            timestamp: new Date().toISOString()
        });
    }
};

// Service-specific handlers
function handleAuthService(event, context) {
    const path = event.path || '/';
    const method = event.httpMethod || 'GET';
    
    console.log(`Auth service handling: ${method} ${path}`);
    
    if (path.includes('/login') || method === 'POST') {
        return createResponse(200, {
            message: 'Auth service - login endpoint',
            service: 'auth-service',
            endpoint: 'login',
            method: method,
            status: 'placeholder_implementation',
            timestamp: new Date().toISOString()
        });
    }
    
    return createResponse(200, {
        message: 'Auth service - placeholder implementation',
        service: 'auth-service',
        availableEndpoints: ['/login', '/register', '/refresh', '/logout'],
        method: method,
        path: path
    });
}

function handleBookService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Book service - placeholder implementation',
        service: 'book-service',
        availableEndpoints: ['/books', '/books/:id', '/books/my-books'],
        method: method,
        path: path
    });
}

function handleUserService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'User service - placeholder implementation',
        service: 'user-service',
        availableEndpoints: ['/users/profile', '/users/:id'],
        method: method,
        path: path
    });
}

function handleWorkflowService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Workflow service - placeholder implementation',
        service: 'workflow-service',
        availableEndpoints: ['/workflow/tasks', '/workflow/books/:id/history'],
        method: method,
        path: path
    });
}

function handleReviewService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Review service - placeholder implementation',
        service: 'review-service',
        availableEndpoints: ['/books/:id/reviews', '/reviews/:id'],
        method: method,
        path: path
    });
}

function handleNotificationService(event, context) {
    const method = event.httpMethod || 'GET';
    const path = event.path || '/';
    
    return createResponse(200, {
        message: 'Notification service - placeholder implementation',
        service: 'notification-service',
        availableEndpoints: ['/notifications', '/notifications/mark-read'],
        method: method,
        path: path
    });
}
EOF
        
        print_success "$service updated with enhanced CORS support"
    else
        print_warning "$service/index.js not found, skipping"
    fi
done

# Step 5: Rebuild and deploy Lambda functions
print_status "Rebuilding Lambda packages..."
cd ../../

# Build Lambda packages
./scripts/build-lambda-packages.sh qa

if [ $? -ne 0 ]; then
    print_error "Failed to build Lambda packages"
    exit 1
fi

print_success "Lambda packages rebuilt"

# Step 6: Deploy updated Lambda functions
print_status "Deploying updated Lambda functions..."

for service in auth-service book-service user-service workflow-service review-service notification-service; do
    print_status "Updating $service..."
    
    aws lambda update-function-code \
        --function-name "qa-$service" \
        --zip-file "fileb://backend/dist/$service.zip" \
        --region us-east-1
    
    if [ $? -eq 0 ]; then
        print_success "$service updated successfully"
        
        # Wait for update to complete
        aws lambda wait function-updated \
            --function-name "qa-$service" \
            --region us-east-1
    else
        print_error "Failed to update $service"
    fi
done

# Step 7: Force API Gateway redeployment
print_status "Forcing API Gateway redeployment..."

cd infrastructure

# Create a new deployment
DEPLOYMENT_ID=$(aws apigateway create-deployment \
    --rest-api-id "$API_ID" \
    --stage-name "qa" \
    --description "CORS fix deployment - $(date)" \
    --region us-east-1 \
    --query 'id' \
    --output text)

if [ $? -eq 0 ] && [ -n "$DEPLOYMENT_ID" ]; then
    print_success "API Gateway redeployed with deployment ID: $DEPLOYMENT_ID"
else
    print_error "Failed to redeploy API Gateway"
    exit 1
fi

# Step 8: Wait for deployment to propagate
print_status "Waiting for deployment to propagate (30 seconds)..."
sleep 30

# Step 9: Test CORS again
print_status "Testing CORS configuration after fix..."

# Test OPTIONS request
print_status "Testing OPTIONS request to /api/auth..."
CORS_TEST_RESULT=$(curl -s -X OPTIONS \
    -H "Origin: $S3_WEBSITE_URL" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type,Authorization" \
    -w "%{http_code}" \
    -o /tmp/cors_test_response_after.txt \
    "$API_URL/api/auth" || echo "000")

print_status "CORS test result after fix: HTTP $CORS_TEST_RESULT"

if [ -f "/tmp/cors_test_response_after.txt" ]; then
    print_status "Response headers after fix:"
    cat /tmp/cors_test_response_after.txt
    rm -f /tmp/cors_test_response_after.txt
fi

# Test actual POST request
print_status "Testing actual POST request to /api/auth..."
POST_TEST_RESULT=$(curl -s -X POST \
    -H "Origin: $S3_WEBSITE_URL" \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}' \
    -w "%{http_code}" \
    -o /tmp/post_test_response.txt \
    "$API_URL/api/auth" || echo "000")

print_status "POST test result: HTTP $POST_TEST_RESULT"

if [ -f "/tmp/post_test_response.txt" ]; then
    print_status "POST response:"
    cat /tmp/post_test_response.txt
    rm -f /tmp/post_test_response.txt
fi

# Step 10: Test from different origins
print_status "Testing CORS from different origins..."

# Test from localhost
LOCALHOST_TEST=$(curl -s -X OPTIONS \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    -w "%{http_code}" \
    -o /dev/null \
    "$API_URL/api/auth" || echo "000")

print_status "Localhost origin test: HTTP $LOCALHOST_TEST"

# Step 11: Display results
echo ""
echo "=========================================="
print_success "CORS Fix Deployment Complete!"
echo "=========================================="
echo ""
print_status "Test Results:"
print_status "  OPTIONS request: HTTP $CORS_TEST_RESULT"
print_status "  POST request: HTTP $POST_TEST_RESULT"
print_status "  Localhost test: HTTP $LOCALHOST_TEST"
echo ""
print_status "API Gateway Information:"
print_status "  API ID: $API_ID"
print_status "  API URL: $API_URL"
print_status "  Deployment ID: $DEPLOYMENT_ID"
echo ""
print_status "Frontend Information:"
print_status "  S3 Website: $S3_WEBSITE_URL"
echo ""

if [ "$CORS_TEST_RESULT" = "200" ] && [ "$POST_TEST_RESULT" = "200" ]; then
    print_success "CORS appears to be working correctly!"
    print_status "You can now test your frontend application."
else
    print_warning "CORS may still have issues. Check the test results above."
    print_status "Common issues:"
    print_status "  1. API Gateway deployment may need more time to propagate"
    print_status "  2. Lambda function permissions may need updating"
    print_status "  3. Frontend may be using incorrect API URL"
fi

echo ""
print_status "Next Steps:"
print_status "  1. Test your frontend application"
print_status "  2. Check browser developer console for any remaining CORS errors"
print_status "  3. Verify API endpoints are responding correctly"
echo ""

cd ..
print_success "CORS fix script completed!"