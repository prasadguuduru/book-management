#!/bin/bash

# Complete Backend Lambda Deployment Script for LocalStack
# Combines all backend deployment functionality into one comprehensive script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOCALSTACK_ENDPOINT="http://localhost:4566"
ENVIRONMENT="local"
SERVICES=("auth-service" "book-service" "user-service" "workflow-service" "review-service" "notification-service")

# Default flags
SKIP_BUILD=false
SKIP_DEPLOY=false
SKIP_TEST=false
FORCE_REBUILD=false

# Banner
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                Complete Backend Deployment                   ║${NC}"
echo -e "${BLUE}║                    for LocalStack                           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print section headers
print_section() {
    echo -e "${YELLOW}▶ $1${NC}"
    echo "$(printf '─%.0s' {1..60})"
}

# Function to check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"
    
    # Check if LocalStack is running
    if ! curl -s "$LOCALSTACK_ENDPOINT/health" > /dev/null; then
        echo -e "${RED}❌ LocalStack is not running${NC}"
        echo "   Please start LocalStack first: docker-compose up -d"
        exit 1
    fi
    echo -e "${GREEN}✅ LocalStack is running${NC}"
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS CLI available${NC}"
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ jq not found (required for JSON processing)${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ jq available${NC}"
}

# Function to build minimal Lambda packages
build_lambda_packages() {
    print_section "Building Minimal Lambda Packages"
    
    # Create backend/dist directory if it doesn't exist
    mkdir -p backend/dist
    
    # Check if packages already exist and are recent
    if [ "$FORCE_REBUILD" != "true" ]; then
        ALL_EXIST=true
        for SERVICE in "${SERVICES[@]}"; do
            if [ ! -f "backend/dist/$SERVICE.zip" ]; then
                ALL_EXIST=false
                break
            fi
        done
        
        if [ "$ALL_EXIST" = "true" ]; then
            echo "📦 All Lambda packages already exist. Use --force-rebuild to recreate them."
            echo "   Use: $0 --force-rebuild"
            return 0
        fi
    fi
    
    # Package each service with minimal code
    for SERVICE in "${SERVICES[@]}"; do
        echo "📦 Creating minimal $SERVICE package..."
        echo "   🔍 Current directory: $(pwd)"
        
        # Create service-specific temp directory
        TEMP_DIR="$(pwd)/backend/dist/$SERVICE-temp"
        rm -rf "$TEMP_DIR"  # Clean any existing temp directory
        mkdir -p "$TEMP_DIR"
        
        # Create minimal package.json
        cat > "$TEMP_DIR/package.json" << EOF
{
  "name": "$SERVICE",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {}
}
EOF
        
        # Create minimal handler based on service type
        case $SERVICE in
            "auth-service")
                cat > "$TEMP_DIR/index.js" << 'EOF'
exports.handler = async (event, context) => {
    console.log('Auth Service - Event:', JSON.stringify(event, null, 2));
    
    // Handle different auth operations
    const path = event.path || event.requestContext?.path || '';
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    
    if (method === 'POST' && path.includes('/auth')) {
        // Mock login response
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            body: JSON.stringify({
                message: 'Auth service is working',
                token: 'mock-jwt-token',
                user: { id: '1', email: 'test@example.com', role: 'AUTHOR' }
            })
        };
    }
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Auth service health check OK' })
    };
};
EOF
                ;;
            "book-service")
                cat > "$TEMP_DIR/index.js" << 'EOF'
exports.handler = async (event, context) => {
    console.log('Book Service - Event:', JSON.stringify(event, null, 2));
    
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    
    if (method === 'GET') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                books: [
                    { id: '1', title: 'Sample Book 1', author: 'Author 1', status: 'PUBLISHED' },
                    { id: '2', title: 'Sample Book 2', author: 'Author 2', status: 'DRAFT' }
                ]
            })
        };
    }
    
    if (method === 'POST') {
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Book created successfully',
                book: { id: '3', title: 'New Book', status: 'DRAFT' }
            })
        };
    }
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Book service is working' })
    };
};
EOF
                ;;
            "user-service")
                cat > "$TEMP_DIR/index.js" << 'EOF'
