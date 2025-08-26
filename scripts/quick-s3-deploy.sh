#!/bin/bash

# Quick S3 Deploy Script for LocalStack
# Builds frontend and deploys to LocalStack S3 using direct API calls (most reliable)

set -e

# Parse command line arguments
FORCE_REBUILD=false
SKIP_BUILD=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force|-f)
      FORCE_REBUILD=true
      shift
      ;;
    --skip-build|-s)
      SKIP_BUILD=true
      shift
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --force, -f      Force rebuild even if dist exists"
      echo "  --skip-build, -s Skip build step (use existing dist)"
      echo "  --verbose, -v    Verbose output"
      echo "  --help, -h       Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo "🚀 Quick S3 Deploy to LocalStack using direct API..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME="ebook-frontend-local"
LOCALSTACK_ENDPOINT="http://localhost:4566"

# Step 1: Check if LocalStack is running
echo -e "${BLUE}🔍 Checking LocalStack status...${NC}"
if ! curl -s $LOCALSTACK_ENDPOINT/health > /dev/null; then
    echo -e "${YELLOW}⚠️  LocalStack not responding. Please start it with: npm run localstack:start${NC}"
    exit 1
fi
echo -e "${GREEN}✅ LocalStack is running${NC}"

# Step 2: Build frontend
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🔨 Building frontend...${NC}"
    cd frontend

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        npm ci
    fi

    # Check if we should force rebuild or if dist doesn't exist
    if [ "$FORCE_REBUILD" = true ] || [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        echo -e "${BLUE}🏗️  Building frontend application...${NC}"
        
        # Load environment variables if .env.local exists
        if [ -f "../.env.local" ]; then
            echo -e "${BLUE}📋 Loading environment from .env.local${NC}"
            set -a
            source ../.env.local
            set +a
        fi
        
        # Build with appropriate environment
        if [ "$VERBOSE" = true ]; then
            npm run build -- --mode local
        else
            npm run build -- --mode local > /dev/null 2>&1
        fi
        
        # Verify build
        if [ ! -f "dist/index.html" ]; then
            echo -e "${RED}❌ Build failed - index.html not found${NC}"
            cd ..
            exit 1
        fi
        
        echo -e "${GREEN}✅ Frontend built successfully${NC}"
    else
        echo -e "${YELLOW}📦 Using existing build (use --force to rebuild)${NC}"
    fi

    cd ..
else
    echo -e "${YELLOW}⏭️  Skipping build step${NC}"
    if [ ! -f "frontend/dist/index.html" ]; then
        echo -e "${RED}❌ No existing build found. Remove --skip-build flag.${NC}"
        exit 1
    fi
fi

# Step 3: Create S3 bucket using direct API
echo -e "${BLUE}🪣 Creating S3 bucket using direct API...${NC}"
curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME" \
  -H "Host: $BUCKET_NAME.s3.localhost.localstack.cloud" \
  -s > /dev/null || echo "Bucket may already exist"

# Step 4: Upload files using direct API calls
echo -e "${BLUE}📤 Uploading files using direct LocalStack API...${NC}"

# Function to upload file with proper content type
upload_file() {
    local file_path=$1
    local s3_key=$2
    local content_type=$3
    
    if [ "$VERBOSE" = true ]; then
        echo "📤 Uploading $s3_key (Content-Type: $content_type)..."
    fi
    
    curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/$s3_key" \
      -H "Content-Type: $content_type" \
      -T "$file_path" \
      -s > /dev/null
    
    if [ $? -eq 0 ]; then
        if [ "$VERBOSE" = true ]; then
            echo -e "${GREEN}✅ Uploaded $s3_key${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to upload $s3_key${NC}"
        return 1
    fi
}

# Upload index.html
echo -e "${BLUE}📄 Uploading index.html...${NC}"
upload_file "frontend/dist/index.html" "index.html" "text/html"

# Upload all other files
file_count=1
for file in frontend/dist/*; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        
        # Skip index.html as it's already uploaded
        if [ "$filename" = "index.html" ]; then
            continue
        fi
        
        # Determine content type
        case "$filename" in
            *.css) content_type="text/css" ;;
            *.js) content_type="application/javascript" ;;
            *.json) content_type="application/json" ;;
            *.png) content_type="image/png" ;;
            *.jpg|*.jpeg) content_type="image/jpeg" ;;
            *.svg) content_type="image/svg+xml" ;;
            *.ico) content_type="image/x-icon" ;;
            *.woff|*.woff2) content_type="font/woff" ;;
            *.ttf) content_type="font/ttf" ;;
            *) content_type="application/octet-stream" ;;
        esac
        
        upload_file "$file" "$filename" "$content_type"
        ((file_count++))
    fi
done

# Upload assets directory if it exists
if [ -d "frontend/dist/assets" ]; then
    echo -e "${BLUE}📁 Uploading assets directory...${NC}"
    for file in frontend/dist/assets/*; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            
            # Determine content type
            case "$filename" in
                *.css) content_type="text/css" ;;
                *.js) content_type="application/javascript" ;;
                *.png) content_type="image/png" ;;
                *.jpg|*.jpeg) content_type="image/jpeg" ;;
                *.svg) content_type="image/svg+xml" ;;
                *.ico) content_type="image/x-icon" ;;
                *.woff|*.woff2) content_type="font/woff" ;;
                *.ttf) content_type="font/ttf" ;;
                *) content_type="application/octet-stream" ;;
            esac
            
            upload_file "$file" "assets/$filename" "$content_type"
            ((file_count++))
        fi
    done
fi

echo -e "${GREEN}✅ Uploaded $file_count files${NC}"

# Step 5: Set bucket policy for public access
echo -e "${BLUE}🔓 Setting public access policy...${NC}"
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME?policy" \
  -H "Content-Type: application/json" \
  -d @/tmp/bucket-policy.json \
  -s > /dev/null || echo "Policy setting may have failed (continuing...)"

# Step 6: Test deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
sleep 1  # Give LocalStack a moment to process

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/index.html")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Deployment test successful (HTTP $HTTP_STATUS)${NC}"
    
    # Show a preview of the content
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}📄 Content preview:${NC}"
        curl -s "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/index.html" | head -5
    fi
else
    echo -e "${YELLOW}⚠️  HTTP Status: $HTTP_STATUS${NC}"
    echo -e "${YELLOW}Trying alternative access methods...${NC}"
    
    # Try different URL formats
    curl -s "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/index.html" | head -3 || echo "Alternative access also failed"
fi

# Step 7: Display results
echo -e "${GREEN}🎉 Frontend deployed successfully!${NC}"
echo ""
echo -e "${BLUE}📍 Access URLs:${NC}"
echo -e "   🌐 Primary: ${LOCALSTACK_ENDPOINT}/$BUCKET_NAME/index.html"
echo -e "   🌐 Direct S3: http://localhost:4566/$BUCKET_NAME/index.html"
echo -e "   🌐 Website: http://$BUCKET_NAME.s3-website.localhost.localstack.cloud:4566"
echo ""
echo -e "${BLUE}🔧 Development URLs:${NC}"
echo -e "   🚀 Dev Server: http://localhost:3000 (npm run dev:frontend)"
echo -e "   🔌 Backend API: http://localhost:3001/api"
echo -e "   🏥 Health Check: http://localhost:3001/health"
echo -e "   🗄️  DynamoDB Admin: http://localhost:8001"
echo ""
echo -e "${BLUE}🧪 Quick Tests:${NC}"
echo -e "   curl -s ${LOCALSTACK_ENDPOINT}/$BUCKET_NAME/index.html | head -5"
echo -e "   curl -s http://localhost:3001/health | jq ."
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   • Use --force to force rebuild: $0 --force"
echo -e "   • Use --skip-build to deploy existing build: $0 --skip-build"
echo -e "   • Use --verbose for detailed output: $0 --verbose"
echo -e "   • For development with hot reload: npm run dev:frontend"
echo -e "   • For backend development: npm run dev:backend"

# Cleanup
rm -f /tmp/bucket-policy.json

echo -e "${GREEN}🎉 Deployment complete!${NC}"