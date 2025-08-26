# IAM Policy Templates for Deployment User Setup

This directory contains comprehensive IAM policy templates required for deploying the ebook publishing platform infrastructure. These policies follow the principle of least privilege and are scoped to environment-specific resources.

## Policy Overview

### Individual Service Policies

| Policy File | Purpose | Key Permissions |
|-------------|---------|-----------------|
| `cloudfront-deployment-policy.json` | CloudFront CDN management | Cache policies, distributions, invalidations |
| `iam-deployment-policy.json` | IAM role and policy management | Create/manage roles and policies for Lambda, API Gateway |
| `sqs-deployment-policy.json` | SQS queue management | Create/manage queues and dead letter queues |
| `cloudwatch-deployment-policy.json` | Monitoring and logging | Log groups, metric filters, alarms, dashboards |
| `sns-deployment-policy.json` | Notification management | Topics, subscriptions, platform applications |

### Consolidated Policy

| Policy File | Purpose | Key Permissions |
|-------------|---------|-----------------|
| `consolidated-deployment-policy.json` | All-in-one deployment policy | Combined permissions from all service policies |

## Quick Setup Guide

### Option 1: Automated Setup (Recommended)

Use the Terraform IAM deployment permissions module:

```bash
# 1. Deploy the IAM permissions module
cd infrastructure
terraform init
terraform plan -target=module.deployment_permissions
terraform apply -target=module.deployment_permissions

# 2. Attach policies to your user
./scripts/attach-deployment-policies.sh your-username dev

# 3. Validate permissions
./scripts/validate-aws-permissions.sh dev
```

### Option 2: Manual Setup

#### Step 1: Create IAM User (if needed)

```bash
# Create deployment user
aws iam create-user --user-name ebook-deployment-user

# Create access keys
aws iam create-access-key --user-name ebook-deployment-user
```

#### Step 2: Create and Attach Policies

**Individual Policies Approach:**

```bash
# Set variables
ENVIRONMENT="dev"
USER_NAME="ebook-deployment-user"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create CloudFront policy
aws iam create-policy \
  --policy-name "${ENVIRONMENT}-cloudfront-deployment-policy" \
  --policy-document file://infrastructure/iam-policies/cloudfront-deployment-policy.json

# Create IAM policy
aws iam create-policy \
  --policy-name "${ENVIRONMENT}-iam-deployment-policy" \
  --policy-document file://infrastructure/iam-policies/iam-deployment-policy.json

# Create SQS policy
aws iam create-policy \
  --policy-name "${ENVIRONMENT}-sqs-deployment-policy" \
  --policy-document file://infrastructure/iam-policies/sqs-deployment-policy.json

# Create CloudWatch policy
aws iam create-policy \
  --policy-name "${ENVIRONMENT}-cloudwatch-deployment-policy" \
  --policy-document file://infrastructure/iam-policies/cloudwatch-deployment-policy.json

# Create SNS policy
aws iam create-policy \
  --policy-name "${ENVIRONMENT}-sns-deployment-policy" \
  --policy-document file://infrastructure/iam-policies/sns-deployment-policy.json

# Attach policies to user
aws iam attach-user-policy \
  --user-name "$USER_NAME" \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${ENVIRONMENT}-cloudfront-deployment-policy"

aws iam attach-user-policy \
  --user-name "$USER_NAME" \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${ENVIRONMENT}-iam-deployment-policy"

aws iam attach-user-policy \
  --user-name "$USER_NAME" \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${ENVIRONMENT}-sqs-deployment-policy"

aws iam attach-user-policy \
  --user-name "$USER_NAME" \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${ENVIRONMENT}-cloudwatch-deployment-policy"

aws iam attach-user-policy \
  --user-name "$USER_NAME" \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${ENVIRONMENT}-sns-deployment-policy"
```

**Consolidated Policy Approach:**

```bash
# Set variables
ENVIRONMENT="dev"
USER_NAME="ebook-deployment-user"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create consolidated policy
aws iam create-policy \
  --policy-name "${ENVIRONMENT}-consolidated-deployment-policy" \
  --policy-document file://infrastructure/iam-policies/consolidated-deployment-policy.json

# Attach policy to user
aws iam attach-user-policy \
  --user-name "$USER_NAME" \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${ENVIRONMENT}-consolidated-deployment-policy"
```

#### Step 3: Verify Setup

```bash
# List attached policies
aws iam list-attached-user-policies --user-name "$USER_NAME"

# Validate permissions
./scripts/validate-aws-permissions.sh dev
```

## Policy Details

### Resource Scoping

All policies are scoped to environment-specific resources using naming patterns:

