# 🧪 Testing Guide - Backend & Frontend URLs

This guide provides comprehensive curl commands and testing scripts for both backend API and frontend URLs.

## 🚀 Quick Start

### **Automated Testing Scripts**

```bash
# Test backend API endpoints
./scripts/test-backend-api.sh dev

# Test frontend URLs and accessibility  
./scripts/test-frontend-urls.sh dev

# Test both backend and frontend
./scripts/test-backend-api.sh dev && ./scripts/test-frontend-urls.sh dev
```

## 🔧 Manual Backend API Testing

### **Get Your API URL**
```bash
cd infrastructure
terraform output api_gateway_url
```

### **Basic Health Check**
```bash
# Replace YOUR_API_URL with actual URL from terraform output
export API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/dev"

# Health check
curl -X GET "$API_URL/health"

# Detailed health check
curl -X GET "$API_URL/health/detailed"
```

### **Authentication Endpoints**

#### **User Registration**
```bash
curl -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User",
    "role": "AUTHOR"
  }'
```

#### **User Login**
```bash
# Login and save response
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }')

echo $LOGIN_RESPONSE

# Extract access token (requires jq)
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
echo "Access Token: $ACCESS_TOKEN"
```

#### **Token Refresh**
```bash
# Extract refresh token
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.refreshToken')

# Refresh access token
curl -X POST "$API_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

#### **Logout**
```bash
curl -X POST "$API_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### **User Management Endpoints**

#### **Get User Profile**
```bash
curl -X GET "$API_URL/users/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### **Update User Profile**
```bash
curl -X PUT "$API_URL/users/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "firstName": "Updated",
    "lastName": "User",
    "preferences": {
      "notifications": true,
      "theme": "dark"
    }
  }'
```

### **Book Management Endpoints**

#### **List Published Books (Public)**
```bash
# All published books
curl -X GET "$API_URL/books"

# Books by genre
curl -X GET "$API_URL/books?genre=fiction"

# Books with pagination
curl -X GET "$API_URL/books?limit=10&offset=0"

# Search books
curl -X GET "$API_URL/books?search=test"
```

#### **Create Book (Authenticated)**
```bash
# Create a new book
BOOK_RESPONSE=$(curl -s -X POST "$API_URL/books" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "title": "My Test Book",
    "description": "A comprehensive guide to API testing",
    "content": "This is the main content of the book. It can be very long and contain multiple chapters...",
    "genre": "non-fiction",
    "tags": ["testing", "api", "guide"]
  }')

echo $BOOK_RESPONSE

# Extract book ID
BOOK_ID=$(echo $BOOK_RESPONSE | jq -r '.bookId')
echo "Book ID: $BOOK_ID"
```

#### **Get Book by ID**
```bash
curl -X GET "$API_URL/books/$BOOK_ID"
```

#### **Update Book**
```bash
curl -X PUT "$API_URL/books/$BOOK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "title": "Updated Book Title",
    "description": "Updated description",
    "tags": ["updated", "testing"]
  }'
```

#### **Submit Book for Editing**
```bash
curl -X POST "$API_URL/books/$BOOK_ID/submit" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### **List User's Books**
```bash
curl -X GET "$API_URL/books/my-books" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### **Delete Book**
```bash
curl -X DELETE "$API_URL/books/$BOOK_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### **Review Endpoints**

#### **Create Review**
```bash
curl -X POST "$API_URL/books/$BOOK_ID/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "rating": 5,
    "comment": "Excellent book! Very informative and well-written."
  }'
```

#### **Get Book Reviews**
```bash
curl -X GET "$API_URL/books/$BOOK_ID/reviews"
```

#### **Update Review**
```bash
curl -X PUT "$API_URL/books/$BOOK_ID/reviews/$REVIEW_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "rating": 4,
    "comment": "Updated review comment."
  }'
```

### **Workflow Endpoints**

#### **Get User Tasks**
```bash
curl -X GET "$API_URL/workflow/my-tasks" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### **Get Book Workflow History**
```bash
curl -X GET "$API_URL/workflow/books/$BOOK_ID/history" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### **Approve/Reject Book (Editor/Publisher)**
```bash
# Approve book
curl -X POST "$API_URL/workflow/books/$BOOK_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "comments": "Book looks good, approved for publication."
  }'

# Reject book
curl -X POST "$API_URL/workflow/books/$BOOK_ID/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "comments": "Please revise the introduction section."
  }'
```

### **Notification Endpoints**

#### **Get User Notifications**
```bash
curl -X GET "$API_URL/notifications" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

#### **Mark Notifications as Read**
```bash
curl -X PUT "$API_URL/notifications/mark-read" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "notificationIds": ["notification-id-1", "notification-id-2"]
  }'
```

### **Error Testing**

#### **Test Error Responses**
```bash
# 404 - Not Found
curl -X GET "$API_URL/nonexistent-endpoint"

