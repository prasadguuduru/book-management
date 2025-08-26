# SQS module for reliable message processing with Free Tier optimization

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

# SQS queue for book workflow processing
resource "aws_sqs_queue" "book_workflow" {
  name = "${var.environment}-book-workflow-queue"

  # Message retention and visibility
  message_retention_seconds = var.message_retention_seconds
  visibility_timeout_seconds = var.visibility_timeout_seconds

  # Dead letter queue configuration
  redrive_policy = var.enable_dlq ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.book_workflow_dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  }) : null

  # Server-side encryption
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sqs" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "book-workflow"
  })
}

# Dead letter queue for book workflow
resource "aws_sqs_queue" "book_workflow_dlq" {
  count = var.enable_dlq ? 1 : 0
  name  = "${var.environment}-book-workflow-dlq"

  # Longer retention for failed messages
  message_retention_seconds = var.dlq_message_retention_seconds

  # Server-side encryption
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sqs" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "book-workflow-dlq"
  })
}

# SQS queue for user notifications processing
resource "aws_sqs_queue" "user_notifications" {
  name = "${var.environment}-user-notifications-queue"

  # Message retention and visibility
  message_retention_seconds = var.message_retention_seconds
  visibility_timeout_seconds = var.visibility_timeout_seconds

  # Dead letter queue configuration
  redrive_policy = var.enable_dlq ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.user_notifications_dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  }) : null

  # Server-side encryption
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sqs" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "user-notifications"
  })
}

# Dead letter queue for user notifications
resource "aws_sqs_queue" "user_notifications_dlq" {
  count = var.enable_dlq ? 1 : 0
  name  = "${var.environment}-user-notifications-dlq"

  # Longer retention for failed messages
  message_retention_seconds = var.dlq_message_retention_seconds

  # Server-side encryption
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sqs" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "user-notifications-dlq"
  })
}

# SQS queue for email processing
resource "aws_sqs_queue" "email_processing" {
  name = "${var.environment}-email-processing-queue"

  # Message retention and visibility
  message_retention_seconds = var.message_retention_seconds
  visibility_timeout_seconds = var.email_processing_timeout

  # Dead letter queue configuration
  redrive_policy = var.enable_dlq ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.email_processing_dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  }) : null

  # Server-side encryption
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sqs" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "email-processing"
  })
}

# Dead letter queue for email processing
resource "aws_sqs_queue" "email_processing_dlq" {
  count = var.enable_dlq ? 1 : 0
  name  = "${var.environment}-email-processing-dlq"

  # Longer retention for failed messages
  message_retention_seconds = var.dlq_message_retention_seconds

  # Server-side encryption
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sqs" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "email-processing-dlq"
  })
}

# SQS queue policies for SNS integration
resource "aws_sqs_queue_policy" "book_workflow" {
  queue_url = aws_sqs_queue.book_workflow.id

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
        Resource = aws_sqs_queue.book_workflow.arn
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
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.book_workflow.arn
        Condition = {
          StringEquals = {
            "aws:PrincipalServiceName" = "lambda.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "user_notifications" {
  queue_url = aws_sqs_queue.user_notifications.id

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
        Resource = aws_sqs_queue.user_notifications.arn
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
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.user_notifications.arn
        Condition = {
          StringEquals = {
            "aws:PrincipalServiceName" = "lambda.amazonaws.com"
          }
        }
      }
    ]
  })
}

# IAM policy for Lambda to access SQS queues
resource "aws_iam_policy" "sqs_access" {
  name        = "${var.environment}-sqs-access-policy"
  description = "Policy for Lambda functions to access SQS queues"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.book_workflow.arn,
          aws_sqs_queue.user_notifications.arn,
          aws_sqs_queue.email_processing.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:GetQueueAttributes"
        ]
        Resource = concat(
          var.enable_dlq ? [
            aws_sqs_queue.book_workflow_dlq[0].arn,
            aws_sqs_queue.user_notifications_dlq[0].arn,
            aws_sqs_queue.email_processing_dlq[0].arn
          ] : [],
          []
        )
      }
    ]
  })

  tags = var.tags
}

# CloudWatch alarms for SQS (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "sqs_message_count" {
  for_each = {
    book_workflow     = aws_sqs_queue.book_workflow.name
    user_notifications = aws_sqs_queue.user_notifications.name
    email_processing  = aws_sqs_queue.email_processing.name
  }

  alarm_name          = "${var.environment}-sqs-${each.key}-message-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.message_count_threshold
  alarm_description   = "SQS ${each.key} queue has high message count"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    QueueName = each.value
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  for_each = var.enable_dlq ? {
    book_workflow     = aws_sqs_queue.book_workflow_dlq[0].name
    user_notifications = aws_sqs_queue.user_notifications_dlq[0].name
    email_processing  = aws_sqs_queue.email_processing_dlq[0].name
  } : {}

  alarm_name          = "${var.environment}-sqs-${each.key}-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0"
  alarm_description   = "Messages in ${each.key} DLQ - requires investigation"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    QueueName = each.value
  }

  tags = var.tags
}

# CloudWatch alarm for total SQS requests (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "sqs_total_requests" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-sqs-total-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NumberOfMessagesSent"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.sqs_request_threshold
  alarm_description   = "SQS requests approaching Free Tier limit"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  tags = var.tags
}