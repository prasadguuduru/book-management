# Ebook Publishing Platform - Local Development Setup

A comprehensive guide to set up and run the serverless ebook publishing platform locally using LocalStack.

## 🏗 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Lambda APIs   │    │   LocalStack    │
│   (React/Vite)  │    │   (Node.js)     │    │   (AWS Mock)    │
│   Port: 3000    │◄──►│   Port: 4566    │◄──►│   Port: 4566    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- **Node.js 18+** and **npm 9+**
- **Docker** and **Docker Compose**
- **AWS CLI** (configured with dummy credentials for LocalStack)
- **Terraform** (for infrastructure deployment)
- **jq** (for JSON processing in tests)


## 🚀 Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd book-management
npm install
```

### 2. Environment Setup

```bash
# Set up LocalStack environment variables
./scripts/setup-localstack-env.sh
```

**Expected Output:**
```
[INFO] Setting up LocalStack environment variables...
[SUCCESS] LocalStack environment variables set:
  AWS_ENDPOINT_URL=http://localhost:4566
  AWS_ACCESS_KEY_ID=test
  AWS_DEFAULT_REGION=us-east-1
  TF_VAR_aws_endpoint_url=http://localhost:4566
```

### 3. Build Frontend

```bash
# Build frontend for local development
npm run build:frontend:local
```

**Expected Output:**
```
> ebook-publishing-platform@1.0.0 build:frontend:local
> source .env.local 2>/dev/null || true && ./scripts/build-deployment.sh local frontend

[INFO] Building frontend for local development...
✓ 980 modules transformed.
dist/index.html                   0.91 kB │ gzip:  0.43 kB
dist/assets/index-CMgrDBBv.css    0.95 kB │ gzip:  0.52 kB
[SUCCESS] Frontend build completed successfully
```

### 4. Start LocalStack Services

```bash
# Start LocalStack and DynamoDB Admin
npm run localstack:start
```

**Expected Output:**
```
> ebook-publishing-platform@1.0.0 localstack:start
> docker-compose up -d

[+] Running 2/2
 ✔ Container ebook-platform-localstack      Started
 ✔ Container ebook-platform-dynamodb-admin  Started
```

### 5. Wait for LocalStack Ready

```bash
# Wait for LocalStack to be fully ready
npm run localstack:wait
```

**Expected Output:**
```
> ebook-publishing-platform@1.0.0 localstack:wait
> node scripts/wait-for-localstack.js

🔄 Waiting for LocalStack to be ready...
� Tohis may take a few minutes on first startup...
✅ LocalStack container is healthy, proceeding...
🌐 LocalStack Dashboard: http://localhost:4566
```

### 6. Create DynamoDB Table

```bash
# Create the main DynamoDB table
node scripts/create-table.js
```

**Expected Output:**
```
📊 Creating DynamoDB table...
✅ DynamoDB table created successfully
📊 Table ARN: arn:aws:dynamodb:us-east-1:000000000000:table/ebook-platform-data
⏳ Waiting for table to be active...
✅ Table is now active
```


### 7. Verify DynamoDB Setup

```bash
# Verify table creation
aws dynamodb list-tables --endpoint-url=http://localhost:4566 --region=us-east-1
```

**Expected Output:**
```json
{
    "TableNames": [
        "ebook-platform-data"
    ]
}
```

### 8. Seed Test Data

```bash
# Populate database with test data
npm run seed:data
```

**Expected Output:**
```
> ebook-publishing-platform@1.0.0 seed:data
> node scripts/smart-seed-data.js local

🌱 Starting comprehensive LocalStack data seeding...
� Target Btable: ebook-platform-data
✅ DynamoDB connection successful
🏗️  Generating mock data...
📊 Generated: 10 users, 8 books, 7 reviews, 19 workflow entries, 3 sessions, 5 notifications
👥 Seeding users...
✅ Seeded 10 users
📚 Seeding books...
✅ Seeded 8 books
⭐ Seeding reviews...
✅ Seeded 7 reviews
� Seedring workflow entries...
✅ Seeded 19 workflow entries
🔐 Seeding user sessions...
✅ Seeded 3 sessions
🔔 Seeding notifications...
✅ Seeded 5 notifications

🎉 LocalStack data seeding completed successfully!

