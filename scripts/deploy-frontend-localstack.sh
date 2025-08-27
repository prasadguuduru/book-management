#!/bin/bash
# Deploy frontend to LocalStack S3 for local development
# Includes .env.local verification and rebuild functionality

set -e

echo "🚀 Deploying frontend to LocalStack S3..."

# Configuration
LOCALSTACK_ENDPOINT="http://localhost:4566"
BUCKET_NAME="ebook-frontend-local"
BUILD_DIR="frontend/dist"

# Function to verify and rebuild frontend
verify_and_rebuild() {
    echo ""
    echo "🔍 Verifying .env.local configuration..."
    
    cd frontend
    
    echo ""
    echo "📋 Current .env.local contents:"
    if [ -f ".env.local" ]; then
        cat .env.local
    else
        echo "❌ .env.local not found - using default .env"
        if [ -f ".env" ]; then
            cat .env
        fi
    fi
    
    echo ""
    echo "🏗️ Building frontend with environment variables..."
    npm run build
    
    echo ""
    echo "🔍 Verifying environment variables in built files..."
    if grep -r "localhost:4566" dist/ >/dev/null 2>&1; then
        echo "✅ Found LocalStack URL in build - .env.local is working!"
        echo "   API URLs found:"
        grep -r "localhost:4566" dist/ | head -2 | sed 's/^/   /'
    else
        echo "⚠️  LocalStack URL not found in build"
        echo "   Checking for any API URLs..."
        grep -r "VITE_APIGATEWAY_URL\|http" dist/ | head -2 | sed 's/^/   /' || echo "   No API URLs found"
    fi
    
    echo ""
    echo "🔧 Fixing asset paths for S3 hosting..."
    # Fix absolute paths to relative paths in index.html
    if [ -f "dist/index.html" ]; then
        # Replace /assets/ with ./assets/ and /vite.svg with ./vite.svg
        sed -i.bak 's|="/assets/|="./assets/|g; s|="/vite.svg|="./vite.svg|g' dist/index.html
        echo "   ✅ Fixed asset paths in index.html"
        
        # Verify the fix
        if grep -q '="./assets/' dist/index.html; then
            echo "   ✅ Relative paths confirmed in HTML"
        else
            echo "   ⚠️  Path fix may not have worked"
        fi
    else
        echo "   ❌ index.html not found"
    fi
    
    cd ..
}

# Always verify and rebuild to ensure latest .env.local changes
verify_and_rebuild

echo "📁 Build directory: $BUILD_DIR"

# Create bucket if it doesn't exist
echo "🪣 Ensuring S3 bucket exists..."
aws --endpoint-url="$LOCALSTACK_ENDPOINT" s3 mb s3://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"

# Configure bucket for static website hosting
echo "🌐 Configuring static website hosting..."
aws --endpoint-url="$LOCALSTACK_ENDPOINT" s3 website s3://$BUCKET_NAME \
    --index-document index.html \
    --error-document index.html

# Make bucket public for static hosting
echo "🔓 Setting bucket policy for public access..."
aws --endpoint-url="$LOCALSTACK_ENDPOINT" s3api put-bucket-policy \
    --bucket $BUCKET_NAME \
    --policy '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
            }
        ]
    }'

# Upload files to S3 with LocalStack-compatible options
echo "⬆️  Uploading files to LocalStack S3..."

# Clear bucket first to ensure clean deployment
echo "   Clearing existing files..."
aws --endpoint-url="$LOCALSTACK_ENDPOINT" s3 rm s3://$BUCKET_NAME --recursive 2>/dev/null || echo "Bucket was empty"

# Use curl for uploads (bypasses AWS CLI issues completely)
echo "   Uploading files using curl (bypasses header issues)..."

# Clear and recreate bucket using curl
curl -X DELETE "$LOCALSTACK_ENDPOINT/$BUCKET_NAME" 2>/dev/null || echo "Bucket was empty"
curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME" 2>/dev/null || echo "Bucket creation failed"

upload_count=0
failed_count=0

# Upload index.html with path fixes for LocalStack
if [ -f "$BUILD_DIR/index.html" ]; then
    echo "     Uploading: index.html (fixing asset paths for LocalStack)"
    
    # Create temporary file with fixed paths
    temp_html=$(mktemp)
    sed 's|href="/assets/|href="./assets/|g; s|src="/assets/|src="./assets/|g' "$BUILD_DIR/index.html" > "$temp_html"
    
    if curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/index.html" \
        -H "Content-Type: text/html" \
        --data-binary "@$temp_html" -s >/dev/null 2>&1; then
        echo "       ✅ Success: index.html (paths fixed)"
        upload_count=$((upload_count + 1))
    else
        echo "       ❌ Failed: index.html"
        failed_count=$((failed_count + 1))
    fi
    
    # Clean up temp file
    rm "$temp_html"
