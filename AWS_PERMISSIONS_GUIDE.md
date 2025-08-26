# AWS Permissions Management Guide

This guide documents all AWS resource permissions for the Ebook Publishing Platform, ensuring 100% code-managed configuration with zero manual AWS console setup required.

## 🔐 Permission Management Philosophy

**Core Principle**: All AWS resource permissions are managed via Terraform code to ensure:
- ✅ **Reproducible deployments** across environments
- ✅ **Version-controlled security** configurations
- ✅ **Audit trail** for all permission changes
- ✅ **Zero manual configuration** in AWS console
- ✅ **Principle of least privilege** implementation
- ✅ **Compliance-ready** security posture

## 📋 Permission Validation

### Quick Validation Commands

```bash
# Validate all permissions for local environment
npm run validate:permissions:local

# Validate permissions for development environment
npm run validate:permissions:dev

# Validate permissions for production environment
npm run validate:permissions:prod

# Generate detailed permission report
./scripts/validate-permissions.sh dev
```

### Validation Coverage

The validation script checks:
- ✅ Lambda function permissions and IAM roles
- ✅ API Gateway integration permissions
- ✅ DynamoDB table access and policies
- ✅ S3 bucket policies and CORS configuration
- ✅ SNS topic policies and subscriptions
- ✅ SQS queue policies and event source mappings
- ✅ CloudFront distribution and origin access
- ✅ IAM roles and policy attachments
- ✅ Cross-service permission integration

## 🏗️ Permission Architecture

### IAM Module (`infrastructure/modules/iam/`)

**Purpose**: Centralized identity and access management

**Key Components**:
- **Lambda Execution Role**: Single role for all Lambda functions
- **API Gateway Execution Role**: CloudWatch logging permissions
- **EventBridge Execution Role**: Scheduled task permissions
- **CloudFront Origin Access Identity**: S3 bucket access
- **Custom KMS Key**: Optional encryption key management

**Policies Managed**:
```hcl
# DynamoDB access (read/write/query/scan)
aws_iam_role_policy.lambda_dynamodb

# S3 access (get/put/delete objects)
aws_iam_role_policy.lambda_s3

# SNS publishing permissions
aws_iam_role_policy.lambda_sns

# SQS message processing permissions
aws_iam_role_policy.lambda_sqs

# SES email sending permissions
aws_iam_role_policy.lambda_ses

# CloudWatch Logs and Metrics
aws_iam_role_policy.lambda_cloudwatch_logs
aws_iam_role_policy.lambda_cloudwatch_metrics

# DynamoDB Streams (optional)
aws_iam_role_policy.lambda_dynamodb_streams
```

### IAM Permissions Module (`infrastructure/modules/iam_permissions/`)

**Purpose**: Cross-service access permissions and event source mappings

**Key Components**:
- **Lambda Permissions**: API Gateway, WebSocket, S3, EventBridge invocation
- **Resource Policies**: SNS topics, SQS queues, S3 buckets, DynamoDB table
- **Event Source Mappings**: SQS → Lambda, DynamoDB Streams → Lambda
- **Service Integration**: Cross-service communication permissions

## 🔧 Service-Specific Permissions

### Lambda Functions

**IAM Role**: `{environment}-lambda-execution-role`

**Permissions**:
```json
{
  "DynamoDB": {
    "Actions": ["GetItem", "PutItem", "UpdateItem", "DeleteItem", "Query", "Scan", "BatchGetItem", "BatchWriteItem"],
    "Resources": ["table-arn", "table-arn/index/*"]
  },
  "S3": {
    "Actions": ["GetObject", "PutObject", "DeleteObject", "ListBucket"],
    "Resources": ["frontend-bucket/*", "assets-bucket/*"]
  },
  "SNS": {
    "Actions": ["Publish", "GetTopicAttributes"],
    "Resources": ["all-sns-topics"]
  },
  "SQS": {
    "Actions": ["SendMessage", "ReceiveMessage", "DeleteMessage", "GetQueueAttributes"],
    "Resources": ["all-sqs-queues"]
  },
  "SES": {
    "Actions": ["SendEmail", "SendRawEmail", "SendTemplatedEmail"],
    "Resources": ["*"],
    "Conditions": {
      "StringEquals": {
        "ses:FromAddress": ["noreply@{env}-ebook-platform.com"]
      }
    }
  },
  "CloudWatch": {
    "Actions": ["PutMetricData", "CreateLogGroup", "CreateLogStream", "PutLogEvents"],
    "Resources": ["custom-metrics", "lambda-log-groups"]
  }
}
```

**Event Sources**:
- ✅ API Gateway REST API invocation
- ✅ API Gateway WebSocket API invocation
- ✅ SQS queue message processing
- ✅ DynamoDB Streams change processing
- ✅ S3 bucket object notifications (optional)
- ✅ EventBridge scheduled tasks (optional)

### API Gateway

**IAM Role**: `{environment}-api-gateway-execution-role`

