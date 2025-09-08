# IAM Permissions module for cross-service access permissions
# Lambda permissions for API Gateway are handled in the API Gateway module

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values for configuration
locals {
  # SNS topic policy is disabled to prevent PrincipalNotFound errors
  # Lambda functions get SNS permissions through their execution role instead
  should_create_sns_policy = false
  
  # Extract Lambda function ARNs from the provided variables for other uses
  lambda_function_arns = [
    for name, func_info in var.lambda_functions : func_info.arn
  ]
}

# NOTE: Lambda permissions for API Gateway invocation are handled in the API Gateway module
# This prevents duplicate resource conflicts that cause deployment hangs

# SNS topic policy to allow Lambda publishing - DISABLED due to PrincipalNotFound errors
# The Lambda functions already have SNS publish permissions through their execution role
# This resource-based policy is not required for Lambda to publish to SNS
# resource "aws_sns_topic_policy" "lambda_publish_notifications" {
#   count = 0  # Disabled to prevent PrincipalNotFound errors
#   
#   arn = var.notification_topic_arn
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid    = "AllowAccountAccess"
#         Effect = "Allow"
#         Principal = {
#           AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
#         }
#         Action = [
#           "sns:Publish",
#           "sns:GetTopicAttributes",
#           "sns:Subscribe",
#           "sns:Unsubscribe"
#         ]
#         Resource = var.notification_topic_arn
#       }
#     ]
#   })
# }

# Since we cleaned up orphaned mappings, we can create new ones safely
# The lifecycle rules will prevent unwanted recreation

# Lambda event source mappings for SQS queues (fixed: removed invalid starting_position)
resource "aws_lambda_event_source_mapping" "workflow_queue" {
  count = var.enable_sqs_triggers ? 1 : 0

  event_source_arn = var.workflow_queue_arn
  function_name    = var.workflow_service_function_name
  
  # SQS-specific configuration (starting_position removed - not valid for SQS)
  batch_size                         = var.sqs_batch_size
  maximum_batching_window_in_seconds = var.sqs_maximum_batching_window
  
  # Enable partial batch failure reporting to handle individual message failures
  function_response_types = ["ReportBatchItemFailures"]
  
  # Scaling configuration to prevent overwhelming the system
  scaling_config {
    maximum_concurrency = 10
  }
  
  # Filter criteria to process only relevant workflow events
  filter_criteria {
    filter {
      pattern = jsonencode({
        eventSource = ["aws:sqs"]
        body = {
          eventType = ["book.submitted", "book.approved", "book.rejected", "book.published"]
        }
      })
    }
  }
  
  # Lifecycle rules to prevent recreation of existing mappings
  lifecycle {
    ignore_changes = [
      last_processing_result,
      state,
      state_transition_reason
    ]
    
    # Prevent destruction if the mapping is being used
    prevent_destroy = false
  }
}

resource "aws_lambda_event_source_mapping" "notification_queue" {
  count = var.enable_sqs_triggers ? 1 : 0

  event_source_arn = var.notification_queue_arn
  function_name    = var.notification_service_function_name
  
  # SQS-specific configuration (starting_position removed - not valid for SQS)
  batch_size                         = var.sqs_batch_size
  maximum_batching_window_in_seconds = var.sqs_maximum_batching_window
  
  # Enable partial batch failure reporting to handle individual message failures
  function_response_types = ["ReportBatchItemFailures"]
  
  # Scaling configuration for notification processing
  scaling_config {
    maximum_concurrency = 5  # Lower concurrency for email processing
  }
  
  # Lifecycle rules to prevent recreation of existing mappings
  lifecycle {
    ignore_changes = [
      last_processing_result,
      state,
      state_transition_reason
    ]
    
    # Prevent destruction if the mapping is being used
    prevent_destroy = false
  }
}

# DynamoDB stream mappings are created fresh since we cleaned up orphaned ones

