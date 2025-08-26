# Infrastructure Testing Guide

This guide provides comprehensive testing procedures and curl commands for validating the Ebook Publishing Platform infrastructure.

## Quick Testing Commands

### Health Check Commands

```bash
# Test LocalStack health
curl -s http://localhost:4566/health | jq '.'

# Test API Gateway health (replace with actual API ID)
curl -s "http://localhost:4566/restapis/[API-ID]/local/_user_request_/health" | jq '.'

# Test production API health
curl -s "https://[API-GATEWAY-URL]/health" | jq '.'
```

### Authentication Testing

```bash
# Register a new user
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "AUTHOR"
  }' | jq '.'

# Login user
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq '.'

# Refresh token (replace [REFRESH_TOKEN] with actual token)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "[REFRESH_TOKEN]"
  }' | jq '.'

# Logout
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/auth/logout" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'
```

### Book Management Testing

```bash
# Create a new book (requires AUTHOR role)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/books" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "title": "My Test Book",
    "description": "A test book for the platform",
    "content": "This is the content of my test book...",
    "genre": "fiction",
    "tags": ["test", "fiction", "demo"]
  }' | jq '.'

# List all books
curl -X GET "http://localhost:4566/restapis/[API-ID]/local/_user_request_/books" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'

# Get specific book
curl -X GET "http://localhost:4566/restapis/[API-ID]/local/_user_request_/books/[BOOK_ID]" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'

# Update book (requires ownership or EDITOR role)
curl -X PUT "http://localhost:4566/restapis/[API-ID]/local/_user_request_/books/[BOOK_ID]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "title": "Updated Book Title",
    "description": "Updated description",
    "content": "Updated content..."
  }' | jq '.'

# Delete book (requires ownership)
curl -X DELETE "http://localhost:4566/restapis/[API-ID]/local/_user_request_/books/[BOOK_ID]" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'
```

### User Management Testing

```bash
# Get user profile
curl -X GET "http://localhost:4566/restapis/[API-ID]/local/_user_request_/users/profile" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'

# Update user profile
curl -X PUT "http://localhost:4566/restapis/[API-ID]/local/_user_request_/users/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "firstName": "Updated",
    "lastName": "Name",
    "preferences": {
      "notifications": true,
      "theme": "dark",
      "language": "en"
    }
  }' | jq '.'
```

### Review System Testing

```bash
# Create a review (requires READER role and published book)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "bookId": "[BOOK_ID]",
    "rating": 5,
    "comment": "Excellent book! Highly recommended."
  }' | jq '.'

# Get reviews for a book
curl -X GET "http://localhost:4566/restapis/[API-ID]/local/_user_request_/reviews?bookId=[BOOK_ID]" | jq '.'

# Update review (requires ownership)
curl -X PUT "http://localhost:4566/restapis/[API-ID]/local/_user_request_/reviews/[REVIEW_ID]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "rating": 4,
    "comment": "Updated review comment"
  }' | jq '.'
```

### Workflow Testing

```bash
# Submit book for editing (AUTHOR → EDITOR)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/workflow/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "bookId": "[BOOK_ID]",
    "comments": "Ready for editorial review"
  }' | jq '.'

# Approve book for publication (EDITOR → PUBLISHER)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/workflow/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "bookId": "[BOOK_ID]",
    "comments": "Editorial review complete, approved for publication"
  }' | jq '.'

# Publish book (PUBLISHER → PUBLISHED)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/workflow/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "bookId": "[BOOK_ID]",
    "comments": "Book published successfully"
  }' | jq '.'

# Reject book (any workflow state → previous state)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/workflow/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -d '{
    "bookId": "[BOOK_ID]",
    "comments": "Needs revision before proceeding",
    "feedback": "Please address the following issues..."
  }' | jq '.'
```

### Notification Testing

```bash
# Get user notifications
curl -X GET "http://localhost:4566/restapis/[API-ID]/local/_user_request_/notifications" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'

# Mark notification as read
curl -X PUT "http://localhost:4566/restapis/[API-ID]/local/_user_request_/notifications/[NOTIFICATION_ID]/read" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'
```

