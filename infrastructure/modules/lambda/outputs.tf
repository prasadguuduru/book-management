# Outputs for Lambda module

output "lambda_function_names" {
  description = "Names of all Lambda functions"
  value = {
    for k, v in aws_lambda_function.functions : k => v.function_name
  }
}

output "lambda_function_arns" {
  description = "ARNs of all Lambda functions"
  value = {
    for k, v in aws_lambda_function.functions : k => v.arn
  }
}

output "lambda_functions" {
  description = "Complete Lambda function information"
  value = {
    for k, v in aws_lambda_function.functions : k => {
      function_name = v.function_name
      arn          = v.arn
      invoke_arn   = v.invoke_arn
      memory_size  = v.memory_size
      timeout      = v.timeout
      runtime      = v.runtime
    }
  }
}

output "lambda_function_urls" {
  description = "Lambda function URLs (if enabled)"
  value = var.enable_function_urls ? {
    for k, v in aws_lambda_function_url.function_urls : k => v.function_url
  } : {}
}

# Execution role is managed by the IAM module

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    monthly_invocation_limit = 1000000
    monthly_gb_seconds_limit = 400000
    current_reserved_concurrency = var.environment == "prod" ? 100 : 50
    monitoring_enabled = var.enable_free_tier_monitoring
    invocation_threshold = var.lambda_invocation_threshold
  }
}

# Development information
output "development_info" {
  description = "Development and testing information"
  value = {
    log_groups = {
      for k, v in aws_cloudwatch_log_group.lambda_logs : k => v.name
    }
    function_urls_enabled = var.enable_function_urls
    cors_origins = var.cors_allowed_origins
  }
}

# Service endpoints for API Gateway integration
output "service_integrations" {
  description = "Service integration information for API Gateway"
  value = {
    for k, v in aws_lambda_function.functions : k => {
      function_name   = v.function_name
      arn            = v.arn
      invoke_arn     = v.invoke_arn
      integration_uri = "arn:aws:apigateway:${data.aws_region.current.name}:lambda:path/2015-03-31/functions/${v.arn}/invocations"
    }
  }
}

# Data source for current AWS region is already declared in main.tf