# IAM Deployment Permissions Module

This Terraform module creates comprehensive IAM policies required for deploying the ebook platform infrastructure. It addresses the specific permission errors encountered during Terraform deployment.

## Features

- **Service-Specific Policies**: Individual policies for CloudFront, IAM, SQS, CloudWatch, and SNS
- **Resource Scoping**: Permissions limited to environment-specific resources
- **Flexible Attachment**: Support for individual or consolidated policy attachment
- **Security Best Practices**: Least privilege principle with proper resource constraints

## Resolved Permission Issues

This module specifically addresses these Terraform deployment errors:

- `cloudfront:CreateCachePolicy` - CloudFront cache policy creation
- `cloudfront:CreateOriginRequestPolicy` - CloudFront origin request policy creation  
- `cloudfront:CreateResponseHeadersPolicy` - CloudFront response headers policy creation
- `iam:CreatePolicy` - IAM policy creation for service roles
- `sqs:CreateQueue` - SQS queue creation for dead letter queues
- CloudWatch log group dependencies for metric filters

## Usage

### Basic Usage

```hcl
module "deployment_permissions" {
  source = "./modules/iam_deployment_permissions"
  
  environment          = "dev"
  deployment_user_name = "system"
  
  tags = {
    Project     = "ebook-platform"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
```

### Advanced Usage with Consolidated Policy

```hcl
module "deployment_permissions" {
  source = "./modules/iam_deployment_permissions"
  
  environment                = "prod"
  deployment_user_name       = "deployment-user"
  attach_individual_policies = false
  create_consolidated_policy = true
  
  # Selective service permissions
  enable_cloudfront_permissions = true
  enable_iam_permissions       = true
  enable_sqs_permissions       = true
  enable_cloudwatch_permissions = true
  enable_sns_permissions       = true
  
  tags = {
    Project     = "ebook-platform"
    Environment = "prod"
    ManagedBy   = "terraform"
    CostCenter  = "engineering"
  }
}
```

### Policy Creation Only (No User Attachment)

```hcl
module "deployment_permissions" {
  source = "./modules/iam_deployment_permissions"
  
  environment          = "staging"
  deployment_user_name = ""  # Empty to skip user attachment
  
  tags = {
    Project     = "ebook-platform"
    Environment = "staging"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| environment | Environment name (dev, qa, staging, prod) | `string` | n/a | yes |
| deployment_user_name | Name of the IAM user for deployment | `string` | `""` | no |
| attach_individual_policies | Whether to attach individual service policies | `bool` | `true` | no |
| create_consolidated_policy | Whether to create a consolidated policy | `bool` | `false` | no |
| enable_cloudfront_permissions | Enable CloudFront deployment permissions | `bool` | `true` | no |
| enable_iam_permissions | Enable IAM management permissions | `bool` | `true` | no |
| enable_sqs_permissions | Enable SQS deployment permissions | `bool` | `true` | no |
| enable_cloudwatch_permissions | Enable CloudWatch deployment permissions | `bool` | `true` | no |
| enable_sns_permissions | Enable SNS deployment permissions | `bool` | `true` | no |
| tags | Common tags to apply to all resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| cloudfront_policy_arn | ARN of the CloudFront deployment policy |
| iam_policy_arn | ARN of the IAM deployment policy |
| sqs_policy_arn | ARN of the SQS deployment policy |
| cloudwatch_policy_arn | ARN of the CloudWatch deployment policy |
| sns_policy_arn | ARN of the SNS deployment policy |
| consolidated_policy_arn | ARN of the consolidated deployment policy (if created) |
| all_policy_arns | List of all created policy ARNs |
| deployment_readiness | Deployment readiness information and next steps |

## Policy Details

### CloudFront Policy
- Cache policy management (create, update, delete, list)
- Origin request policy management
- Response headers policy management
- Distribution management
- Resource tagging

### IAM Policy
- Policy management for environment-specific resources
- Role management for Lambda and API Gateway
- Policy attachment and detachment
- Resource scoped to `${environment}-*` pattern

### SQS Policy
- Queue creation and management
- Queue attribute configuration
- Resource scoped to `${environment}-*` pattern
- Dead letter queue support

### CloudWatch Policy
- Log group creation and management
- Metric filter management
- Alarm and dashboard management
- Comprehensive logging permissions

### SNS Policy
- Topic creation and management
- Subscription management
- Resource scoped to `${environment}-*` pattern

## Security Considerations

- All policies follow the principle of least privilege
- Resource ARNs are scoped to environment-specific patterns
- No wildcard permissions except where required by AWS service design
- Policies are versioned and can be updated independently

## Integration with Main Infrastructure

Add this module to your main Terraform configuration:

```hcl
# main.tf
module "deployment_permissions" {
  source = "./modules/iam_deployment_permissions"
  
  environment          = var.environment
  deployment_user_name = var.deployment_user_name
  
  tags = var.common_tags
}

# Ensure permissions are created before other resources
resource "aws_api_gateway_rest_api" "main" {
  # ... configuration
  
  depends_on = [module.deployment_permissions]
}
```

## Troubleshooting

### Common Issues

1. **User not found**: Ensure the deployment user exists before running this module
2. **Policy already exists**: Use unique environment names or policy suffixes
3. **Permission denied**: The user applying this module needs IAM policy creation permissions

### Validation

Use the included validation script to verify permissions:

```bash
./scripts/validate-permissions.sh
```

## AWS Free Tier Compliance

This module creates IAM policies which are free in AWS. The policies themselves don't incur charges, only the resources they grant access to.

## Version Compatibility

- Terraform >= 1.0
- AWS Provider >= 5.0
- Tested with AWS CLI v2