exports.handler = async (event, context) => {
    console.log('User Service - Event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'User service is working',
            user: { id: '1', email: 'test@example.com', role: 'AUTHOR' }
        })
    };
};
EOF
                ;;
            "workflow-service")
                cat > "$TEMP_DIR/index.js" << 'EOF'
exports.handler = async (event, context) => {
    console.log('Workflow Service - Event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Workflow service is working',
            workflows: []
        })
    };
};
EOF
                ;;
            "review-service")
                cat > "$TEMP_DIR/index.js" << 'EOF'
exports.handler = async (event, context) => {
    console.log('Review Service - Event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Review service is working',
            reviews: [
                { id: '1', bookId: '1', rating: 5, comment: 'Great book!' }
            ]
        })
    };
};
EOF
                ;;
            "notification-service")
                cat > "$TEMP_DIR/index.js" << 'EOF'
exports.handler = async (event, context) => {
    console.log('Notification Service - Event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Notification service is working',
            notifications: []
        })
    };
};
EOF
                ;;
        esac
        
        # Create ZIP package (fast compression) - only include the minimal files
        echo "   📁 Contents of $TEMP_DIR:"
        ls -la "$TEMP_DIR"
        
        cd "$TEMP_DIR"
        zip -r -1 "../$SERVICE.zip" . > /dev/null 2>&1
        cd ../../..
        
        # Clean up temp directory
        rm -rf "$TEMP_DIR"
        
        echo -e "   ${GREEN}✅ $SERVICE minimal package created ($(du -h backend/dist/$SERVICE.zip 2>/dev/null | cut -f1 || echo 'N/A'))${NC}"
    done
    
    echo -e "${GREEN}✅ All minimal Lambda packages built${NC}"
}

# Function to deploy Lambda functions
deploy_lambda_functions() {
    print_section "Deploying Lambda Functions"
    
    for SERVICE in "${SERVICES[@]}"; do
        echo "📤 Deploying $SERVICE..."
        
        # Check if ZIP file exists
        if [ ! -f "backend/dist/$SERVICE.zip" ]; then
            echo -e "${RED}❌ ZIP file not found: backend/dist/$SERVICE.zip${NC}"
            continue
        fi
        
        FUNCTION_NAME="$ENVIRONMENT-$SERVICE"
        
        # Check if function exists
        if aws --endpoint-url="$LOCALSTACK_ENDPOINT" lambda get-function --function-name "$FUNCTION_NAME" > /dev/null 2>&1; then
            echo "   🔄 Updating existing function: $FUNCTION_NAME"
            aws --endpoint-url="$LOCALSTACK_ENDPOINT" lambda update-function-code \
                --function-name "$FUNCTION_NAME" \
                --zip-file "fileb://backend/dist/$SERVICE.zip" > /dev/null
        else
            echo "   ➕ Creating new function: $FUNCTION_NAME"
            aws --endpoint-url="$LOCALSTACK_ENDPOINT" lambda create-function \
                --function-name "$FUNCTION_NAME" \
                --runtime "nodejs18.x" \
                --role "arn:aws:iam::000000000000:role/lambda-execution-role" \
                --handler "index.handler" \
                --zip-file "fileb://backend/dist/$SERVICE.zip" \
                --environment "Variables={NODE_ENV=$ENVIRONMENT,TABLE_NAME=$ENVIRONMENT-ebook-platform,LOG_LEVEL=debug}" \
                --timeout 30 \
                --memory-size 256 > /dev/null
        fi
        
        echo -e "   ${GREEN}✅ $SERVICE deployed${NC}"
    done
}