# DynamoDB Streams event source mapping (starting_position is valid for streams)
resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  count = var.enable_dynamodb_streams && var.dynamodb_stream_arn != "" ? 1 : 0

  event_source_arn  = var.dynamodb_stream_arn
  function_name     = var.notification_service_function_name
  
  # DynamoDB-specific configuration (starting_position is required for streams)
  starting_position = "LATEST"
  batch_size        = var.dynamodb_batch_size
  maximum_batching_window_in_seconds = 5

  # Error handling for stream processing
  function_response_types = ["ReportBatchItemFailures"]

  # Filter criteria for relevant events only
  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
        dynamodb = {
          NewImage = {
            entityType = {
              S = ["BOOK", "USER", "REVIEW"]
            }
          }
        }
      })
    }
  }
  
  # Lifecycle rules to prevent recreation of existing mappings
  lifecycle {
    ignore_changes = [
      last_processing_result,
      state,
      state_transition_reason
    ]
    
    # Prevent destruction if the mapping is being used
    prevent_destroy = false
  }
}

# S3 bucket notification configuration (if enabled)
resource "aws_s3_bucket_notification" "assets_bucket" {
  count  = var.enable_s3_notifications ? 1 : 0
  bucket = var.frontend_bucket_name

  lambda_function {
    lambda_function_arn = var.notification_service_function_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ""
  }

  depends_on = [aws_lambda_permission.s3_invoke_lambda]
}

# Lambda permission for S3 bucket notifications
resource "aws_lambda_permission" "s3_invoke_lambda" {
  count = var.enable_s3_notifications ? 1 : 0

  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = var.notification_service_function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.assets_bucket_arn
}

# CloudFront distribution policy for S3 access (if enabled)
resource "aws_s3_bucket_policy" "cloudfront_access" {
  count  = var.enable_cloudfront ? 1 : 0
  bucket = var.frontend_bucket_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${var.frontend_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = var.cloudfront_distribution_arn
          }
        }
      }
    ]
  })
}

# API Gateway CloudWatch role (global setting)
# This resource was missing from Terraform state, causing the deployment issues after 5pm PT
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = var.api_gateway_cloudwatch_role_arn
}

# EventBridge rules for scheduled tasks (if enabled)
resource "aws_cloudwatch_event_rule" "daily_cleanup" {
  count = var.enable_scheduled_tasks ? 1 : 0

  name                = "${var.environment}-daily-cleanup"
  description         = "Daily cleanup tasks"
  schedule_expression = "cron(0 2 * * ? *)"  # 2 AM UTC daily

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "daily_cleanup_lambda" {
  count = var.enable_scheduled_tasks ? 1 : 0

  rule      = aws_cloudwatch_event_rule.daily_cleanup[0].name
  target_id = "DailyCleanupLambdaTarget"
  arn       = var.lambda_functions["notification-service"].arn

  input = jsonencode({
    action = "daily_cleanup"
    timestamp = "scheduled"
  })
}

# Lambda permission for EventBridge invocation
resource "aws_lambda_permission" "eventbridge_invoke" {
  count = var.enable_scheduled_tasks ? 1 : 0

  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = var.notification_service_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_cleanup[0].arn
}

# Additional IAM policy for API Gateway to invoke Lambda authorizer
resource "aws_iam_role_policy" "api_gateway_lambda_authorizer" {
  name = "${var.environment}-api-gateway-lambda-authorizer-policy"
  role = split("/", var.api_gateway_cloudwatch_role_arn)[1]  # Extract role name from ARN

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = var.lambda_functions["auth-service"].arn
      }
    ]
  })
}

# Resource-based policy for DynamoDB table (additional security)
resource "aws_dynamodb_resource_policy" "table_policy" {
  count        = var.environment == "prod" ? 1 : 0
  resource_arn = var.table_arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            for func_name, func_info in var.lambda_functions : func_info.arn
          ]
        }
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          var.table_arn,
          "${var.table_arn}/index/*"
        ]
      }
    ]
  })
}
