# IAM module for centralized identity and access management

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

# Lambda execution role
resource "aws_iam_role" "lambda_execution" {
  name = "${var.environment}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Component = "iam"
    Purpose   = "lambda-execution"
  })
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB access policy for Lambda
resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.environment}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:ConditionCheckItem"
        ]
        Resource = [
          var.table_arn,
          "${var.table_arn}/index/*",
          "arn:aws:dynamodb:*:*:table/${var.environment}-ebook-platform*",
          "arn:aws:dynamodb:*:*:table/${var.environment}-ebook-platform*/index/*"
        ]
      }
    ]
  })
}

# DynamoDB Streams access policy (if enabled)
resource "aws_iam_role_policy" "lambda_dynamodb_streams" {
  count = var.enable_dynamodb_streams ? 1 : 0
  name  = "${var.environment}-lambda-dynamodb-streams-policy"
  role  = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ]
        Resource = "${var.table_arn}/stream/*"
      }
    ]
  })
}

# S3 access policy for Lambda
resource "aws_iam_role_policy" "lambda_s3" {
  name = "${var.environment}-lambda-s3-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:PutObjectAcl",
          "s3:GetObjectAcl"
        ]
        Resource = [
          "${var.assets_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:GetBucketVersioning"
        ]
        Resource = [
          var.assets_bucket_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = [
          "${var.frontend_bucket_arn}/*"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "public-read"
          }
        }
      }
    ]
  })
}

# SNS access policy for Lambda
resource "aws_iam_role_policy" "lambda_sns" {
  name = "${var.environment}-lambda-sns-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish",
          "sns:GetTopicAttributes",
          "sns:ListSubscriptionsByTopic"
        ]
        Resource = var.sns_topic_arns
      }
    ]
  })
}

# SQS access policy for Lambda (conditional - only if SQS queues exist)
resource "aws_iam_role_policy" "lambda_sqs" {
  count = length(var.sqs_queue_arns) > 0 ? 1 : 0
  name = "${var.environment}-lambda-sqs-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = var.sqs_queue_arns
      }
    ]
  })
}

# SES access policy for Lambda (email notifications)
resource "aws_iam_role_policy" "lambda_ses" {
  name = "${var.environment}-lambda-ses-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
          "ses:GetSendQuota",
          "ses:GetSendStatistics"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = [
              "noreply@${var.environment}-ebook-platform.com",
              "notifications@${var.environment}-ebook-platform.com"
            ]
          }
        }
      }
    ]
  })
}

# CloudWatch Logs access policy for Lambda (additional permissions)
resource "aws_iam_role_policy" "lambda_cloudwatch_logs" {
  name = "${var.environment}-lambda-cloudwatch-logs-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.environment}-*",
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/ebook-platform/${var.environment}/*"
        ]
      }
    ]
  })
}

# CloudWatch Metrics access policy for Lambda (custom metrics)
resource "aws_iam_role_policy" "lambda_cloudwatch_metrics" {
  name = "${var.environment}-lambda-cloudwatch-metrics-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = [
              "EbookPlatform/Business",
              "EbookPlatform/Security",
              "EbookPlatform/Performance"
            ]
          }
        }
      }
    ]
  })
}

# API Gateway execution role
resource "aws_iam_role" "api_gateway_execution" {
  name = "${var.environment}-api-gateway-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Component = "iam"
    Purpose   = "api-gateway-execution"
  })
}

# API Gateway CloudWatch Logs policy
resource "aws_iam_role_policy" "api_gateway_cloudwatch" {
  name = "${var.environment}-api-gateway-cloudwatch-policy"
  role = aws_iam_role.api_gateway_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents",
          "logs:GetLogEvents",
          "logs:FilterLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:API-Gateway-Execution-Logs_*"
        ]
      }
    ]
  })
}

# CloudFront Origin Access Identity (DISABLED - using Origin Access Control instead)
resource "aws_cloudfront_origin_access_identity" "frontend" {
  count   = 0  # Disabled - CloudFront module uses Origin Access Control
  comment = "${var.environment} Ebook Platform Frontend OAI"
}

# S3 bucket policy for CloudFront access (DISABLED - using Origin Access Control instead)
# resource "aws_s3_bucket_policy" "frontend_cloudfront" {
#   count  = 0  # Disabled - CloudFront module handles this with Origin Access Control
#   bucket = var.frontend_bucket_name
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid    = "AllowCloudFrontAccess"
#         Effect = "Allow"
#         Principal = {
#           AWS = aws_cloudfront_origin_access_identity.frontend[0].iam_arn
#         }
#         Action   = "s3:GetObject"
#         Resource = "${var.frontend_bucket_arn}/*"
#       }
#     ]
#   })
# }

# EventBridge (CloudWatch Events) role for scheduled tasks
resource "aws_iam_role" "eventbridge_execution" {
  count = var.enable_scheduled_tasks ? 1 : 0
  name  = "${var.environment}-eventbridge-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Component = "iam"
    Purpose   = "eventbridge-execution"
  })
}

# EventBridge Lambda invocation policy
resource "aws_iam_role_policy" "eventbridge_lambda" {
  count = var.enable_scheduled_tasks ? 1 : 0
  name  = "${var.environment}-eventbridge-lambda-policy"
  role  = aws_iam_role.eventbridge_execution[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = var.lambda_function_arns
      }
    ]
  })
}

# KMS key for encryption (optional, using AWS managed keys by default)
resource "aws_kms_key" "platform_key" {
  count       = var.enable_custom_kms_key ? 1 : 0
  description = "${var.environment} Ebook Platform encryption key"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda service"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow DynamoDB service"
        Effect = "Allow"
        Principal = {
          Service = "dynamodb.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Component = "encryption"
    Purpose   = "platform-key"
  })
}

resource "aws_kms_alias" "platform_key" {
  count         = var.enable_custom_kms_key ? 1 : 0
  name          = "alias/${var.environment}-ebook-platform"
  target_key_id = aws_kms_key.platform_key[0].key_id
}