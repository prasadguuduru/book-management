#!/bin/bash

# Build Lambda Packages Script
# Creates deployment-ready Lambda function packages for AWS deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
DIST_DIR="$BACKEND_DIR/dist"
LAMBDA_SERVICES=(
  "auth-service"
  "custom-authorizer"
  "book-service"
  "user-service"
  "workflow-service"
  "review-service"
  "notification-service"
)

# Get environment from command line argument or default to local
ENVIRONMENT=${1:-local}

echo -e "${BLUE}🏗️  Building Lambda packages for $ENVIRONMENT environment...${NC}"

# Load environment-specific variables (check multiple locations)
ROOT_ENV_FILE=".env.$ENVIRONMENT"
BACKEND_ENV_FILE="backend/.env.$ENVIRONMENT"
FRONTEND_ENV_FILE="frontend/.env.$ENVIRONMENT"

if [ -f "$ROOT_ENV_FILE" ]; then
  echo -e "${YELLOW}📋 Loading environment variables from $ROOT_ENV_FILE${NC}"
  source "$ROOT_ENV_FILE"
elif [ -f "$BACKEND_ENV_FILE" ]; then
  echo -e "${YELLOW}📋 Loading backend environment variables from $BACKEND_ENV_FILE${NC}"
  source "$BACKEND_ENV_FILE"
elif [ -f "$FRONTEND_ENV_FILE" ]; then
  echo -e "${YELLOW}📋 Loading frontend environment variables from $FRONTEND_ENV_FILE${NC}"
  source "$FRONTEND_ENV_FILE"
elif [ -f ".env.local" ] && [ "$ENVIRONMENT" = "local" ]; then
  echo -e "${YELLOW}📋 Loading environment variables from .env.local${NC}"
  source .env.local
else
  echo -e "${YELLOW}⚠️  No environment file found for $ENVIRONMENT, using defaults${NC}"
fi

# Export environment for use in build process
export ENVIRONMENT

# Create dist directory if it doesn't exist
echo -e "${BLUE}📁 Creating distribution directory...${NC}"
mkdir -p "$DIST_DIR"

# Clean previous builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf "$DIST_DIR"/*.zip
rm -rf "$DIST_DIR"/temp-*

# Build TypeScript backend
echo -e "${BLUE}🔨 Building TypeScript backend...${NC}"
cd "$BACKEND_DIR"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
  npm ci
fi

# Compile TypeScript
echo -e "${BLUE}⚙️  Compiling TypeScript...${NC}"
npx tsc

cd ..

# Function to create Lambda package
create_lambda_package() {
  local service_name=$1
  local temp_dir="$DIST_DIR/temp-$service_name"
  local zip_file="$DIST_DIR/$service_name.zip"
  
  echo -e "${BLUE}📦 Creating package for $service_name...${NC}"
  
  # Create temporary directory
  mkdir -p "$temp_dir"
  
  # Copy compiled JavaScript files (excluding zip files and temp directories)
  if [ -d "$BACKEND_DIR/dist" ]; then
    # Copy all files except .zip files and temp-* directories
    find "$BACKEND_DIR/dist" -maxdepth 1 -type f -name "*.js" -exec cp {} "$temp_dir/" \;
    find "$BACKEND_DIR/dist" -maxdepth 1 -type d ! -name "dist" ! -name "temp-*" -exec cp -r {} "$temp_dir/" \;
    
    # Copy specific directories we need
    for dir in auth-service book-service user-service workflow-service review-service notification-service custom-authorizer data utils types middleware services; do
      if [ -d "$BACKEND_DIR/dist/$dir" ]; then
        cp -r "$BACKEND_DIR/dist/$dir" "$temp_dir/"
      fi
    done
  else
    echo -e "${RED}❌ Backend dist directory not found. Run 'npm run build' first.${NC}"
    exit 1
  fi
  
  # Copy package.json and install production dependencies
  cp "$BACKEND_DIR/package.json" "$temp_dir/"
  
  # Create a minimal package.json for Lambda
  cat > "$temp_dir/package.json" << EOF
{
  "name": "$service_name",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1490.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.11.0",
    "uuid": "^9.0.1",
    "compression": "^1.7.4",
    "@vendia/serverless-express": "^4.12.6",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0"
  }
}
EOF
  
  # Install production dependencies
  echo -e "${YELLOW}📦 Installing production dependencies for $service_name...${NC}"
  cd "$temp_dir"
  npm install --production --silent
  cd - > /dev/null
  
  # Create service-specific entry point
  create_service_entry_point "$service_name" "$temp_dir"
  
  # Create ZIP package
  echo -e "${BLUE}🗜️  Creating ZIP package for $service_name...${NC}"
  cd "$temp_dir"
  zip -r "../$service_name.zip" . -q
  cd - > /dev/null
  
  # Clean up temporary directory
  rm -rf "$temp_dir"
  
  # Verify package size
  local size=$(du -h "$zip_file" | cut -f1)
  echo -e "${GREEN}✅ Created $service_name.zip ($size)${NC}"
}