# Function to get API Gateway information
get_api_gateway_info() {
    print_section "Getting API Gateway Information" >&2
    
    # Get API ID - use a more robust approach
    echo "   🔍 Getting all API Gateways..." >&2
    
    # Get the first API ID directly (most reliable approach)
    API_ID=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis \
        --query "items[0].id" \
        --output text 2>/dev/null | head -n1 | tr -d '[:space:]')
    
    echo "   📋 Raw API ID result: '$API_ID'" >&2
    
    # Validate the API ID format (should be 10 alphanumeric characters)
    if [[ ! "$API_ID" =~ ^[a-zA-Z0-9]{10}$ ]]; then
        echo "   ⚠️  API ID format looks wrong, trying alternative method..." >&2
        
        # Alternative: parse JSON directly
        API_ID=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis \
            --output json 2>/dev/null | jq -r '.items[0].id // empty' | tr -d '[:space:]')
        
        echo "   📋 Alternative result: '$API_ID'" >&2
    fi
    
    if [ -z "$API_ID" ] || [ "$API_ID" = "None" ] || [ "$API_ID" = "null" ]; then
        echo -e "${RED}❌ No API Gateway found${NC}" >&2
        echo "   Available APIs:" >&2
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis --query "items[*].[id,name]" --output table >&2
        echo "   Please run 'terraform apply' first to create the API Gateway" >&2
        exit 1
    fi
    
    # Final validation and cleanup
    if [[ ! "$API_ID" =~ ^[a-zA-Z0-9]{10}$ ]]; then
        echo -e "${RED}❌ Invalid API ID format: '$API_ID' (length: ${#API_ID})${NC}" >&2
        echo "   Expected: 10 alphanumeric characters" >&2
        echo "   Available APIs:" >&2
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis --query "items[*].[id,name]" --output table >&2
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found API Gateway ID: $API_ID${NC}" >&2
    
    # Get API name for confirmation
    API_NAME=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-api \
        --rest-api-id "$API_ID" \
        --query "name" \
        --output text 2>/dev/null)
    echo "   📋 API Name: $API_NAME" >&2
    
    # Return only the clean API ID (no other output)
    printf "%s" "$API_ID"
}