**Permissions**:
```json
{
  "CloudWatch": {
    "Actions": ["CreateLogGroup", "CreateLogStream", "PutLogEvents"],
    "Resources": ["API-Gateway-Execution-Logs_*"]
  },
  "Lambda": {
    "Actions": ["InvokeFunction"],
    "Resources": ["auth-service-arn"],
    "Purpose": "JWT custom authorizer"
  }
}
```

**Lambda Permissions**:
```hcl
# Each Lambda function has explicit permission for API Gateway invocation
resource "aws_lambda_permission" "api_gateway_auth" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "auth-service"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${api-gateway-execution-arn}/*/*"
}
```

### DynamoDB

**Access Control**:
- ✅ **IAM-based access**: Lambda functions via execution role
- ✅ **Resource-based policy**: Additional security for production
- ✅ **Encryption at rest**: AWS managed KMS key
- ✅ **Point-in-time recovery**: Enabled for data protection

**Stream Processing**:
```hcl
resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  event_source_arn  = "dynamodb-stream-arn"
  function_name     = "notification-service"
  starting_position = "LATEST"
  batch_size        = 10
  
  # Filter for relevant events only
  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
        dynamodb = {
          NewImage = {
            entityType = { S = ["BOOK", "USER", "REVIEW"] }
          }
        }
      })
    }
  }
}
```

### S3 Buckets

**Frontend Bucket**:
```json
{
  "Policy": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowCloudFrontServicePrincipal",
        "Effect": "Allow",
        "Principal": { "Service": "cloudfront.amazonaws.com" },
        "Action": "s3:GetObject",
        "Resource": "frontend-bucket-arn/*",
        "Condition": {
          "StringEquals": {
            "AWS:SourceArn": "cloudfront-distribution-arn"
          }
        }
      }
    ]
  }
}
```

**Assets Bucket**:
```json
{
  "CORS": {
    "AllowedOrigins": ["frontend-domains"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  },
  "Encryption": "AES256",
  "Versioning": "Enabled",
  "Lifecycle": {
    "TransitionToIA": "30 days",
    "TransitionToGlacier": "90 days"
  }
}
```

### SNS Topics

**Topic Policies**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLambdaPublish",
      "Effect": "Allow",
      "Principal": { "AWS": ["lambda-function-arns"] },
      "Action": ["sns:Publish", "sns:GetTopicAttributes"],
      "Resource": "topic-arn"
    }
  ]
}
```

**Subscriptions**:
- ✅ **Email subscriptions**: System alerts and Free Tier warnings
- ✅ **Lambda subscriptions**: Event processing
- ✅ **SQS subscriptions**: Reliable message delivery

### SQS Queues

**Queue Policies**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSNSPublish",
      "Effect": "Allow",
      "Principal": { "Service": "sns.amazonaws.com" },
      "Action": "sqs:SendMessage",
      "Resource": "queue-arn",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "account-id" }
      }
    },
    {
      "Sid": "AllowLambdaAccess",
      "Effect": "Allow",
      "Principal": { "AWS": ["lambda-function-arns"] },
      "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
      "Resource": "queue-arn"
    }
  ]
}
```

**Event Source Mappings**:
```hcl
resource "aws_lambda_event_source_mapping" "workflow_queue" {
  event_source_arn = "sqs-queue-arn"
  function_name    = "workflow-service"
  batch_size       = 10
  maximum_batching_window_in_seconds = 5
  function_response_types = ["ReportBatchItemFailures"]
  
  scaling_config {
    maximum_concurrency = 10
  }
}
```

### CloudFront Distribution

**Origin Access Control**:
```hcl
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
```

**Cache Policies**:
- ✅ **Static assets**: 24-hour cache with compression
- ✅ **HTML files**: 5-minute cache for updates
- ✅ **API calls**: No caching (pass-through)

## 🔍 Permission Testing

### Automated Tests

```bash
# Test DynamoDB access
aws dynamodb scan --table-name {table-name} --limit 1

# Test S3 bucket access
aws s3 ls s3://{bucket-name}

# Test API Gateway health
curl -f {api-gateway-url}/health

# Test Lambda function invocation
aws lambda invoke --function-name {function-name} /tmp/response.json

# Test SNS topic publishing
aws sns publish --topic-arn {topic-arn} --message "Test message"

# Test SQS queue access
aws sqs receive-message --queue-url {queue-url} --max-number-of-messages 1
```

### Integration Tests

```bash
# Complete workflow test
./scripts/test-complete-workflow.sh

# Permission validation
./scripts/validate-permissions.sh {environment}

# Infrastructure health check
npm run test:infra:health
```

## 🛡️ Security Best Practices

### Implemented Security Measures

1. **Principle of Least Privilege**
   - ✅ Each service has minimal required permissions
   - ✅ Resource-specific access controls
   - ✅ Condition-based policy restrictions

2. **Defense in Depth**
   - ✅ IAM role-based access control
   - ✅ Resource-based policies
   - ✅ Network-level security (VPC endpoints if needed)
   - ✅ Encryption at rest and in transit

