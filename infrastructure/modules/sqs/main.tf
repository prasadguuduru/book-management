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

  # Disable encryption for now to fix SNS → SQS delivery issues
  # kms_master_key_id                 = var.enable_encryption ? "alias/aws/sns" : null
  # kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

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

  # Server-side encryption - hardcoded to alias/aws/sns for SNS compatibility
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sns" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "book-workflow-dlq"
  })
}

# SQS queue for user notifications processing (book workflow notifications)
resource "aws_sqs_queue" "user_notifications" {
  name = "${var.environment}-user-notifications-queue"

  # Message retention and visibility - optimized for notification processing
  message_retention_seconds = var.message_retention_seconds
  visibility_timeout_seconds = var.queue_configurations.user_notifications.visibility_timeout_seconds

  # Dead letter queue configuration with proper retry handling
  redrive_policy = var.enable_dlq ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.user_notifications_dlq[0].arn
    maxReceiveCount     = var.queue_configurations.user_notifications.max_receive_count
  }) : null

  # Enable long polling to reduce empty receives
  receive_wait_time_seconds = 20

  # Disable encryption for now to fix SNS → SQS delivery issues
  # kms_master_key_id                 = var.enable_encryption ? "alias/aws/sns" : null
  # kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "user-notifications"
    Service   = "book-workflow-notifications"
  })
}

# Dead letter queue for user notifications (book workflow notifications)
resource "aws_sqs_queue" "user_notifications_dlq" {
  count = var.enable_dlq ? 1 : 0
  name  = "${var.environment}-user-notifications-dlq"

  # Extended retention for failed messages to allow investigation
  message_retention_seconds = var.dlq_message_retention_seconds

  # Longer visibility timeout for manual processing
  visibility_timeout_seconds = 900  # 15 minutes for manual investigation

  # Enable long polling for DLQ monitoring
  receive_wait_time_seconds = 20

  # Server-side encryption - hardcoded to alias/aws/sns for SNS compatibility
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sns" : null
  kms_data_key_reuse_period_seconds = var.enable_encryption ? 300 : null

  tags = merge(var.tags, {
    Component = "messaging"
    Purpose   = "user-notifications-dlq"
    Service   = "book-workflow-notifications"
    AlertLevel = "critical"
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

  # Server-side encryption - hardcoded to alias/aws/sns for SNS compatibility
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sns" : null
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

  # Server-side encryption - hardcoded to alias/aws/sns for SNS compatibility
  kms_master_key_id                 = var.enable_encryption ? "alias/aws/sns" : null
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
          ArnEquals = {
            "aws:SourceArn" = var.book_workflow_events_topic_arn
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

# Enhanced DLQ monitoring with immediate alerts
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
  period              = "60"  # Check every minute for immediate alerts
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "CRITICAL: Messages in ${each.key} DLQ - requires immediate investigation"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }

  tags = merge(var.tags, {
    AlertLevel = "critical"
    Component  = "messaging"
    Purpose    = "dlq-monitoring"
  })
}

# DLQ age monitoring - alert if messages are stuck in DLQ
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_message_age" {
  for_each = var.enable_dlq ? {
    book_workflow     = aws_sqs_queue.book_workflow_dlq[0].name
    user_notifications = aws_sqs_queue.user_notifications_dlq[0].name
    email_processing  = aws_sqs_queue.email_processing_dlq[0].name
  } : {}

  alarm_name          = "${var.environment}-sqs-${each.key}-dlq-message-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "3600"  # 1 hour
  alarm_description   = "WARNING: Old messages in ${each.key} DLQ - manual intervention needed"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }

  tags = merge(var.tags, {
    AlertLevel = "warning"
    Component  = "messaging"
    Purpose    = "dlq-age-monitoring"
  })
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

# Monitor message processing failures - high receive count indicates retry issues
resource "aws_cloudwatch_metric_alarm" "sqs_high_receive_count" {
  for_each = {
    book_workflow     = aws_sqs_queue.book_workflow.name
    user_notifications = aws_sqs_queue.user_notifications.name
    email_processing  = aws_sqs_queue.email_processing.name
  }

  alarm_name          = "${var.environment}-sqs-${each.key}-high-receive-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NumberOfMessagesReceived"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"  # Alert if too many receives (indicating retries)
  alarm_description   = "High message receive count for ${each.key} - possible retry issues"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }

  tags = merge(var.tags, {
    AlertLevel = "warning"
    Component  = "messaging"
    Purpose    = "retry-monitoring"
  })
}