# Function to update API Gateway integrations
update_api_integrations() {
    local API_ID=$1
    print_section "Updating API Gateway Integrations"
    
    # Get resources
    echo "🔍 Getting API resources..."
    echo "   📋 Using API ID: '$API_ID'"
    echo "   📋 API ID length: ${#API_ID}"
    
    # Validate API ID before making the call
    if [ -z "$API_ID" ] || [ "$API_ID" = "None" ] || [ "$API_ID" = "null" ]; then
        echo -e "${RED}❌ Invalid API ID: '$API_ID'${NC}"
        echo "   Available APIs:"
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis --query "items[*].[id,name]" --output table
        exit 1
    fi
    
    RESOURCES=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-resources \
        --rest-api-id "$API_ID" --output json)
    
    # Extract resource IDs
    AUTH_RESOURCE_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path=="/api/auth") | .id')
    BOOKS_RESOURCE_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path=="/api/books") | .id')
    USERS_RESOURCE_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path=="/api/users") | .id')
    REVIEWS_RESOURCE_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path=="/api/reviews") | .id')
    WORKFLOW_RESOURCE_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path=="/api/workflow") | .id')
    NOTIFICATIONS_RESOURCE_ID=$(echo "$RESOURCES" | jq -r '.items[] | select(.path=="/api/notifications") | .id')
    
    echo "📋 Found resources:"
    echo "   Auth: $AUTH_RESOURCE_ID"
    echo "   Books: $BOOKS_RESOURCE_ID"
    echo "   Users: $USERS_RESOURCE_ID"
    echo "   Reviews: $REVIEWS_RESOURCE_ID"
    echo "   Workflow: $WORKFLOW_RESOURCE_ID"
    echo "   Notifications: $NOTIFICATIONS_RESOURCE_ID"
    
    # Create HTTP methods and integrations
    echo "🔗 Creating HTTP methods and integrations..."
    
    # Auth service (POST)
    if [ "$AUTH_RESOURCE_ID" != "null" ] && [ -n "$AUTH_RESOURCE_ID" ]; then
        echo "   🔗 Auth service (POST)..."
        
        # Create POST method first
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$AUTH_RESOURCE_ID" \
            --http-method "POST" \
            --authorization-type "NONE" > /dev/null 2>&1 || true
        
        # Create integration
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$AUTH_RESOURCE_ID" \
            --http-method "POST" \
            --type "AWS_PROXY" \
            --integration-http-method "POST" \
            --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:$ENVIRONMENT-auth-service/invocations" > /dev/null
        echo -e "      ${GREEN}✅ Auth method and integration created${NC}"
    fi   
    # Book service (GET and POST)
    if [ "$BOOKS_RESOURCE_ID" != "null" ] && [ -n "$BOOKS_RESOURCE_ID" ]; then
        echo "   🔗 Book service (GET)..."
        
        # Create GET method first
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$BOOKS_RESOURCE_ID" \
            --http-method "GET" \
            --authorization-type "NONE" > /dev/null 2>&1 || true
        
        # Create GET integration
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$BOOKS_RESOURCE_ID" \
            --http-method "GET" \
            --type "AWS_PROXY" \
            --integration-http-method "POST" \
            --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:$ENVIRONMENT-book-service/invocations" > /dev/null
        
        echo "   🔗 Book service (POST)..."
        
        # Create POST method first
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$BOOKS_RESOURCE_ID" \
            --http-method "POST" \
            --authorization-type "NONE" > /dev/null 2>&1 || true
        
        # Create POST integration
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$BOOKS_RESOURCE_ID" \
            --http-method "POST" \
            --type "AWS_PROXY" \
            --integration-http-method "POST" \
            --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:$ENVIRONMENT-book-service/invocations" > /dev/null
        echo -e "      ${GREEN}✅ Book methods and integrations created${NC}"
    fi
    
    # User service (GET)
    if [ "$USERS_RESOURCE_ID" != "null" ] && [ -n "$USERS_RESOURCE_ID" ]; then
        echo "   🔗 User service (GET)..."
        
        # Create GET method first
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$USERS_RESOURCE_ID" \
            --http-method "GET" \
            --authorization-type "NONE" > /dev/null 2>&1 || true
        
        # Create integration
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$USERS_RESOURCE_ID" \
            --http-method "GET" \
            --type "AWS_PROXY" \
            --integration-http-method "POST" \
            --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:$ENVIRONMENT-user-service/invocations" > /dev/null
        echo -e "      ${GREEN}✅ User method and integration created${NC}"
    fi
    
    # Review service (GET)
    if [ "$REVIEWS_RESOURCE_ID" != "null" ] && [ -n "$REVIEWS_RESOURCE_ID" ]; then
        echo "   🔗 Review service (GET)..."
        
        # Create GET method first
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$REVIEWS_RESOURCE_ID" \
            --http-method "GET" \
            --authorization-type "NONE" > /dev/null 2>&1 || true
        
        # Create integration
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$REVIEWS_RESOURCE_ID" \
            --http-method "GET" \
            --type "AWS_PROXY" \
            --integration-http-method "POST" \
            --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:$ENVIRONMENT-review-service/invocations" > /dev/null
        echo -e "      ${GREEN}✅ Review method and integration created${NC}"
    fi
    
    # Workflow service (POST)
    if [ "$WORKFLOW_RESOURCE_ID" != "null" ] && [ -n "$WORKFLOW_RESOURCE_ID" ]; then
        echo "   🔗 Workflow service (POST)..."
        
        # Create POST method first
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$WORKFLOW_RESOURCE_ID" \
            --http-method "POST" \
            --authorization-type "NONE" > /dev/null 2>&1 || true
        
        # Create integration
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$WORKFLOW_RESOURCE_ID" \
            --http-method "POST" \
            --type "AWS_PROXY" \
            --integration-http-method "POST" \
            --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:$ENVIRONMENT-workflow-service/invocations" > /dev/null
        echo -e "      ${GREEN}✅ Workflow method and integration created${NC}"
    fi  
    # Notification service (GET)
    if [ "$NOTIFICATIONS_RESOURCE_ID" != "null" ] && [ -n "$NOTIFICATIONS_RESOURCE_ID" ]; then
        echo "   🔗 Notification service (GET)..."
        
        # Create GET method first
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$NOTIFICATIONS_RESOURCE_ID" \
            --http-method "GET" \
            --authorization-type "NONE" > /dev/null 2>&1 || true
        
        # Create integration
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$NOTIFICATIONS_RESOURCE_ID" \
            --http-method "GET" \
            --type "AWS_PROXY" \
            --integration-http-method "POST" \
            --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:$ENVIRONMENT-notification-service/invocations" > /dev/null
        echo -e "      ${GREEN}✅ Notification method and integration created${NC}"
    fi
}

# Function to create API Gateway deployment
create_deployment() {
    local API_ID=$1
    print_section "Creating API Gateway Deployment"
    
    echo "🚀 Creating new deployment..."
    DEPLOYMENT_ID=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway create-deployment \
        --rest-api-id "$API_ID" \
        --stage-name "$ENVIRONMENT" \
        --query 'id' \
        --output text)
    
    echo -e "${GREEN}✅ Created deployment: $DEPLOYMENT_ID${NC}"
    echo "   📋 Stage: $ENVIRONMENT"
}

