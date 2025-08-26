# IAM Permissions module for cross-service access permissions

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

# Lambda permissions for API Gateway invocation
resource "aws_lambda_permission" "api_gateway_auth" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_book" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.book_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_user" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.user_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_workflow" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.workflow_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_review" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.review_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_notification" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.notification_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# Lambda permissions for WebSocket API Gateway invocation
resource "aws_lambda_permission" "websocket_api_gateway" {
  statement_id  = "AllowExecutionFromWebSocketAPI"
  action        = "lambda:InvokeFunction"
  function_name = var.notification_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*/*/*"
}

# SNS topic policies to allow Lambda publishing
resource "aws_sns_topic_policy" "lambda_publish_notifications" {
  arn = var.notification_topic_arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          AWS = [
            for func_name, func_info in var.lambda_functions : func_info.arn
          ]
        }
        Action = [
          "sns:Publish",
          "sns:GetTopicAttributes"
        ]
        Resource = var.notification_topic_arn
      }
    ]
  })
}

# SQS queue policies to allow SNS delivery and Lambda consumption
resource "aws_sqs_queue_policy" "workflow_queue" {
  queue_url = var.workflow_queue_arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSNSPublish"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "sqs:SendMessage"
        ]
        Resource = var.workflow_queue_arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowLambdaAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            var.lambda_functions["workflow-service"].arn,
            var.lambda_functions["notification-service"].arn
          ]
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = var.workflow_queue_arn
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "notification_queue" {
  queue_url = var.notification_queue_arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSNSPublish"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "sqs:SendMessage"
        ]
        Resource = var.notification_queue_arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowLambdaAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            var.lambda_functions["notification-service"].arn
          ]
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = var.notification_queue_arn
      }
    ]
  })
}

# Lambda event source mappings for SQS queues
resource "aws_lambda_event_source_mapping" "workflow_queue" {
  count = var.enable_sqs_triggers ? 1 : 0

  event_source_arn = var.workflow_queue_arn
  function_name    = var.workflow_service_function_name
  batch_size       = 10
  maximum_batching_window_in_seconds = 5

  # Error handling
  function_response_types = ["ReportBatchItemFailures"]

  # Scaling configuration
  scaling_config {
    maximum_concurrency = 10
  }
}

resource "aws_lambda_event_source_mapping" "notification_queue" {
  count = var.enable_sqs_triggers ? 1 : 0

  event_source_arn = var.notification_queue_arn
  function_name    = var.notification_service_function_name
  batch_size       = 10
  maximum_batching_window_in_seconds = 5

  # Error handling
  function_response_types = ["ReportBatchItemFailures"]

  # Scaling configuration
  scaling_config {
    maximum_concurrency = 10
  }
}

# DynamoDB Streams event source mapping (if enabled)
resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  count = var.enable_dynamodb_streams ? 1 : 0

  event_source_arn  = var.dynamodb_stream_arn
  function_name     = var.notification_service_function_name
  starting_position = "LATEST"
  batch_size        = var.dynamodb_batch_size
  maximum_batching_window_in_seconds = 5

  # Error handling
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

# Cross-account access policy for development/staging environments
# Note: This policy is disabled for now as it requires Lambda execution role ARN
# which is not currently exposed by the Lambda module. Enable if cross-account
# access is needed by adding lambda_execution_role_arn to the Lambda module outputs.
# resource "aws_iam_role_policy" "cross_account_access" {
#   count = var.environment != "prod" ? 1 : 0
#   name  = "${var.environment}-cross-account-access-policy"
#   role  = var.lambda_execution_role_name  # Would need this variable
# 
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect = "Allow"
#         Action = [
#           "sts:AssumeRole"
#         ]
#         Resource = [
#           "arn:aws:iam::*:role/${var.environment}-*"
#         ]
#         Condition = {
#           StringEquals = {
#             "sts:ExternalId" = "${var.environment}-ebook-platform"
#           }
#         }
#       }
#     ]
#   })
# }

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