# Function to create service-specific entry point
create_service_entry_point() {
  local service_name=$1
  local temp_dir=$2
  
  # Services that already export handlers directly
  if [ "$service_name" = "auth-service" ] || [ "$service_name" = "custom-authorizer" ] || [ "$service_name" = "book-service" ]; then
    echo -e "${YELLOW}🔗 Using direct handler for $service_name${NC}"
    # For services that already export handlers, just use the compiled handler
    # The compiled auth-service/index.js already exports the correct handler
    # We need to create a wrapper that imports from the service directory
    cat > "$temp_dir/index.js" << EOF
/**
 * AWS Lambda entry point for $service_name
 * Auto-generated by build-lambda-packages.sh
 */

// Import the handler from the compiled service
const { handler } = require('./$service_name/index');

// Export the handler for Lambda
exports.handler = handler;
EOF
  else
    echo -e "${YELLOW}🔗 Creating Express wrapper for $service_name${NC}"
    # Create index.js entry point for Express-based services
    cat > "$temp_dir/index.js" << EOF
/**
 * AWS Lambda entry point for $service_name
 * Auto-generated by build-lambda-packages.sh
 */

const { app } = require('./$service_name/index');

// Lambda handler
exports.handler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event, null, 2));
  console.log('Lambda context:', JSON.stringify(context, null, 2));
  
  // For API Gateway events
  if (event.httpMethod) {
    return await handleApiGatewayEvent(event, context);
  }
  
  // For direct invocation
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: '$service_name Lambda function executed successfully',
      service: '$service_name',
      timestamp: new Date().toISOString(),
      event: event,
      context: {
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        requestId: context.awsRequestId
      }
    })
  };
};

// Handle API Gateway events
async function handleApiGatewayEvent(event, context) {
  const express = require('express');
  const serverlessExpress = require('@vendia/serverless-express');
  
  // Create serverless express handler
  const handler = serverlessExpress({ app });
  
  return await handler(event, context);
}
EOF
  fi
}

# Build packages for each service
echo -e "${BLUE}🚀 Building Lambda packages...${NC}"

for service in "${LAMBDA_SERVICES[@]}"; do
  create_lambda_package "$service"
done

# Create deployment manifest
echo -e "${BLUE}📋 Creating deployment manifest...${NC}"
cat > "$DIST_DIR/deployment-manifest.json" << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "${ENVIRONMENT:-local}",
  "services": [
$(for service in "${LAMBDA_SERVICES[@]}"; do
  size=$(stat -f%z "$DIST_DIR/$service.zip" 2>/dev/null || stat -c%s "$DIST_DIR/$service.zip" 2>/dev/null || echo "0")
  echo "    {\"name\": \"$service\", \"package\": \"$service.zip\", \"size\": $size},"
done | sed '$ s/,$//')
  ],
  "totalPackages": ${#LAMBDA_SERVICES[@]},
  "buildCommand": "npm run build:lambda"
}
EOF

# Summary
echo -e "${GREEN}🎉 Lambda package build completed!${NC}"
echo -e "${BLUE}📊 Build Summary:${NC}"
echo -e "   • Environment: ${ENVIRONMENT:-local}"
echo -e "   • Services built: ${#LAMBDA_SERVICES[@]}"
echo -e "   • Output directory: $DIST_DIR"
echo -e "   • Manifest: $DIST_DIR/deployment-manifest.json"

# List created packages
echo -e "${BLUE}📦 Created packages:${NC}"
for service in "${LAMBDA_SERVICES[@]}"; do
  if [ -f "$DIST_DIR/$service.zip" ]; then
    size=$(du -h "$DIST_DIR/$service.zip" | cut -f1)
    echo -e "   ✅ $service.zip ($size)"
  else
    echo -e "   ❌ $service.zip (failed)"
  fi
done

# Deploy to AWS if not local environment
if [ "$ENVIRONMENT" != "local" ]; then
  echo -e "${BLUE}🚀 Deploying Lambda functions to AWS $ENVIRONMENT environment...${NC}"
  
  # Create deployment artifacts directory
  DEPLOY_DIR="deployment-artifacts/$ENVIRONMENT"
  mkdir -p "$DEPLOY_DIR"
  
  # Copy packages to deployment directory
  for service in "${LAMBDA_SERVICES[@]}"; do
    if [ -f "$DIST_DIR/$service.zip" ]; then
      cp "$DIST_DIR/$service.zip" "$DEPLOY_DIR/"
      echo -e "${YELLOW}📦 Copied $service.zip to deployment artifacts${NC}"
    fi
  done
  
  # Deploy each service to AWS Lambda
  for service in "${LAMBDA_SERVICES[@]}"; do
    if [ -f "$DEPLOY_DIR/$service.zip" ]; then
      echo -e "${YELLOW}🚀 Deploying $service to AWS Lambda...${NC}"
      
      # Construct function name with environment prefix
      FUNCTION_NAME="$ENVIRONMENT-$service"
      
      # Update Lambda function code
      if aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file "fileb://$DEPLOY_DIR/$service.zip" \
        --output table > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Successfully deployed $FUNCTION_NAME${NC}"
      else
        echo -e "${RED}   ❌ Failed to deploy $FUNCTION_NAME${NC}"
      fi
    fi
  done
  
  echo -e "${GREEN}🎉 Deployment completed for $ENVIRONMENT environment!${NC}"
else
  echo -e "${GREEN}🚀 Ready for deployment to LocalStack!${NC}"
  echo -e "${YELLOW}💡 Usage examples:${NC}"
  echo -e "   • Build for local: npm run build:lambda:local"
  echo -e "   • Build for QA: npm run build:lambda:qa"
  echo -e "   • Build for staging: npm run build:lambda:staging"
  echo -e "   • Build for prod: npm run build:lambda:prod"
  echo -e "${YELLOW}💡 Next steps:${NC}"
  echo -e "   • Deploy to LocalStack: npm run deploy:lambda:local"
fi