� Testi Users (password: password123):
   📝 Authors: john.author@example.com, sarah.writer@example.com
   ✏️  Editors: jane.editor@example.com, david.reviewer@example.com
   📖 Publishers: lisa.publisher@example.com, robert.publications@example.com
   👀 Readers: alice.reader@example.com, bob.bookworm@example.com
```

### 9. Deploy Infrastructure

```bash
# Set AWS credentials for LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

# Deploy infrastructure using Terraform
./scripts/simple-localstack-deploy.sh
```

**Expected Output:**
```
🚀 Simple LocalStack deployment...
Starting LocalStack...
[+] Running 1/1
 ✔ Container ebook-platform-localstack  Running
Waiting for LocalStack...
LocalStack is ready!
Switched to workspace "local".
Initializing the backend...
Terraform has been successfully initialized!
Applying Terraform configuration...
✅ Deployment completed!
```

### 10. Deploy Frontend and Backend

```bash
# Deploy frontend to LocalStack S3
./scripts/deploy-frontend-localstack.sh
```

**Expected Output:**
```
✅ Frontend deployed to LocalStack successfully!
🌐 Primary URL: http://ebook-frontend-local.s3-website.localhost.localstack.cloud:4566
🌐 Direct URL:  http://localhost:4566/ebook-frontend-local/index.html
📦 S3 Bucket: s3://ebook-frontend-local
```

```bash
# Deploy backend Lambda functions
./scripts/deploy-backend-complete.sh --force-rebuild
```

**Expected Output:**
```
🎉 Backend deployment completed successfully!

📋 Deployment Details:
   • Environment: local
   • API Gateway ID: bk4bjp76p0
   • Lambda Functions: 6 deployed
   • API Integrations: Updated
   • Frontend Config: Updated

🌐 API Endpoints:
   • Base URL: http://localhost:4566/restapis/bk4bjp76p0/local/_user_request_
   • Auth: POST /api/auth
   • Books: GET/POST /api/books
   • Users: GET /api/users
   • Reviews: GET /api/reviews
   • Workflow: POST /api/workflow
   • Notifications: GET /api/notifications
```




## 🧪 Testing & Verification

### 11. Run Comprehensive Tests

```bash
# Run core functionality tests
./test-qa-core-functionality.sh

# Run business logic tests
./test-qa-business-logic.sh
```

### 12. Manual API Testing

```bash
# Test authentication
curl -X POST http://localhost:4566/restapis/{API_ID}/local/_user_request_/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john.author@example.com", "password": "password123"}'

# Test book creation (replace {TOKEN} with actual token)
curl -X POST http://localhost:4566/restapis/{API_ID}/local/_user_request_/api/books \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {TOKEN}" \
  -d '{
    "title": "My Test Book",
    "description": "A test book for local development",
    "content": "This is the content of my test book.",
    "genre": "fiction",
    "tags": ["test", "local"]
  }'
```

### 13. Start Development Server

```bash
# Start frontend development server
npm run dev:frontend
```

**Access Points:**
- **Frontend Dev Server**: http://localhost:3000
- **Frontend S3 Static**: http://ebook-frontend-local.s3-website.localhost.localstack.cloud:4566
- **API Gateway**: http://localhost:4566/restapis/{API_ID}/local/_user_request_
- **DynamoDB Admin**: http://localhost:8001
- **LocalStack Dashboard**: http://localhost:4566

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/auth/health` | Health check | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/register` | User registration | No |
| POST | `/api/auth/refresh` | Refresh token | Yes |
| POST | `/api/auth/logout` | User logout | Yes |

### Book Management Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/books` | List all books | Yes | All |
| GET | `/api/books/my-books` | Get user's books | Yes | Author |
| GET | `/api/books/published` | Get published books | Yes | All |
| GET | `/api/books/status/{status}` | Get books by status | Yes | Editor, Publisher |
| GET | `/api/books/genre/{genre}` | Get books by genre | Yes | All |
| GET | `/api/books/{id}` | Get specific book | Yes | All |
| POST | `/api/books` | Create new book | Yes | Author |
| PUT | `/api/books/{id}` | Update book | Yes | Author (own books) |
| DELETE | `/api/books/{id}` | Delete book | Yes | Author (own books) |
| POST | `/api/books/{id}/submit` | Submit for editing | Yes | Author |
| POST | `/api/books/{id}/approve` | Approve book | Yes | Editor |
| POST | `/api/books/{id}/publish` | Publish book | Yes | Publisher |

