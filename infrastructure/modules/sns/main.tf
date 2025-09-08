# SNS module for event-driven notifications with Free Tier optimization

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

# SNS topic for book workflow notifications (legacy)
resource "aws_sns_topic" "book_workflow" {
  name = "${var.environment}-book-workflow-notifications"

  # Disable encryption for now to fix SNS → SQS delivery issues
  # kms_master_key_id = var.enable_encryption ? var.kms_key_id : null

  # Delivery policy for retry logic
  delivery_policy = jsonencode({
    "http" = {
      "defaultHealthyRetryPolicy" = {
        "minDelayTarget"     = 20
        "maxDelayTarget"     = 20
        "numRetries"         = 3
        "numMaxDelayRetries" = 0
        "numMinDelayRetries" = 0
        "numNoDelayRetries"  = 0
        "backoffFunction"    = "linear"
      }
      "disableSubscriptionOverrides" = false
    }
  })

  tags = merge(var.tags, {
    Component = "notifications"
    Purpose   = "book-workflow"
  })
}

# SNS topic for book workflow events (event-driven architecture)
resource "aws_sns_topic" "book_workflow_events" {
  name = "${var.environment}-book-workflow-events"

  # Disable encryption for now to fix SNS → SQS delivery issues
  # kms_master_key_id = var.enable_encryption ? var.kms_key_id : null

  # Delivery policy for retry logic
  delivery_policy = jsonencode({
    "http" = {
      "defaultHealthyRetryPolicy" = {
        "minDelayTarget"     = 20
        "maxDelayTarget"     = 20
        "numRetries"         = 3
        "numMaxDelayRetries" = 0
        "numMinDelayRetries" = 0
        "numNoDelayRetries"  = 0
        "backoffFunction"    = "linear"
      }
      "disableSubscriptionOverrides" = false
    }
  })

  tags = merge(var.tags, {
    Component = "events"
    Purpose   = "book-workflow-events"
  })
}

# SNS topic for user notifications
resource "aws_sns_topic" "user_notifications" {
  name = "${var.environment}-user-notifications"

  # Disable encryption for now to fix SNS → SQS delivery issues
  # kms_master_key_id = var.enable_encryption ? var.kms_key_id : null

  # Delivery policy for retry logic
  delivery_policy = jsonencode({
    "http" = {
      "defaultHealthyRetryPolicy" = {
        "minDelayTarget"     = 20
        "maxDelayTarget"     = 20
        "numRetries"         = 3
        "numMaxDelayRetries" = 0
        "numMinDelayRetries" = 0
        "numNoDelayRetries"  = 0
        "backoffFunction"    = "linear"
      }
      "disableSubscriptionOverrides" = false
    }
  })

  tags = merge(var.tags, {
    Component = "notifications"
    Purpose   = "user-notifications"
  })
}

# SNS topic for system alerts and monitoring
resource "aws_sns_topic" "system_alerts" {
  name = "${var.environment}-system-alerts"

  # Enable server-side encryption
  kms_master_key_id = var.enable_encryption ? var.kms_key_id : null

  tags = merge(var.tags, {
    Component = "monitoring"
    Purpose   = "system-alerts"
  })
}

# SNS topic for Free Tier usage alerts
resource "aws_sns_topic" "free_tier_alerts" {
  count = var.enable_free_tier_monitoring ? 1 : 0
  name  = "${var.environment}-free-tier-alerts"

  # Enable server-side encryption
  kms_master_key_id = "alias/aws/sns"

  tags = merge(var.tags, {
    Component = "monitoring"
    Purpose   = "free-tier-alerts"
  })
}

# Email subscription for system alerts (if email provided)
resource "aws_sns_topic_subscription" "system_alerts_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.system_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Email subscription for Free Tier alerts (if email provided)
resource "aws_sns_topic_subscription" "free_tier_alerts_email" {
  count     = var.enable_free_tier_monitoring && var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.free_tier_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Lambda subscription for book workflow notifications
resource "aws_sns_topic_subscription" "book_workflow_lambda" {
  count     = var.notification_lambda_arn != "" ? 1 : 0
  topic_arn = aws_sns_topic.book_workflow.arn
  protocol  = "lambda"
  endpoint  = var.notification_lambda_arn
}

# Lambda subscription for user notifications
resource "aws_sns_topic_subscription" "user_notifications_lambda" {
  count     = var.notification_lambda_arn != "" ? 1 : 0
  topic_arn = aws_sns_topic.user_notifications.arn
  protocol  = "lambda"
  endpoint  = var.notification_lambda_arn
}

# SQS subscription for book workflow (for reliable processing)
resource "aws_sns_topic_subscription" "book_workflow_sqs" {
  count     = var.workflow_queue_arn != "" ? 1 : 0
  topic_arn = aws_sns_topic.book_workflow.arn
  protocol  = "sqs"
  endpoint  = var.workflow_queue_arn
}

# SQS subscription for user notifications (for reliable processing)
resource "aws_sns_topic_subscription" "user_notifications_sqs" {
  count     = var.notification_queue_arn != "" ? 1 : 0
  topic_arn = aws_sns_topic.user_notifications.arn
  protocol  = "sqs"
  endpoint  = var.notification_queue_arn
}

# SQS subscription for book workflow events (event-driven notifications)
resource "aws_sns_topic_subscription" "book_workflow_events_sqs" {
  count     = var.notification_queue_arn != "" ? 1 : 0
  topic_arn = aws_sns_topic.book_workflow_events.arn
  protocol  = "sqs"
  endpoint  = var.notification_queue_arn
}

# IAM policy for Lambda to publish to SNS topics
resource "aws_iam_policy" "sns_publish" {
  count       = var.create_iam_policy ? 1 : 0
  name        = "${var.environment}-sns-publish-policy"
  description = "Policy for Lambda functions to publish to SNS topics"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.book_workflow.arn,
          aws_sns_topic.user_notifications.arn,
          aws_sns_topic.system_alerts.arn
        ]
      }
    ]
  })

  tags = var.tags
}

# CloudWatch alarms for SNS (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "sns_publish_count" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-sns-publish-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NumberOfMessagesPublished"
  namespace           = "AWS/SNS"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.sns_publish_threshold
  alarm_description   = "SNS message publishes approaching Free Tier limit"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]

  dimensions = {
    TopicName = aws_sns_topic.book_workflow.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "sns_delivery_failures" {
  for_each = {
    book_workflow     = aws_sns_topic.book_workflow.name
    user_notifications = aws_sns_topic.user_notifications.name
  }

  alarm_name          = "${var.environment}-sns-${each.key}-delivery-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NumberOfNotificationsFailed"
  namespace           = "AWS/SNS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "SNS delivery failures for ${each.key} topic"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]

  dimensions = {
    TopicName = each.value
  }

  tags = var.tags
}

# SNS topic policy for cross-service access
resource "aws_sns_topic_policy" "book_workflow" {
  arn = aws_sns_topic.book_workflow.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.book_workflow.arn
        Condition = {
          StringEquals = {
            "aws:PrincipalServiceName" = "lambda.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_sns_topic_policy" "user_notifications" {
  arn = aws_sns_topic.user_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.user_notifications.arn
        Condition = {
          StringEquals = {
            "aws:PrincipalServiceName" = "lambda.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_sns_topic_policy" "book_workflow_events" {
  arn = aws_sns_topic.book_workflow_events.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.book_workflow_events.arn
        Condition = {
          StringEquals = {
            "aws:PrincipalServiceName" = "lambda.amazonaws.com"
          }
        }
      }
    ]
  })
}