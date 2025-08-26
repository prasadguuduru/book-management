# Ebook Publishing Platform Infrastructure

This directory contains the complete Terraform infrastructure for the Ebook Publishing Platform, designed with AWS Free Tier optimization and enterprise-grade security.

## Architecture Overview

The platform uses a serverless architecture with the following components:

- **Frontend**: React 18+ TypeScript application hosted on S3 with CloudFront CDN
- **Backend**: Node.js 18+ Lambda functions with TypeScript
- **Database**: DynamoDB single-table design with GSI optimization
- **API**: API Gateway REST and WebSocket APIs with custom JWT authorizer
- **Storage**: S3 buckets for static assets and file uploads
- **Messaging**: SNS/SQS for event-driven architecture
- **Monitoring**: CloudWatch dashboards, alarms, and custom metrics

## Free Tier Compliance

The infrastructure is designed to stay within AWS Free Tier limits for the first 12 months:

### Always Free Services
- **Lambda**: 1M requests + 400K GB-seconds per month
- **DynamoDB**: 25GB storage + 25 RCU + 25 WCU per second
- **API Gateway**: 1M REST API calls per month
- **CloudWatch**: 10 custom metrics + 10 alarms + 5GB logs
- **CloudFront**: 1TB data transfer + 10M HTTP/HTTPS requests per month

### 12-Month Free Services
- **S3**: 5GB storage + 20K GET + 2K PUT requests
- **SNS**: 1M publishes + 100K HTTP deliveries
- **SQS**: 1M requests per month
- **SES**: 62K emails per month (when called from Lambda)

**Estimated Monthly Cost**: $0.00 for first 12 months, ~$15-25/month after Free Tier expires

## Directory Structure

```
infrastructure/
├── modules/                    # Reusable Terraform modules
│   ├── api_gateway/           # REST + WebSocket API configuration
│   ├── cloudfront/            # CDN distribution for frontend
│   ├── cloudwatch/            # Monitoring, logging, and alerting
│   ├── dynamodb/              # Single-table database design
│   ├── lambda/                # Serverless function deployment
│   ├── s3/                    # Storage buckets and static hosting
│   ├── sns/                   # Event notification topics
│   └── sqs/                   # Message queues for reliability
├── *.tfvars                   # Environment-specific variable files
│   ├── local.tfvars           # LocalStack development
│   ├── dev.tfvars             # Development environment
│   ├── qa.tfvars              # QA/Testing environment
│   ├── staging.tfvars         # Pre-production testing
│   └── prod.tfvars            # Production deployment
├── main.tf                    # Main infrastructure configuration
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
└── README.md                  # This file
```

## Quick Start

### Prerequisites

1. **Node.js 18+** and npm
2. **Terraform 1.0+**
3. **AWS CLI** configured with appropriate credentials
4. **Docker** and Docker Compose (for LocalStack)

### Local Development Setup

1. **Start LocalStack**:
   ```bash
   cd ..  # Go to project root
   npm run localstack:start
   npm run localstack:wait
   ```

2. **Deploy Local Infrastructure**:
   ```bash
   cd infrastructure
   terraform init
   terraform plan -var-file=local.tfvars
   terraform apply -var-file=local.tfvars
   ```

3. **Verify Deployment**:
   ```bash
   # Check LocalStack services
   npm run localstack:health
   
   # Test API endpoints
   curl http://localhost:4566/restapis
   ```

### Development Environment Deployment

1. **Configure AWS Credentials**:
   ```bash
   aws configure
   # or use environment variables
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   export AWS_DEFAULT_REGION=us-east-1
   ```

2. **Deploy to Development**:
   ```bash
   terraform init
   terraform plan -var-file=dev.tfvars
   terraform apply -var-file=dev.tfvars
   ```

## Environment Configuration

### Local Environment (LocalStack)

- **Purpose**: Local development and testing
- **Services**: All AWS services mocked via LocalStack
- **Cost**: $0 (runs locally)
- **Configuration**: `local.tfvars`

### Development Environment

- **Purpose**: Feature development and integration testing
- **Services**: Real AWS services with Free Tier optimization
- **Cost**: $0 (within Free Tier limits)
- **Configuration**: `dev.tfvars`

### QA Environment