### User Management Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/users` | List users | Yes | Admin |
| GET | `/api/users/profile` | Get user profile | Yes | All |
| PUT | `/api/users/profile` | Update profile | Yes | All |

### Review Endpoints

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/books/{id}/reviews` | Get book reviews | Yes | All |
| POST | `/api/books/{id}/reviews` | Create review | Yes | Reader |
| PUT | `/api/reviews/{id}` | Update review | Yes | Reader (own) |
| DELETE | `/api/reviews/{id}` | Delete review | Yes | Reader (own) |

## � Dedvelopment Commands

```bash
# Environment Management
npm run setup                    # Complete environment setup
npm run localstack:start        # Start LocalStack
npm run localstack:stop         # Stop LocalStack
npm run localstack:wait         # Wait for LocalStack ready
npm run localstack:reset        # Reset LocalStack data

# Database Operations
npm run db:create               # Create DynamoDB table
npm run seed:data              # Seed test data
npm run seed:data:local        # Seed local environment data

# Building
npm run build                  # Build all services
npm run build:frontend:local   # Build frontend for local
npm run build:lambda:local     # Build Lambda packages

# Development
npm run dev                    # Start both frontend and backend
npm run dev:frontend          # Frontend development server
npm run dev:backend           # Backend services

# Testing
npm run test                   # Run all tests
npm run test:coverage         # Run tests with coverage
npm run lint                  # Lint all code
npm run type-check           # TypeScript type checking

# Deployment (Local)
./scripts/deploy-frontend-localstack.sh    # Deploy frontend to S3
./scripts/deploy-backend-complete.sh       # Deploy Lambda functions
./scripts/quick-s3-deploy.sh              # Quick frontend deployment
```

## 👥 Quick Login (Development Mode)

All test users have the password: `password123`

### Author
- `john.author@example.com` - John Steinberg (has books)

### Editor
- `jane.editor@example.com` - Jane Editor

### Publisher
- `lisa.publisher@example.com` - Lisa Publisher

### Reader
- `alice.reader@example.com` - Alice Reader

## 🔍 Troubleshooting

### Common Issues

1. **LocalStack not starting**
   ```bash
   docker-compose down
   docker-compose up -d
   npm run localstack:wait
   ```

2. **DynamoDB table already exists**
   ```bash
   aws dynamodb delete-table --table-name ebook-platform-data --endpoint-url=http://localhost:4566
   node scripts/create-table.js
   ```

3. **Lambda deployment fails**
   ```bash
   ./scripts/deploy-backend-complete.sh --force-rebuild
   ```

4. **Frontend not loading**
   ```bash
   npm run build:frontend:local
   ./scripts/deploy-frontend-localstack.sh
   ```

### Verification Commands

```bash
# Check LocalStack health
curl -s http://localhost:4566/health

# List DynamoDB tables
aws dynamodb list-tables --endpoint-url=http://localhost:4566

# Check API Gateway
aws apigateway get-rest-apis --endpoint-url=http://localhost:4566

# Test authentication
curl -X POST http://localhost:4566/restapis/{API_ID}/local/_user_request_/api/auth/health