## CORS Testing

```bash
# Test CORS preflight request
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With,Content-Type,Authorization" \
     -X OPTIONS \
     "http://localhost:4566/restapis/[API-ID]/local/_user_request_/auth/login"

# Test CORS with actual request
curl -H "Origin: http://localhost:3000" \
     -H "Content-Type: application/json" \
     -X POST \
     "http://localhost:4566/restapis/[API-ID]/local/_user_request_/health"
```

## Error Testing

```bash
# Test invalid authentication
curl -X GET "http://localhost:4566/restapis/[API-ID]/local/_user_request_/books" \
  -H "Authorization: Bearer invalid-token" | jq '.'

# Test missing required fields
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}' | jq '.'

# Test invalid book ID
curl -X GET "http://localhost:4566/restapis/[API-ID]/local/_user_request_/books/invalid-id" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" | jq '.'

# Test unauthorized access (wrong role)
curl -X POST "http://localhost:4566/restapis/[API-ID]/local/_user_request_/workflow/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [AUTHOR_TOKEN]" \
  -d '{"bookId": "[BOOK_ID]"}' | jq '.'
```

## Performance Testing

```bash
# Test API response times
time curl -s "http://localhost:4566/restapis/[API-ID]/local/_user_request_/health" > /dev/null

# Test concurrent requests (requires GNU parallel)
seq 1 10 | parallel -j 10 curl -s "http://localhost:4566/restapis/[API-ID]/local/_user_request_/health"

# Load testing with Apache Bench (if available)
ab -n 100 -c 10 "http://localhost:4566/restapis/[API-ID]/local/_user_request_/health"
```

## Infrastructure Validation

### LocalStack Testing

```bash
# Check LocalStack services
curl -s http://localhost:4566/health | jq '.services'

# List DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# List S3 buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List Lambda functions
aws --endpoint-url=http://localhost:4566 lambda list-functions

# List API Gateways
aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis

# List SNS topics
aws --endpoint-url=http://localhost:4566 sns list-topics

# List SQS queues
aws --endpoint-url=http://localhost:4566 sqs list-queues
```

### AWS Production Testing

```bash
# Check DynamoDB table
aws dynamodb describe-table --table-name [TABLE_NAME]

# Check Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `dev-`)]'

# Check API Gateway
aws apigateway get-rest-apis --query 'items[?name==`dev-ebook-api`]'

# Check S3 buckets
aws s3 ls | grep ebook

# Check CloudFront distributions
aws cloudfront list-distributions --query 'DistributionList.Items[?Comment==`dev Ebook Platform Frontend Distribution`]'

# Check SNS topics
aws sns list-topics --query 'Topics[?contains(TopicArn, `ebook`)]'

# Check SQS queues
aws sqs list-queues --query 'QueueUrls[?contains(@, `ebook`)]'
```

## Automated Testing Scripts

### Complete Workflow Test