# Function to update frontend configuration
update_frontend_config() {
    local API_ID=$1
    print_section "Updating Frontend Configuration"
    
    # Update .env.local with correct API ID
    if [ -f "frontend/.env.local" ]; then
        echo "🔧 Updating frontend/.env.local..."
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=http://localhost:4566/restapis/$API_ID/$ENVIRONMENT/_user_request_|g" frontend/.env.local
        echo -e "${GREEN}✅ Frontend environment updated${NC}"
        echo "   📋 API URL: http://localhost:4566/restapis/$API_ID/$ENVIRONMENT/_user_request_"
    else
        echo -e "${YELLOW}⚠️  frontend/.env.local not found, creating it...${NC}"
        cat > frontend/.env.local << EOF
# Frontend Environment Variables for Local Development
VITE_API_URL=http://localhost:4566/restapis/$API_ID/$ENVIRONMENT/_user_request_
VITE_WS_URL=ws://localhost:4566
VITE_ENVIRONMENT=development
VITE_ENABLE_DEBUG=true
VITE_ENABLE_REAL_TIME=false
VITE_ENABLE_ANALYTICS=false
EOF
        echo -e "${GREEN}✅ Created frontend/.env.local${NC}"
    fi
}

# Function to test API endpoints
test_endpoints() {
    local API_ID=$1
    print_section "Testing API Endpoints"
    
    BASE_URL="http://localhost:4566/restapis/$API_ID/$ENVIRONMENT/_user_request_"
    
    echo "🧪 Comprehensive endpoint testing..."
    echo "   📡 Base URL: $BASE_URL"
    echo ""
    
    # Test results tracking
    local TOTAL_TESTS=0
    local PASSED_TESTS=0
    local FAILED_TESTS=0
    
    # Helper function to test endpoint
    test_endpoint() {
        local name="$1"
        local method="$2"
        local path="$3"
        local data="$4"
        local expected_codes="$5"
        
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        echo "   🔍 Testing $name ($method $path)..."
        
        local temp_file="/tmp/test_${TOTAL_TESTS}.json"
        local curl_cmd="curl -s -w %{http_code} -o $temp_file -X $method $BASE_URL$path"
        
        if [ -n "$data" ]; then
            curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
        fi
        
        local response_code=$(eval $curl_cmd)
        local response_body=""
        
        if [ -f "$temp_file" ]; then
            response_body=$(cat "$temp_file")
        fi
        
        # Check if response code is expected
        local is_expected=false
        for expected in $expected_codes; do
            if [ "$response_code" = "$expected" ]; then
                is_expected=true
                break
            fi
        done
        
        if [ "$is_expected" = "true" ]; then
            echo -e "      ${GREEN}✅ $name: HTTP $response_code${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            
            # Show response preview for successful calls
            if [ "$response_code" = "200" ] || [ "$response_code" = "201" ]; then
                local preview=$(echo "$response_body" | jq -c '.' 2>/dev/null | head -c 100)
                if [ -n "$preview" ]; then
                    echo "         📄 Response: ${preview}..."
                fi
            fi
        else
            echo -e "      ${RED}❌ $name: HTTP $response_code (expected: $expected_codes)${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            
            # Show error details
            if [ -n "$response_body" ]; then
                local error_preview=$(echo "$response_body" | head -c 200)
                echo "         💥 Error: $error_preview"
            fi
        fi
        
        # Clean up temp file
        rm -f "$temp_file"
        echo ""
    }
    
    # Test all endpoints
    echo "🚀 Running endpoint tests..."
    echo ""
    
    # 1. Auth Service Tests
    echo "   🔐 AUTH SERVICE TESTS"
    test_endpoint "Auth Login" "POST" "/api/auth" '{"email": "test@example.com", "password": "test123"}' "200 400 401"
    test_endpoint "Auth Health Check" "GET" "/api/auth" "" "200"
    
    # 2. Books Service Tests  
    echo "   📚 BOOKS SERVICE TESTS"
    test_endpoint "Get Books" "GET" "/api/books" "" "200 401"
    test_endpoint "Create Book" "POST" "/api/books" '{"title": "Test Book", "content": "Test content", "genre": "fiction"}' "200 201 401"
    
    # 3. Users Service Tests
    echo "   👥 USERS SERVICE TESTS"
    test_endpoint "Get Users" "GET" "/api/users" "" "200 401"
    
    # 4. Reviews Service Tests
    echo "   ⭐ REVIEWS SERVICE TESTS"
    test_endpoint "Get Reviews" "GET" "/api/reviews" "" "200"
    
    # 5. Workflow Service Tests
    echo "   🔄 WORKFLOW SERVICE TESTS"
    test_endpoint "Submit Workflow" "POST" "/api/workflow" '{"bookId": "123", "action": "submit"}' "200 401"
    
    # 6. Notifications Service Tests
    echo "   🔔 NOTIFICATIONS SERVICE TESTS"
    test_endpoint "Get Notifications" "GET" "/api/notifications" "" "200 401"
    
    # 7. CORS Tests
    echo "   🌐 CORS TESTS"
    test_endpoint "Auth CORS" "OPTIONS" "/api/auth" "" "200"
    test_endpoint "Books CORS" "OPTIONS" "/api/books" "" "200"
    
    # Test Summary
    echo "📊 TEST SUMMARY"
    echo "   Total Tests: $TOTAL_TESTS"
    echo -e "   ${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "   ${RED}Failed: $FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "   ${GREEN}🎉 All tests passed!${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Some tests failed. Check the details above.${NC}"
    fi
    
    echo ""
    echo "🔗 Quick Test Commands:"
    echo "   curl -X POST $BASE_URL/api/auth -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"test123\"}'"
    echo "   curl $BASE_URL/api/books"
    echo "   curl $BASE_URL/api/reviews"
}