# Check S3 buckets
aws s3 ls --endpoint-url=http://localhost:4566
```

## 🎯 Next Steps

1. **Access the application** at http://localhost:3000
2. **Login** with any test user account
3. **Create books** as an author
4. **Test the workflow** (Draft → Submit → Approve → Publish)
5. **Run comprehensive tests** to verify functionality
6. **Explore the API** using the provided curl commands

## 📖 Additional Resources

- **API Specification**: Check the `/docs` folder for OpenAPI specs
- **Architecture Documentation**: See `02-ARCHITECTURE.md`
- **Deployment Guide**: See `08-DEPLOYMENT.md`
- **Testing Guide**: See `TESTING_GUIDE.md`pe: application/javascript)...
✅ Uploaded assets/index-DRZxXOSw.js
📤 Uploading assets/index-DRZxXOSw.js.map (Content-Type: application/octet-stream)...
✅ Uploaded assets/index-DRZxXOSw.js.map
📤 Uploading assets/router-D4t3HtPh.js (Content-Type: application/javascript)...
✅ Uploaded assets/router-D4t3HtPh.js
📤 Uploading assets/router-D4t3HtPh.js.map (Content-Type: application/octet-stream)...
✅ Uploaded assets/router-D4t3HtPh.js.map
📤 Uploading assets/state-BXkRX6nb.js (Content-Type: application/javascript)...
✅ Uploaded assets/state-BXkRX6nb.js
📤 Uploading assets/state-BXkRX6nb.js.map (Content-Type: application/octet-stream)...
✅ Uploaded assets/state-BXkRX6nb.js.map
📤 Uploading assets/ui-B-_6OcuV.js (Content-Type: application/javascript)...
✅ Uploaded assets/ui-B-_6OcuV.js
📤 Uploading assets/ui-B-_6OcuV.js.map (Content-Type: application/octet-stream)...
✅ Uploaded assets/ui-B-_6OcuV.js.map
📤 Uploading assets/vendor-CwczGxAq.js (Content-Type: application/javascript)...
✅ Uploaded assets/vendor-CwczGxAq.js
📤 Uploading assets/vendor-CwczGxAq.js.map (Content-Type: application/octet-stream)...
✅ Uploaded assets/vendor-CwczGxAq.js.map
✅ Uploaded 12 files
🔓 Setting public access policy...
🧪 Testing deployment...
✅ Deployment test successful (HTTP 200)
📄 Content preview:
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
🎉 Frontend deployed successfully!

📍 Access URLs:
   🌐 Primary: http://localhost:4566/ebook-frontend-local/index.html
   🌐 Direct S3: http://localhost:4566/ebook-frontend-local/index.html
   🌐 Website: http://ebook-frontend-local.s3-website.localhost.localstack.cloud:4566

🔧 Development URLs:
   🚀 Dev Server: http://localhost:3000 (npm run dev:frontend)
   🔌 Backend API: http://localhost:3001/api
   🏥 Health Check: http://localhost:3001/health
   🗄️  DynamoDB Admin: http://localhost:8001

🧪 Quick Tests:
   curl -s http://localhost:4566/ebook-frontend-local/index.html | head -5
   curl -s http://localhost:3001/health | jq .

💡 Tips:
   • Use --force to force rebuild: ./scripts/quick-s3-deploy.sh --force
   • Use --skip-build to deploy existing build: ./scripts/quick-s3-deploy.sh --skip-build
   • Use --verbose for detailed output: ./scripts/quick-s3-deploy.sh --verbose
   • For development with hot reload: npm run dev:frontend
   • For backend development: npm run dev:backend
🎉 Deployment complete!
```
## Step 18:

Open below url based on prior command output. 

http://ebook-frontend-local.s3-website.localhost.localstack.cloud:4566/login




prasadguuduru@Prasads-MacBook-Pro book-management % aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis
{
    "items": [
        {
            "id": "bk4bjp76p0",
            "name": "local-ebook-api",
            "description": "Ebook Publishing Platform REST API",
            "createdDate": "2025-08-25T20:27:16-07:00",
            "binaryMediaTypes": [
                "application/octet-stream",
                "image/*",
                "multipart/form-data"
            ],
            "apiKeySource": "HEADER",
            "endpointConfiguration": {
                "types": [
                    "REGIONAL"
                ]
            },
            "tags": {
                "Type": "rest-api",
                "Component": "api-gateway",
                "Environment": "local",
                "ManagedBy": "terraform",
                "Project": "ebook-platform"
            },
            "disableExecuteApiEndpoint": false
        }
    ]
}



aws --endpoint-url=http://localhost:4566 apigateway get-deployments --rest-api-id bk4bjp76p0

aws --endpoint-url=http://localhost:4566 apigateway get-stages --rest-api-id bk4bjp76p0


curl -s "http://localhost:4566/restapis/bk4bjp76p0/local/_user_request_/api/auth" -X POST -H "Content-Type: application/json" -d '{"email": "test@example.com", "password": "test123"}' | jq '.'


curl -s "http://localhost:4566/restapis/bk4bjp76p0/local/_user_request_/api/books" | jq '.'


prasadguuduru@Prasads-MacBook-Pro book-management % aws --endpoint-url=http://localhost:4566 apigateway get-resources --rest-api-id bk4bjp76p0
```
    "items": [
        {
            "id": "ffzuryt1bj",
            "parentId": "5t6emr2w23",
            "pathPart": "api",
            "path": "/api"
        },
        {
            "id": "3maf1wswc4",
            "parentId": "ffzuryt1bj",
            "pathPart": "workflow",
            "path": "/api/workflow",
            "resourceMethods": {

            }
        }
```