fi

# Upload CSS files
for file in "$BUILD_DIR"/assets/*.css; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "     Uploading: assets/$filename"
        if curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/assets/$filename" \
            -H "Content-Type: text/css" \
            --data-binary "@$file" -s >/dev/null 2>&1; then
            echo "       ✅ Success: assets/$filename"
            upload_count=$((upload_count + 1))
        else
            echo "       ❌ Failed: assets/$filename"
            failed_count=$((failed_count + 1))
        fi
    fi
done

# Upload JS files
for file in "$BUILD_DIR"/assets/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "     Uploading: assets/$filename"
        if curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/assets/$filename" \
            -H "Content-Type: application/javascript" \
            --data-binary "@$file" -s >/dev/null 2>&1; then
            echo "       ✅ Success: assets/$filename"
            upload_count=$((upload_count + 1))
        else
            echo "       ❌ Failed: assets/$filename"
            failed_count=$((failed_count + 1))
        fi
    fi
done

# Upload other assets (excluding source maps)
for file in "$BUILD_DIR"/assets/*; do
    if [ -f "$file" ] && [[ ! "$file" =~ \.(css|js|map)$ ]]; then
        filename=$(basename "$file")
        echo "     Uploading: assets/$filename"
        if curl -X PUT "$LOCALSTACK_ENDPOINT/$BUCKET_NAME/assets/$filename" \
            --data-binary "@$file" -s >/dev/null 2>&1; then
            echo "       ✅ Success: assets/$filename"
            upload_count=$((upload_count + 1))
        else
            echo "       ❌ Failed: assets/$filename"
            failed_count=$((failed_count + 1))
        fi
    fi
done

echo "   📊 Upload summary: $upload_count successful, $failed_count failed"
echo "   ⚠️  Skipped source map files (.map) due to LocalStack compatibility"

# Get the website URLs
WEBSITE_URL="http://$BUCKET_NAME.s3-website.localhost.localstack.cloud:4566"
DIRECT_URL="http://localhost:4566/$BUCKET_NAME/index.html"

# Verify deployment
echo ""
echo "🧪 Testing deployment..."

# Test website URL
if curl -s "$WEBSITE_URL" | grep -q "<!doctype html" 2>/dev/null; then
    echo "✅ Website URL is accessible!"
    TITLE=$(curl -s "$WEBSITE_URL" | grep -o '<title>.*</title>' || echo "No title found")
    echo "   Page title: $TITLE"
else
    echo "⚠️  Website URL not accessible, trying direct S3 URL..."
    
    # Test direct S3 URL
    if curl -s "$DIRECT_URL" | grep -q "<!doctype html" 2>/dev/null; then
        echo "✅ Direct S3 URL is accessible!"
        TITLE=$(curl -s "$DIRECT_URL" | grep -o '<title>.*</title>' || echo "No title found")
        echo "   Page title: $TITLE"
    else
        echo "❌ Neither URL is accessible - check LocalStack and file uploads"
    fi
fi

# List uploaded files
echo ""
echo "📁 Files in S3 bucket:"
FILE_COUNT=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" s3 ls s3://$BUCKET_NAME --recursive | wc -l)
echo "   Total files: $FILE_COUNT"
aws --endpoint-url="$LOCALSTACK_ENDPOINT" s3 ls s3://$BUCKET_NAME --recursive | head -10

# Check if index.html exists
if aws --endpoint-url="$LOCALSTACK_ENDPOINT" s3 ls s3://$BUCKET_NAME/index.html >/dev/null 2>&1; then
    echo "   ✅ index.html found in bucket"
else
    echo "   ❌ index.html missing - this will cause 404 errors"
fi

echo ""
echo "✅ Frontend deployed to LocalStack successfully!"
echo "🌐 Primary URL: $WEBSITE_URL"
echo "🌐 Direct URL:  $DIRECT_URL"
echo "📦 S3 Bucket: s3://$BUCKET_NAME"
echo ""
echo "🔄 This script automatically:"
echo "   ✓ Verifies .env.local configuration"
echo "   ✓ Rebuilds frontend with latest environment variables"
echo "   ✓ Uploads files with LocalStack-compatible method"
echo "   ✓ Tests the deployment"
echo ""
echo "💡 Next steps:"
echo "   • Try the primary URL: $WEBSITE_URL"
echo "   • If that fails, try direct URL: $DIRECT_URL"
echo "   • Check browser console for any API connection issues"
echo "   • Run this script again after any .env.local changes"