```bash
#!/bin/bash
# test-complete-workflow.sh

API_BASE="http://localhost:4566/restapis/[API-ID]/local/_user_request_"

echo "=== Testing Complete Ebook Platform Workflow ==="

# 1. Register Author
echo "1. Registering author..."
AUTHOR_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "author@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "Author",
    "role": "AUTHOR"
  }')

AUTHOR_TOKEN=$(echo $AUTHOR_RESPONSE | jq -r '.accessToken')
echo "Author registered with token: ${AUTHOR_TOKEN:0:20}..."

# 2. Create Book
echo "2. Creating book..."
BOOK_RESPONSE=$(curl -s -X POST "$API_BASE/books" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTHOR_TOKEN" \
  -d '{
    "title": "Test Book",
    "description": "A test book",
    "content": "This is test content...",
    "genre": "fiction",
    "tags": ["test"]
  }')

BOOK_ID=$(echo $BOOK_RESPONSE | jq -r '.bookId')
echo "Book created with ID: $BOOK_ID"

# 3. Register Editor
echo "3. Registering editor..."
EDITOR_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "Editor",
    "role": "EDITOR"
  }')

EDITOR_TOKEN=$(echo $EDITOR_RESPONSE | jq -r '.accessToken')
echo "Editor registered with token: ${EDITOR_TOKEN:0:20}..."

# 4. Submit for Editing
echo "4. Submitting book for editing..."
curl -s -X POST "$API_BASE/workflow/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTHOR_TOKEN" \
  -d "{\"bookId\": \"$BOOK_ID\", \"comments\": \"Ready for review\"}" | jq '.'

# 5. Approve Book
echo "5. Approving book..."
curl -s -X POST "$API_BASE/workflow/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EDITOR_TOKEN" \
  -d "{\"bookId\": \"$BOOK_ID\", \"comments\": \"Approved for publication\"}" | jq '.'

# 6. Register Publisher
echo "6. Registering publisher..."
PUBLISHER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "publisher@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "Publisher",
    "role": "PUBLISHER"
  }')

PUBLISHER_TOKEN=$(echo $PUBLISHER_RESPONSE | jq -r '.accessToken')
echo "Publisher registered with token: ${PUBLISHER_TOKEN:0:20}..."

# 7. Publish Book
echo "7. Publishing book..."
curl -s -X POST "$API_BASE/workflow/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PUBLISHER_TOKEN" \
  -d "{\"bookId\": \"$BOOK_ID\", \"comments\": \"Book published\"}" | jq '.'

# 8. Register Reader
echo "8. Registering reader..."
READER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "reader@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "Reader",
    "role": "READER"
  }')

READER_TOKEN=$(echo $READER_RESPONSE | jq -r '.accessToken')
echo "Reader registered with token: ${READER_TOKEN:0:20}..."

# 9. Create Review
echo "9. Creating review..."
curl -s -X POST "$API_BASE/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $READER_TOKEN" \
  -d "{\"bookId\": \"$BOOK_ID\", \"rating\": 5, \"comment\": \"Great book!\"}" | jq '.'

echo "=== Workflow test completed successfully! ==="
```

### Performance Test Script

```bash
#!/bin/bash
# performance-test.sh

API_BASE="http://localhost:4566/restapis/[API-ID]/local/_user_request_"

echo "=== Performance Testing ==="

# Test health endpoint performance
echo "Testing health endpoint..."
for i in {1..10}; do
  start_time=$(date +%s%N)
  curl -s "$API_BASE/health" > /dev/null
  end_time=$(date +%s%N)
  duration=$(( (end_time - start_time) / 1000000 ))
  echo "Request $i: ${duration}ms"
done

# Test concurrent requests
echo "Testing concurrent requests..."
seq 1 20 | xargs -n1 -P10 -I{} curl -s "$API_BASE/health" > /dev/null
echo "20 concurrent requests completed"
```

## Troubleshooting Commands

```bash
# Check LocalStack logs
docker-compose logs localstack

# Check specific service logs
aws --endpoint-url=http://localhost:4566 logs describe-log-groups
aws --endpoint-url=http://localhost:4566 logs describe-log-streams --log-group-name /aws/lambda/dev-auth-service

# Test DynamoDB connectivity
aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name dev-ebook-platform --limit 1

# Test S3 connectivity
aws --endpoint-url=http://localhost:4566 s3 ls s3://dev-ebook-frontend-[suffix]/

# Check API Gateway configuration
aws --endpoint-url=http://localhost:4566 apigateway get-resources --rest-api-id [API-ID]
```

## Environment-Specific Testing

### Local Environment (LocalStack)
- Use `http://localhost:4566` as the base URL
- All AWS services are mocked
- No real costs incurred
- Perfect for development and testing

### Development Environment (AWS)
- Use actual AWS API Gateway URLs
- Real AWS services with Free Tier limits
- Monitor usage to stay within limits
- Test with production-like data

### Production Environment (AWS)
- Use production API Gateway URLs
- Full production setup
- Monitor performance and costs
- Use production data carefully

## Monitoring and Metrics

```bash
# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Check API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Check DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

This comprehensive testing guide ensures that all aspects of the infrastructure are properly validated and working as expected.