- **Development**: `dev-*`
- **Staging**: `staging-*`
- **Production**: `prod-*`

### Security Features

#### Condition-Based Access
- **Region restrictions**: Some actions limited to specific AWS regions
- **Service restrictions**: IAM PassRole limited to specific AWS services
- **Namespace restrictions**: CloudWatch metrics limited to relevant namespaces

#### Resource ARN Patterns
```json
{
  "Resource": [
    "arn:aws:iam::*:policy/dev-*",
    "arn:aws:iam::*:role/dev-*",
    "arn:aws:sqs:*:*:dev-*",
    "arn:aws:sns:*:*:dev-*",
    "arn:aws:logs:*:*:log-group:/aws/lambda/dev-*"
  ]
}
```

### CloudFront Policy Highlights

- **Cache Policy Management**: Create, update, delete cache policies
- **Origin Request Policies**: Manage origin request forwarding
- **Response Headers Policies**: Configure security headers
- **Distribution Management**: Full distribution lifecycle
- **Invalidation Management**: Cache invalidation capabilities

### IAM Policy Highlights

- **Policy Management**: Create and manage custom policies
- **Role Management**: Create and manage service roles
- **PassRole Restrictions**: Limited to Lambda, API Gateway, and EventBridge
- **Resource Scoping**: Limited to environment-specific resources

### SQS Policy Highlights

- **Queue Management**: Create, configure, and delete queues
- **Dead Letter Queues**: Support for DLQ configuration
- **Message Operations**: Send, receive, and delete messages
- **Permission Management**: Queue-level permission management

### CloudWatch Policy Highlights

- **Log Group Management**: Create and manage log groups
- **Metric Filters**: Create custom metric filters
- **Alarms and Dashboards**: Full monitoring setup
- **CloudWatch Insights**: Query and analysis capabilities

### SNS Policy Highlights

- **Topic Management**: Create and manage SNS topics
- **Subscription Management**: Handle subscriptions and notifications
- **Platform Applications**: Mobile push notification support
- **Delivery Status**: SMS and delivery status management

## Environment-Specific Deployment

### Development Environment
```bash
# Use relaxed permissions for development
ENVIRONMENT="dev"
./scripts/attach-deployment-policies.sh dev-user dev
```

### Staging Environment
```bash
# Use production-like permissions for staging
ENVIRONMENT="staging"
./scripts/attach-deployment-policies.sh staging-user staging
```

### Production Environment
```bash
# Use strict permissions for production
ENVIRONMENT="prod"
./scripts/attach-deployment-policies.sh prod-user prod
```

## Troubleshooting

### Common Issues

#### Policy Already Exists
```bash
# Delete existing policy first
aws iam delete-policy --policy-arn "arn:aws:iam::ACCOUNT_ID:policy/POLICY_NAME"

# Then recreate
aws iam create-policy --policy-name "POLICY_NAME" --policy-document file://policy.json
```

#### User Not Found
```bash
# Create the user first
aws iam create-user --user-name "USER_NAME"
```

#### Permission Denied
```bash
# Ensure your current user has IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
  --action-names iam:CreatePolicy iam:AttachUserPolicy
```

### Validation Commands

```bash
# Test specific permissions
aws iam simulate-principal-policy \
  --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
  --action-names cloudfront:CreateCachePolicy

# List all attached policies
aws iam list-attached-user-policies --user-name "USER_NAME"

# Get policy details
aws iam get-policy --policy-arn "POLICY_ARN"
```

## Best Practices

### Security
- ✅ Use environment-specific policies
- ✅ Implement resource-based restrictions
- ✅ Regular policy review and updates
- ✅ Principle of least privilege

### Management
- ✅ Use descriptive policy names
- ✅ Tag policies for organization
- ✅ Version control policy documents
- ✅ Automated policy deployment

### Monitoring
- ✅ Enable CloudTrail for IAM actions
- ✅ Monitor policy usage
- ✅ Regular access reviews
- ✅ Automated compliance checks

## Integration with Terraform

These policies are designed to work with the Terraform IAM deployment permissions module:

```hcl
module "deployment_permissions" {
  source = "./modules/iam_deployment_permissions"
  
  environment          = "dev"
  deployment_user_name = "ebook-deployment-user"
  
  # Choose attachment method
  attach_individual_policies = true  # Use individual policies
  create_consolidated_policy = false # Or use consolidated policy
  
  tags = {
    Project     = "ebook-platform"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

## Support

For additional help:
- Review the AWS IAM User Guide: https://docs.aws.amazon.com/IAM/latest/UserGuide/
- Use the validation scripts in `scripts/`
- Check CloudTrail logs for permission issues
- Contact your AWS administrator for account-level permissions