- **Purpose**: Quality assurance and testing
- **Services**: Real AWS services with Free Tier optimization
- **Cost**: $0 (within Free Tier limits)
- **Configuration**: `qa.tfvars`

### Staging Environment

- **Purpose**: Pre-production testing and validation
- **Services**: Production-like setup with Free Tier optimization
- **Cost**: $0 (within Free Tier limits)
- **Configuration**: `staging.tfvars`

### Production Environment

- **Purpose**: Live application serving real users
- **Services**: Full production setup with high availability
- **Cost**: ~$15-25/month after Free Tier expires
- **Configuration**: `prod.tfvars`

## Module Documentation

### DynamoDB Module (`modules/dynamodb/`)

Single-table design optimized for the ebook platform with:
- Primary table with PK/SK structure
- Two Global Secondary Indexes (GSI1, GSI2)
- Point-in-time recovery enabled
- Server-side encryption with AWS KMS
- Free Tier monitoring and alerting

**Key Features**:
- Supports all entity types (User, Book, Review, Workflow, etc.)
- Optimized access patterns for common queries
- TTL for automatic cleanup of temporary data
- Pay-per-request billing for variable workloads

### Lambda Module (`modules/lambda/`)

Serverless functions with Free Tier optimization:
- 6 core services: auth, book, user, workflow, review, notification
- Memory allocation optimized per service (128MB - 256MB)
- Reserved concurrency to prevent runaway costs
- Comprehensive IAM policies for least privilege access

**Services**:
- **Auth Service** (128MB): JWT authentication and authorization
- **Book Service** (256MB): Book CRUD and content management
- **User Service** (192MB): User profile and preference management
- **Workflow Service** (192MB): Book state machine and approvals
- **Review Service** (128MB): Review and rating system
- **Notification Service** (192MB): Multi-channel notifications

### API Gateway Module (`modules/api_gateway/`)

REST and WebSocket APIs with:
- Custom JWT authorizer for secure endpoints
- CORS configuration for frontend integration
- Rate limiting and throttling for abuse prevention
- Comprehensive error handling and validation

**Endpoints**:
- `/auth/*` - Authentication and user management
- `/books/*` - Book CRUD operations
- `/users/*` - User profile management
- `/reviews/*` - Review and rating system
- `/workflow/*` - Book workflow actions
- `/notifications/*` - User notifications

### S3 Module (`modules/s3/`)

Storage buckets with Free Tier optimization:
- **Frontend Bucket**: Static website hosting for React app
- **Assets Bucket**: File uploads (book covers, avatars)
- **Logs Bucket**: CloudFront and application logs (optional)

**Features**:
- Server-side encryption (AES-256)
- Lifecycle policies for cost optimization
- CORS configuration for frontend integration
- Versioning and backup capabilities

### CloudFront Module (`modules/cloudfront/`)

CDN distribution for global performance:
- Origin Access Control for S3 integration
- Custom caching policies for different content types
- Security headers and HTTPS enforcement
- Custom error pages for SPA routing

**Cache Behaviors**:
- Static assets: 24 hours cache
- HTML files: 5 minutes cache
- API calls: No caching (pass-through)

### SNS Module (`modules/sns/`)

Event-driven notifications with:
- **Book Workflow Topic**: State change notifications
- **User Notifications Topic**: General user alerts
- **System Alerts Topic**: Monitoring and error alerts
- **Free Tier Alerts Topic**: Usage threshold warnings

### SQS Module (`modules/sqs/`)

Reliable message processing with:
- **Book Workflow Queue**: Workflow state processing
- **User Notifications Queue**: Notification delivery
- **Email Processing Queue**: Email template processing
- Dead letter queues for failed message handling

### CloudWatch Module (`modules/cloudwatch/`)

Comprehensive monitoring with:
- System overview dashboard
- Free Tier usage dashboard
- Custom business metrics (registrations, publications)
- Security metrics (authentication failures)
- Predefined CloudWatch Insights queries

## Testing and Validation

### Infrastructure Testing

```bash
# Validate Terraform configuration
terraform validate

# Check formatting
terraform fmt -check

# Plan without applying
terraform plan -var-file=local.tfvars

# Test with LocalStack
npm run localstack:test
```