# 400 - Bad Request
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# 401 - Unauthorized
curl -X GET "$API_URL/users/profile"

# 403 - Forbidden (with invalid token)
curl -X GET "$API_URL/users/profile" \
  -H "Authorization: Bearer invalid-token"
```

## 🌐 Frontend URL Testing

### **Get Your Frontend URL**
```bash
cd infrastructure

# For CloudFront (deployed environments)
terraform output cloudfront_domain_name

# For S3 website (backup)
terraform output frontend_bucket_website_url
```

### **Basic Frontend Tests**

#### **Home Page**
```bash
export FRONTEND_URL="https://your-cloudfront-domain.cloudfront.net"

# Test home page
curl -I "$FRONTEND_URL"

# Get page content
curl -L "$FRONTEND_URL"
```

#### **SPA Routes**
```bash
# All these should return the same index.html (SPA routing)
curl -L "$FRONTEND_URL/"
curl -L "$FRONTEND_URL/login"
curl -L "$FRONTEND_URL/dashboard"
curl -L "$FRONTEND_URL/books"
curl -L "$FRONTEND_URL/profile"
curl -L "$FRONTEND_URL/nonexistent-route"
```

#### **Static Assets**
```bash
# Test common assets
curl -I "$FRONTEND_URL/static/css/main.css"
curl -I "$FRONTEND_URL/static/js/main.js"
curl -I "$FRONTEND_URL/favicon.ico"
curl -I "$FRONTEND_URL/manifest.json"
```

#### **Security Headers**
```bash
# Check security headers
curl -I "$FRONTEND_URL" | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security|Content-Security-Policy)"
```

### **Performance Testing**
```bash
# Measure page load time
curl -w "@curl-format.txt" -o /dev/null -s "$FRONTEND_URL"

# Create curl-format.txt file:
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF
```

## 🔄 Complete Testing Workflow

### **Full End-to-End Test**
```bash
#!/bin/bash

# Get URLs from Terraform
cd infrastructure
API_URL=$(terraform output -raw api_gateway_url)
FRONTEND_URL="https://$(terraform output -raw cloudfront_domain_name)"

echo "Testing URLs:"
echo "API: $API_URL"
echo "Frontend: $FRONTEND_URL"

# 1. Test API health
echo "1. Testing API health..."
curl -f "$API_URL/health" || echo "API health check failed"

# 2. Test frontend accessibility
echo "2. Testing frontend accessibility..."
curl -f -I "$FRONTEND_URL" || echo "Frontend accessibility failed"

# 3. Test user registration and login
echo "3. Testing user registration..."
curl -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "e2e-test@example.com",
    "password": "TestPassword123!",
    "firstName": "E2E",
    "lastName": "Test",
    "role": "AUTHOR"
  }'

echo "4. Testing user login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "e2e-test@example.com",
    "password": "TestPassword123!"
  }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

# 5. Test authenticated endpoints
echo "5. Testing authenticated endpoints..."
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$API_URL/users/profile"

echo "✅ End-to-end test completed!"
```

## 🛠️ Troubleshooting

### **Common Issues**

#### **CORS Errors**
```bash
# Test CORS preflight
curl -X OPTIONS "$API_URL/auth/login" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization"
```

#### **SSL/TLS Issues**
```bash
# Skip SSL verification (for testing only)
curl -k "$FRONTEND_URL"

# Check SSL certificate
curl -vI "$FRONTEND_URL" 2>&1 | grep -E "(SSL|TLS|certificate)"
```

#### **Timeout Issues**
```bash
# Increase timeout
curl --connect-timeout 30 --max-time 60 "$API_URL/health"
```

### **Debug Commands**

#### **Verbose Output**
```bash
# Verbose curl output
curl -v "$API_URL/health"

# Include response headers
curl -i "$API_URL/health"

# Show timing information
curl -w "@curl-format.txt" "$API_URL/health"
```

#### **Save Response to File**
```bash
# Save response body
curl "$API_URL/books" -o books-response.json

# Save response headers
curl -D headers.txt "$API_URL/health"
```

## 📊 Monitoring and Alerts

### **Health Check Monitoring**
```bash
# Create a simple health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
API_URL="your-api-url"
FRONTEND_URL="your-frontend-url"

# Check API
if curl -f -s "$API_URL/health" > /dev/null; then
    echo "✅ API is healthy"
else
    echo "❌ API is down"
fi

# Check Frontend
if curl -f -s -I "$FRONTEND_URL" > /dev/null; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is down"
fi
EOF

chmod +x health-check.sh
```

### **Automated Testing with cron**
```bash
# Add to crontab for regular testing
# Run health checks every 5 minutes
*/5 * * * * /path/to/health-check.sh

# Run full API tests daily
0 6 * * * /path/to/scripts/test-backend-api.sh prod
```

This comprehensive testing guide gives you all the curl commands and scripts needed to thoroughly test both your backend API and frontend URLs! 🚀