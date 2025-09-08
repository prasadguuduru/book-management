# Outputs for IAM module

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

output "lambda_execution_role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.name
}

output "api_gateway_execution_role_arn" {
  description = "ARN of the API Gateway execution role"
  value       = aws_iam_role.api_gateway_execution.arn
}

output "api_gateway_execution_role_name" {
  description = "Name of the API Gateway execution role"
  value       = aws_iam_role.api_gateway_execution.name
}

output "cloudfront_origin_access_identity_arn" {
  description = "ARN of the CloudFront Origin Access Identity"
  value       = null  # Disabled - using Origin Access Control instead
}

output "cloudfront_origin_access_identity_path" {
  description = "CloudFront Origin Access Identity path"
  value       = null  # Disabled - using Origin Access Control instead
}

output "eventbridge_execution_role_arn" {
  description = "ARN of the EventBridge execution role"
  value       = var.enable_scheduled_tasks ? aws_iam_role.eventbridge_execution[0].arn : null
}

output "kms_key_arn" {
  description = "ARN of the custom KMS key"
  value       = var.enable_custom_kms_key ? aws_kms_key.platform_key[0].arn : null
}

output "kms_key_id" {
  description = "ID of the custom KMS key"
  value       = var.enable_custom_kms_key ? aws_kms_key.platform_key[0].key_id : null
}

output "kms_key_alias" {
  description = "Alias of the custom KMS key"
  value       = var.enable_custom_kms_key ? aws_kms_alias.platform_key[0].name : null
}

# Policy ARNs for reference
output "lambda_policies" {
  description = "Lambda IAM policy information"
  value = {
    dynamodb_policy_name = aws_iam_role_policy.lambda_dynamodb.name
    s3_policy_name = aws_iam_role_policy.lambda_s3.name
    sns_policy_name = aws_iam_role_policy.lambda_sns.name
    sqs_policy_name = length(aws_iam_role_policy.lambda_sqs_enhanced) > 0 ? aws_iam_role_policy.lambda_sqs_enhanced[0].name : null
    ses_policy_name = aws_iam_role_policy.lambda_ses.name
    cloudwatch_logs_policy_name = aws_iam_role_policy.lambda_cloudwatch_logs.name
    cloudwatch_metrics_policy_name = aws_iam_role_policy.lambda_cloudwatch_metrics.name
    dynamodb_streams_policy_name = var.enable_dynamodb_streams ? aws_iam_role_policy.lambda_dynamodb_streams[0].name : null
  }
}

# Security information
output "security_configuration" {
  description = "Security configuration details"
  value = {
    lambda_execution_role = {
      arn = aws_iam_role.lambda_execution.arn
      name = aws_iam_role.lambda_execution.name
      policies_attached = [
        "AWSLambdaBasicExecutionRole",
        "${var.environment}-lambda-dynamodb-policy",
        "${var.environment}-lambda-s3-policy",
        "${var.environment}-lambda-sns-policy",
        "${var.environment}-lambda-sqs-enhanced-policy",
        "${var.environment}-lambda-ses-policy",
        "${var.environment}-lambda-cloudwatch-logs-policy",
        "${var.environment}-lambda-cloudwatch-metrics-policy"
      ]
    }
    api_gateway_execution_role = {
      arn = aws_iam_role.api_gateway_execution.arn
      name = aws_iam_role.api_gateway_execution.name
      policies_attached = [
        "${var.environment}-api-gateway-cloudwatch-policy"
      ]
    }
    encryption = {
      kms_key_enabled = var.enable_custom_kms_key
      kms_key_arn = var.enable_custom_kms_key ? aws_kms_key.platform_key[0].arn : null
      aws_managed_keys = [
        "alias/aws/dynamodb",
        "alias/aws/s3",
        "alias/aws/sns",
        "alias/aws/sqs"
      ]
    }
  }
}

# Integration information for other modules
output "integration_info" {
  description = "Integration information for other modules"
  value = {
    lambda_role_arn = aws_iam_role.lambda_execution.arn
    api_gateway_role_arn = aws_iam_role.api_gateway_execution.arn
    cloudfront_oai_arn = null  # Disabled - using Origin Access Control instead
    eventbridge_role_arn = var.enable_scheduled_tasks ? aws_iam_role.eventbridge_execution[0].arn : null
    kms_key_id = var.enable_custom_kms_key ? aws_kms_key.platform_key[0].key_id : "alias/aws/dynamodb"
  }
}

# Compliance information
output "compliance_info" {
  description = "Compliance and security information"
  value = {
    least_privilege_implemented = true
    resource_based_policies = var.enable_cloudfront ? 1 : 0
    cross_service_access_controlled = true
    encryption_at_rest_enabled = true
    encryption_in_transit_enabled = true
    audit_logging_enabled = true
    principle_of_least_privilege = {
      lambda_functions = "Restricted to specific DynamoDB table, S3 buckets, SNS topics, and SQS queues"
      api_gateway = "Restricted to CloudWatch Logs only"
      cloudfront = "Restricted to specific S3 bucket read access only"
      eventbridge = "Restricted to specific Lambda function invocation only"
    }
  }
}

output "deployment_policy_arn" {
  description = "ARN of the Terraform deployment policy"
  value       = var.create_deployment_policy ? aws_iam_policy.terraform_deployment[0].arn : null
}

output "deployment_policy_name" {
  description = "Name of the Terraform deployment policy"
  value       = var.create_deployment_policy ? aws_iam_policy.terraform_deployment[0].name : null
}