email: jane.editor@example.com

password: password123

# 1. Stop everything
npm run localstack:stop
pkill -f "node.*backend"
pkill -f "node.*frontend"

# 2. Start LocalStack
npm run localstack:start
sleep 10

# 3. Start backend (new terminal)
npm run dev:backend

# 4. Start frontend (new terminal)  
npm run dev:frontend

# 5. Test endpoints
curl http://localhost:4566/health
curl http://localhost:3001/health
curl http://localhost:3000/


## Deploy to QA
```
npm run build:qa
npm run build:lambda:qa

export AWS_DEFAULT_REGION=us-east-1
aws configure set region us-east-1
 terraform plan  -var-file=qa.tfvars
 terraform apply  -var-file=qa.tfvars -auto-approve
```

prasadguuduru@Prasads-MacBook-Pro book-management % npm run build:lambda:qa
```
> ebook-publishing-platform@1.0.0 build:lambda:qa
> ./scripts/build-lambda-packages.sh qa

🏗️  Building Lambda packages for qa environment...
📋 Loading backend environment variables from backend/.env.qa
📁 Creating distribution directory...
🧹 Cleaning previous builds...
🔨 Building TypeScript backend...
📦 Installing backend dependencies...
npm warn deprecated @types/helmet@4.0.0: This is a stub types definition. helmet provides its own type definitions, so you do not need this installed.
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
npm warn deprecated querystring@0.2.0: The querystring API is considered Legacy. new code should use the URLSearchParams API instead.
npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 602 packages, and audited 604 packages in 3s

93 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
⚙️  Compiling TypeScript...
🚀 Building Lambda packages...
📦 Creating package for ${LAMBDA_SERVICES[@]}...
📦 Installing production dependencies for ${LAMBDA_SERVICES[@]}...
```

prasadguuduru@Prasads-MacBook-Pro book-management % ./scripts/update-lambda-code-direct.sh

```
🚀 Direct Lambda deployment for QA...
📦 Building auth-service...
✅ Created tmp/auth-service.zip
📦 Building book-service...
✅ Created tmp/book-service.zip
📦 Building user-service...
✅ Created tmp/user-service.zip
📦 Building workflow-service...
✅ Created tmp/workflow-service.zip
📦 Building review-service...
✅ Created tmp/review-service.zip
📦 Building notification-service...
✅ Created tmp/notification-service.zip
🚀 Deploying to AWS Lambda...
Updating qa-auth-service...
✅ Updated qa-auth-service
Updating qa-book-service...
✅ Updated qa-book-service
Updating qa-user-service...
✅ Updated qa-user-service
Updating qa-workflow-service...
✅ Updated qa-workflow-service
Updating qa-review-service...
✅ Updated qa-review-service
Updating qa-notification-service...
✅ Updated qa-notification-service
📋 Verifying deployment...
-------------------------------------------------------------
|                       ListFunctions                       |
+-------------------------------+---------------------------+
|           Modified            |           Name            |
+-------------------------------+---------------------------+
|  2025-08-26T07:37:07.000+0000 |  qa-notification-service  |
|  2025-08-26T07:37:05.000+0000 |  qa-workflow-service      |
|  2025-08-26T07:37:02.000+0000 |  qa-book-service          |
|  2025-08-26T07:37:04.000+0000 |  qa-user-service          |
|  2025-08-26T07:37:01.000+0000 |  qa-auth-service          |
|  2025-08-26T07:37:06.000+0000 |  qa-review-service        |
+-------------------------------+---------------------------+
✅ Direct deployment completed!

```

./scripts/deploy-frontend-qa.sh
```
https://7tmom26ucc.cloudfront.net/login
http://qa-ebook-frontend-96c175f3.s3-website-us-east-1.amazonaws.com/index.html
```


npm run build:lambda:qa
./scripts/update-lambda-code-direct.sh
./scripts/deploy-frontend-qa.sh

./scripts/deploy-frontend-qa.sh

VITE_ENVIRONMENT=qa && npm run build:qa      
VITE_ENVIRONMENT=local npm run build
VITE_ENVIRONMENT=local npm run build:frontend:local
 ./scripts/build-deployment.sh local