3. **Audit and Compliance**
   - ✅ All permissions version-controlled
   - ✅ CloudTrail logging enabled
   - ✅ CloudWatch monitoring and alerting
   - ✅ Regular permission validation

4. **Secrets Management**
   - ✅ JWT keys stored as Terraform variables
   - ✅ Encryption keys managed via KMS
   - ✅ No hardcoded credentials in code

### Security Validation Checklist

- [ ] All IAM roles follow least privilege principle
- [ ] Resource-based policies restrict access appropriately
- [ ] Cross-service permissions are explicitly defined
- [ ] No overly permissive wildcard permissions
- [ ] Encryption is enabled for all data stores
- [ ] Audit logging is configured for all services
- [ ] Permission validation tests pass
- [ ] No manual AWS console configuration required

## 🚀 Deployment Process

### Permission Deployment Flow

1. **Infrastructure Deployment**
   ```bash
   # Deploy IAM module first
   terraform apply -target=module.iam
   
   # Deploy other modules with IAM dependencies
   terraform apply
   ```

2. **Permission Validation**
   ```bash
   # Validate all permissions are working
   npm run validate:permissions:{environment}
   ```

3. **Integration Testing**
   ```bash
   # Test complete system integration
   npm run test:infra:{environment}
   ```

### Environment-Specific Considerations

**Local Environment (LocalStack)**:
- ✅ All permissions mocked locally
- ✅ No real AWS costs incurred
- ✅ Full permission testing capability

**Development Environment**:
- ✅ Real AWS services with Free Tier limits
- ✅ Relaxed CORS policies for development
- ✅ Debug logging enabled

**Production Environment**:
- ✅ Strict security policies
- ✅ Resource-based policies enabled
- ✅ Comprehensive monitoring and alerting

## 📊 Permission Monitoring

### CloudWatch Metrics

```bash
# Monitor Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Monitor API Gateway requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Monitor DynamoDB capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Free Tier Monitoring

```bash
# Check Free Tier usage
aws support describe-trusted-advisor-checks \
  --language en \
  --query 'checks[?name==`Service Limits`]'

# Monitor costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 month ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost
```

## 🔧 Troubleshooting

### Common Permission Issues

1. **Lambda Function Cannot Access DynamoDB**
   ```bash
   # Check IAM role permissions
   aws iam list-role-policies --role-name {environment}-lambda-execution-role
   
   # Check resource-based policies
   aws dynamodb describe-table --table-name {table-name}
   ```

2. **API Gateway Cannot Invoke Lambda**
   ```bash
   # Check Lambda permissions
   aws lambda get-policy --function-name {function-name}
   
   # Check API Gateway configuration
   aws apigateway get-authorizers --rest-api-id {api-id}
   ```

3. **S3 Bucket Access Denied**
   ```bash
   # Check bucket policy
   aws s3api get-bucket-policy --bucket {bucket-name}
   
   # Check CORS configuration
   aws s3api get-bucket-cors --bucket {bucket-name}
   ```

### Permission Debugging Commands

```bash
# Test specific permission
aws sts simulate-principal-policy \
  --policy-source-arn {role-arn} \
  --action-names {action} \
  --resource-arns {resource-arn}

# Check effective permissions
aws iam simulate-principal-policy \
  --policy-source-arn {role-arn} \
  --action-names {action} \
  --resource-arns {resource-arn}

# Validate policy syntax
aws iam validate-policy \
  --policy-document file://policy.json
```

## 📝 Compliance Documentation

### SOC 2 Type II Controls

- ✅ **CC6.1**: Logical access controls restrict access
- ✅ **CC6.2**: Transmission and disposal of information is controlled
- ✅ **CC6.3**: Access rights are managed through authorization processes
- ✅ **CC6.6**: Logical access controls prevent unauthorized disclosure
- ✅ **CC6.7**: Data transmission is controlled
- ✅ **CC6.8**: Controls prevent unauthorized access to data

### GDPR Compliance

- ✅ **Article 25**: Data protection by design and by default
- ✅ **Article 32**: Security of processing
- ✅ **Article 35**: Data protection impact assessment

### ISO 27001 Controls

- ✅ **A.9.1**: Access control policy
- ✅ **A.9.2**: User access management
- ✅ **A.9.4**: System and application access control
- ✅ **A.10.1**: Cryptographic controls

## 🎯 Summary

**✅ 100% Code-Managed Permissions**: All AWS resource permissions are defined in Terraform code with zero manual AWS console configuration required.

**✅ Comprehensive Coverage**: Every service interaction is explicitly permitted through IAM roles, resource policies, and event source mappings.

**✅ Security Best Practices**: Principle of least privilege, defense in depth, and comprehensive audit trails implemented.

**✅ Automated Validation**: Permission validation scripts ensure all configurations work correctly across environments.

**✅ Compliance Ready**: SOC 2, GDPR, and ISO 27001 controls implemented through code-managed permissions.

The infrastructure is production-ready with enterprise-grade security and zero manual configuration requirements! 🚀