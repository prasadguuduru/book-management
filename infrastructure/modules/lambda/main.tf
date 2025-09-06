# Lambda module for serverless functions with Free Tier optimization

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Lambda function configurations optimized for Free Tier
locals {
  lambda_functions = {
    auth-service = {
      memory_size = var.lambda_memory_size.auth_service
      timeout     = var.lambda_timeout.auth_service
      description = "Authentication and authorization service"
      environment_variables = {
        NODE_ENV = var.environment
        TABLE_NAME = var.table_name
        JWT_SECRET = var.jwt_private_key  # Use private key as secret for HS256
        JWT_PUBLIC_KEY = var.jwt_public_key
        JWT_PRIVATE_KEY = var.jwt_private_key
        ENCRYPTION_KEY = var.encryption_key
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
        CORS_ORIGIN = "*"
      }
    }
    custom-authorizer = {
      memory_size = var.lambda_memory_size.custom_authorizer
      timeout     = var.lambda_timeout.custom_authorizer
      description = "JWT token validator for API Gateway custom authorizer"
      environment_variables = {
        NODE_ENV = var.environment
        JWT_SECRET = var.jwt_private_key  # Use private key as secret for HS256
        JWT_PUBLIC_KEY = var.jwt_public_key
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
      }
    }
    book-service = {
      memory_size = var.lambda_memory_size.book_service
      timeout     = var.lambda_timeout.book_service
      description = "Book management and content operations"
      environment_variables = {
        NODE_ENV = var.environment
        TABLE_NAME = var.table_name
        ASSETS_BUCKET = var.assets_bucket_name
        JWT_SECRET = var.jwt_private_key  # Use private key as secret for HS256
        JWT_PUBLIC_KEY = var.jwt_public_key
        ENCRYPTION_KEY = var.encryption_key
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
        CORS_ORIGIN = "*"
      }
    }
    user-service = {
      memory_size = var.lambda_memory_size.user_service
      timeout     = var.lambda_timeout.user_service
      description = "User profile and preference management"
      environment_variables = {
        NODE_ENV = var.environment
        TABLE_NAME = var.table_name
        JWT_SECRET = var.jwt_private_key  # Use private key as secret for HS256
        JWT_PUBLIC_KEY = var.jwt_public_key
        ENCRYPTION_KEY = var.encryption_key
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
        CORS_ORIGIN = "*"
      }
    }
    workflow-service = {
      memory_size = var.lambda_memory_size.workflow_service
      timeout     = var.lambda_timeout.workflow_service
      description = "Book workflow and state management"
      environment_variables = {
        NODE_ENV = var.environment
        TABLE_NAME = var.table_name
        NOTIFICATION_TOPIC_ARN = var.notification_topic_arn
        JWT_PUBLIC_KEY = var.jwt_public_key
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
        CORS_ORIGIN = "*"
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
        CORS_ORIGIN = "*"
      }
    }
    review-service = {
      memory_size = var.lambda_memory_size.review_service
      timeout     = var.lambda_timeout.review_service
      description = "Review and rating management"
      environment_variables = {
        NODE_ENV = var.environment
        TABLE_NAME = var.table_name
        JWT_PUBLIC_KEY = var.jwt_public_key
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
        CORS_ORIGIN = "*"
      }
    }
    notification-service = {
      memory_size = var.lambda_memory_size.notification_service
      timeout     = var.lambda_timeout.notification_service
      description = "Multi-channel notification delivery"
      environment_variables = {
        NODE_ENV = var.environment
        TABLE_NAME = var.table_name
        SES_REGION = data.aws_region.current.name
        LOG_LEVEL = var.environment == "prod" ? "info" : "debug"
      }
    }
  }
}

# Use external IAM role (will be provided by IAM module)
# The IAM role and policies are managed by the dedicated IAM module

# Create placeholder Lambda code for initial deployment
resource "local_file" "lambda_placeholder" {
  for_each = local.lambda_functions
  
  filename = "${path.module}/../../tmp/${each.key}/index.js"
  content  = <<-EOT
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Basic health check response
    if (event.httpMethod === 'GET' && event.path === '/health') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            body: JSON.stringify({
                message: 'Service ${each.key} is running',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'unknown',
                service: '${each.key}'
            })
        };
    }
    
    // Default response for other requests
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({
            message: 'Function ${each.key} not yet implemented',
            timestamp: new Date().toISOString(),
            event: event
        })
    };
};
EOT
}

# Create ZIP files for Lambda deployment
data "archive_file" "lambda_placeholder" {
  for_each = local.lambda_functions
  
  type        = "zip"
  source_dir  = "${path.module}/../../tmp/${each.key}"
  output_path = "${path.module}/../../tmp/${each.key}.zip"
  
  depends_on = [local_file.lambda_placeholder]
}

# CloudWatch Logs groups for each Lambda function
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${var.environment}-${each.key}"
  retention_in_days = var.environment == "prod" ? 30 : 7
  
  tags = merge(var.tags, {
    Function = each.key
  })
}

# Lambda functions
resource "aws_lambda_function" "functions" {
  for_each = local.lambda_functions

  function_name    = "${var.environment}-${each.key}"
  role            = var.lambda_execution_role_arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  memory_size     = each.value.memory_size
  timeout         = each.value.timeout
  description     = each.value.description

  # Use real ZIP files for local development, placeholder for others
  filename         = var.environment == "local" && fileexists("${var.lambda_zip_path}/${each.key}.zip") ? "${var.lambda_zip_path}/${each.key}.zip" : data.archive_file.lambda_placeholder[each.key].output_path
  source_code_hash = var.environment == "local" && fileexists("${var.lambda_zip_path}/${each.key}.zip") ? filebase64sha256("${var.lambda_zip_path}/${each.key}.zip") : data.archive_file.lambda_placeholder[each.key].output_base64sha256

  environment {
    variables = each.value.environment_variables
  }

  # Reserved concurrency to prevent runaway costs
  # Disabled for dev/qa to avoid account concurrency limits
  reserved_concurrent_executions = var.environment == "prod" ? 100 : null

  # Disable X-Ray tracing to avoid costs (not in Free Tier after first month)
  tracing_config {
    mode = "PassThrough"
  }

  tags = merge(var.tags, {
    Service     = each.key
    MemorySize  = each.value.memory_size
    Timeout     = each.value.timeout
  })

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
  ]

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}

# Lambda function URLs for direct HTTP access (alternative to API Gateway for development)
resource "aws_lambda_function_url" "function_urls" {
  for_each = var.enable_function_urls ? local.lambda_functions : {}

  function_name      = aws_lambda_function.functions[each.key].function_name
  authorization_type = "NONE"  # Use custom auth in function

  cors {
    allow_credentials = false
    allow_origins     = var.cors_allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers     = ["date", "keep-alive", "content-type", "authorization", "x-requested-with"]
    expose_headers    = ["date", "keep-alive"]
    max_age          = 86400
  }
}

# CloudWatch alarms for Lambda invocations (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "lambda_invocations" {
  for_each = var.enable_free_tier_monitoring ? local.lambda_functions : {}

  alarm_name          = "${var.environment}-lambda-${each.key}-invocations"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Invocations"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.lambda_invocation_threshold
  alarm_description   = "Lambda ${each.key} invocations approaching threshold"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    FunctionName = aws_lambda_function.functions[each.key].function_name
  }

  tags = var.tags
}

# CloudWatch alarms for Lambda errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = local.lambda_functions

  alarm_name          = "${var.environment}-lambda-${each.key}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Lambda ${each.key} error rate is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    FunctionName = aws_lambda_function.functions[each.key].function_name
  }

  tags = var.tags
}