### API Testing

```bash
# Test authentication endpoint
curl -X POST http://localhost:4566/restapis/[API-ID]/local/_user_request_/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test book listing
curl -X GET http://localhost:4566/restapis/[API-ID]/local/_user_request_/books \
  -H "Authorization: Bearer [JWT-TOKEN]"

# Test health check
curl -X GET http://localhost:4566/restapis/[API-ID]/local/_user_request_/health
```

### Frontend Testing

```bash
# Test CloudFront distribution (production)
curl -I https://[DISTRIBUTION-ID].cloudfront.net

# Test S3 website endpoint (development)
curl -I http://[BUCKET-NAME].s3-website-us-east-1.amazonaws.com

# Test CORS configuration
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS https://[API-URL]/health
```

## Monitoring and Alerting

### CloudWatch Dashboards

1. **System Overview**: Lambda, DynamoDB, API Gateway, CloudFront metrics
2. **Free Tier Usage**: Real-time usage tracking with threshold alerts

### Key Metrics

- **Lambda Invocations**: Track against 1M monthly limit
- **DynamoDB Capacity**: Monitor RCU/WCU usage
- **API Gateway Requests**: Track against 1M monthly limit
- **S3 Storage**: Monitor against 5GB limit
- **CloudFront Data Transfer**: Track against 1TB monthly limit

### Alerts

- **Free Tier Thresholds**: 80% usage warnings
- **Error Rates**: High error rate alerts
- **Performance**: Latency and timeout alerts
- **Security**: Authentication failure alerts

## Security Features

### Authentication & Authorization
- JWT tokens with RS256 asymmetric encryption
- Role-based access control (RBAC)
- Custom API Gateway authorizer
- Session management with refresh tokens

### Data Protection
- Encryption at rest (DynamoDB, S3)
- Encryption in transit (TLS 1.3)
- Application-level PII encryption
- Input validation and sanitization

### Compliance
- SOC 2 Type II controls
- GDPR compliance features
- ISO 27001 security framework
- Comprehensive audit trails

## Cost Optimization

### Free Tier Strategies
- Pay-per-request billing for variable workloads
- Optimized Lambda memory allocation
- Efficient DynamoDB access patterns
- CloudFront price class optimization
- Automated resource cleanup

### Monitoring
- Real-time cost tracking
- Usage threshold alerts
- Monthly usage reports
- Cost projection and forecasting

## Troubleshooting

### Common Issues

1. **LocalStack Connection Issues**:
   ```bash
   # Check LocalStack status
   docker-compose ps
   
   # Restart LocalStack
   npm run localstack:stop
   npm run localstack:start
   ```

2. **Terraform State Issues**:
   ```bash
   # Refresh state
   terraform refresh
   
   # Import existing resources
   terraform import aws_s3_bucket.example bucket-name
   ```

3. **Lambda Deployment Issues**:
   ```bash
   # Check function logs
   aws logs tail /aws/lambda/[FUNCTION-NAME] --follow
   
   # Update function code
   aws lambda update-function-code --function-name [NAME] --zip-file fileb://function.zip
   ```

### Debug Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# List LocalStack services
curl http://localhost:4566/health

# Check Terraform state
terraform show

# Validate infrastructure
terraform plan -detailed-exitcode
```

## Deployment Scripts

### Automated Deployment

```bash
# Deploy to development
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (requires approval)
./scripts/deploy.sh prod
```

### Manual Deployment

```bash
# Initialize Terraform
terraform init

# Select workspace
terraform workspace select [environment]

# Plan deployment
terraform plan -var-file=[environment].tfvars

# Apply changes
terraform apply -var-file=[environment].tfvars

# Verify deployment
terraform output
```

## Contributing

1. **Infrastructure Changes**: Update relevant module and test with LocalStack
2. **Documentation**: Update README and inline comments
3. **Testing**: Validate with `terraform validate` and `terraform plan`
4. **Security**: Follow least privilege principle for IAM policies

## Support

For infrastructure issues:
1. Check CloudWatch logs and metrics
2. Review Terraform state and outputs
3. Test with LocalStack for debugging
4. Consult AWS documentation for service-specific issues

## License

This infrastructure code is part of the Ebook Publishing Platform project and follows the same license terms.