npm run build:lambda:local
 ./scripts/deploy-backend-complete.sh --force-rebuild


 node frontend/test-integration.js



 ./scripts/build-deployment.sh qa frontend                                                        


terraform workspace list
terraform workspace select local
npm run build:qa
npm run build:lambda:qa
./scripts/deploy-frontend-qa.sh
./scripts/update-lambda-code-direct.sh

https://7tmom26ucc.cloudfront.net/dashboard

http://qa-ebook-frontend-96c175f3.s3-website-us-east-1.amazonaws.com/login

npm run seed:data (for poulating seed data)
DYNAMODB_TABLE_NAME=ebook-platform-local npm run seed:data

DYNAMODB_TABLE_NAME=qa-ebook-platform-42611dbe AWS_REGION=us-east-1 npm run seed:data:qa


S3: Bucket
http://qa-ebook-frontend-96c175f3.s3-website-us-east-1.amazonaws.com


The most common workflow for QA deployment would be:

npm run build:qa - Build everything
npm run deploy:qa - Deploy everything
node scripts/check-qa-deployment-status.js - Verify deployment
Or for individual components:

Frontend: npm run build:frontend:qa
Backend: npm run deploy:lambda:qa


npm run build:qa 




VITE_APIGATEWAY_URL=qa && npm run build:qa   


curl -X GET "https://7tmom26ucc.execute-api.us-east-1.amazonaws.com/qa/api/books" -H "Authorization: Bearer test-token"


./test-cloudfront-auth-flow.sh


curl -X POST 'https://d2xg2iv1qaydac.cloudfront.net/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "author1@example.com",
    "password": "password123"
  }' | jq -r '.accessToken'


 TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJtb2NrLWF1dGhvci0xNzU2MzM5NjgwMDkxIiwiZW1haWwiOiJhdXRob3IxQGV4YW1wbGUuY29tIiwicm9sZSI6IkFVVEhPUiIsImp0aSI6ImMxNDM2MjNlLWU5ZWItNGQ5ZS05OTIzLWYyOGZjMmRmYTNjYSIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NTYzMzk2ODAsImV4cCI6MTc1NjQyNjA4MCwiYXVkIjoiZWJvb2stcGxhdGZvcm0tYXBpIiwiaXNzIjoiZWJvb2stYXV0aC1zZXJ2aWNlIn0.rz38L1ofKiXloh_JRGf4_TbUaouJRpB4NiBGg8kp6G8"

curl -X POST 'https://d2xg2iv1qaydac.cloudfront.net/api/books' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "My Test Book",
    "description": "A test book created via API",
    "genre": "fiction",
    "content": "This is the content of my test book. It is a work of fiction."
  }'




npm run build:qa

./scripts/deploy-lambda-from-dist.sh qa

 npm run build:lambda:qa
./scripts/deploy-frontend-qa.sh

chmod +x scripts/build-lambda-packages.sh && ./scripts/build-lambda-packages.sh qa


./backend/src/test/scripts/test-current-workflow.sh

chmod +x test-workflow-quick.s


node test-new-endpoints-integration.js

cloudfront workflow servie shell script
 ./test-direct-api-workflow.sh

 🎯 New Endpoints Successfully Tested:
• POST /api/workflow/books/{bookId}/submit
• POST /api/workflow/books/{bookId}/approve
• POST /api/workflow/books/{bookId}/reject
• POST /api/workflow/books/{bookId}/publish
• GET /api/workflow/books/{bookId}/status

Front end tests command
npm run test -- --run

./scripts/build-lambda-packages.sh qa
./scripts/deploy-frontend-qa.sh
./test-my-books-simple.sh
./test-complete-workflow-e2e.sh


update readme that email would get sent to 
https://yopmail.com/wm
bookmanagement@yopmail.com

./scripts/send-test-email.sh bookmanagement@yopmail.com
npx ts-node src/test/debug/notification-service-debug.ts
name "/aws/lambda/qa-notification-service" --start-time $(($(date +%s) - 1800))000 --filter-pattern '"START RequestId" OR "END RequestId"' --query 'events[*].message' --output text
aws sqs list-queues | grep notification
aws lambda list-event-source-mappings --function-name "qa-notification-service"
aws lambda list-event-source-mappings --function-name "qa-notification-service" | grep -A 20 -B 5 sqs


terraform apply  -var-file=qa.tfvars -auto-approve