# Function to show deployment summary
show_summary() {
    local API_ID=$1
    print_section "Deployment Summary"
    
    echo -e "${GREEN}🎉 Backend deployment completed successfully!${NC}"
    echo ""
    echo "📋 Deployment Details:"
    echo "   • Environment: $ENVIRONMENT"
    echo "   • API Gateway ID: $API_ID"
    echo "   • Lambda Functions: ${#SERVICES[@]} deployed"
    echo "   • API Integrations: Updated"
    echo "   • Frontend Config: Updated"
    echo ""
    echo "🌐 API Endpoints:"
    echo "   • Base URL: http://localhost:4566/restapis/$API_ID/$ENVIRONMENT/_user_request_"
    echo "   • Auth: POST /api/auth"
    echo "   • Books: GET/POST /api/books"
    echo "   • Users: GET /api/users"
    echo "   • Reviews: GET /api/reviews"
    echo "   • Workflow: POST /api/workflow"
    echo "   • Notifications: GET /api/notifications"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Start your frontend: cd frontend && npm run dev"
    echo "   2. Test the API endpoints using the URLs above"
    echo "   3. Check LocalStack logs if you encounter issues"
    echo ""
    echo -e "${BLUE}Happy coding! 🚀${NC}"
}

# Main execution function
main() {
    local SKIP_BUILD=false
    local SKIP_DEPLOY=false
    local SKIP_TEST=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --force-rebuild)
                FORCE_REBUILD=true
                shift
                ;;
            --skip-deploy)
                SKIP_DEPLOY=true
                shift
                ;;
            --skip-test)
                SKIP_TEST=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-build      Skip building Lambda packages"
                echo "  --force-rebuild   Force rebuild of all Lambda packages"
                echo "  --skip-deploy     Skip deploying Lambda functions"
                echo "  --skip-test       Skip testing endpoints"
                echo "  --help, -h        Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    check_prerequisites
    
    if [ "$SKIP_BUILD" = false ]; then
        build_lambda_packages
    fi
    
    if [ "$SKIP_DEPLOY" = false ]; then
        deploy_lambda_functions
    fi
    
    API_ID=$(get_api_gateway_info)
    update_api_integrations "$API_ID"
    create_deployment "$API_ID"
    update_frontend_config "$API_ID"
    
    if [ "$SKIP_TEST" = false ]; then
        test_endpoints "$API_ID"
    fi
    
    show_summary "$API_ID"
}

# Run main function with all arguments
main "$@"