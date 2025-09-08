# Outputs for SNS module

output "topic_arns" {
  description = "ARNs of all SNS topics"
  value = {
    book_workflow       = aws_sns_topic.book_workflow.arn
    book_workflow_events = aws_sns_topic.book_workflow_events.arn
    user_notifications  = aws_sns_topic.user_notifications.arn
    system_alerts       = aws_sns_topic.system_alerts.arn
    free_tier_alerts    = var.enable_free_tier_monitoring ? aws_sns_topic.free_tier_alerts[0].arn : null
  }
}

output "topic_names" {
  description = "Names of all SNS topics"
  value = {
    book_workflow     = aws_sns_topic.book_workflow.name
    user_notifications = aws_sns_topic.user_notifications.name
    system_alerts     = aws_sns_topic.system_alerts.name
    free_tier_alerts  = var.enable_free_tier_monitoring ? aws_sns_topic.free_tier_alerts[0].name : null
  }
}

output "topic_ids" {
  description = "IDs of all SNS topics"
  value = {
    book_workflow     = aws_sns_topic.book_workflow.id
    user_notifications = aws_sns_topic.user_notifications.id
    system_alerts     = aws_sns_topic.system_alerts.id
    free_tier_alerts  = var.enable_free_tier_monitoring ? aws_sns_topic.free_tier_alerts[0].id : null
  }
}

# IAM policy for publishing to topics
output "publish_policy_arn" {
  description = "ARN of the IAM policy for publishing to SNS topics"
  value       = var.create_iam_policy ? aws_iam_policy.sns_publish[0].arn : null
}

output "publish_policy_name" {
  description = "Name of the IAM policy for publishing to SNS topics"
  value       = var.create_iam_policy ? aws_iam_policy.sns_publish[0].name : null
}

# Subscription information
output "subscriptions" {
  description = "Information about SNS subscriptions"
  value = {
    email_subscriptions = {
      system_alerts = var.alert_email != "" ? {
        topic_arn = aws_sns_topic.system_alerts.arn
        protocol  = "email"
        endpoint  = var.alert_email
      } : null
      free_tier_alerts = var.enable_free_tier_monitoring && var.alert_email != "" ? {
        topic_arn = aws_sns_topic.free_tier_alerts[0].arn
        protocol  = "email"
        endpoint  = var.alert_email
      } : null
    }
    lambda_subscriptions = {
      book_workflow = var.notification_lambda_arn != "" ? {
        topic_arn = aws_sns_topic.book_workflow.arn
        protocol  = "lambda"
        endpoint  = var.notification_lambda_arn
      } : null
      user_notifications = var.notification_lambda_arn != "" ? {
        topic_arn = aws_sns_topic.user_notifications.arn
        protocol  = "lambda"
        endpoint  = var.notification_lambda_arn
      } : null
    }
    sqs_subscriptions = {
      book_workflow = var.workflow_queue_arn != "" ? {
        topic_arn = aws_sns_topic.book_workflow.arn
        protocol  = "sqs"
        endpoint  = var.workflow_queue_arn
      } : null
      user_notifications = var.notification_queue_arn != "" ? {
        topic_arn = aws_sns_topic.user_notifications.arn
        protocol  = "sqs"
        endpoint  = var.notification_queue_arn
      } : null
    }
  }
}

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    monthly_publish_limit = 1000000      # 1M publishes
    monthly_http_delivery_limit = 100000 # 100K HTTP deliveries
    monthly_email_delivery_limit = 1000  # 1K email deliveries
    monitoring_enabled = var.enable_free_tier_monitoring
    publish_threshold = var.sns_publish_threshold
    encryption_enabled = var.enable_encryption
  }
}

# Topic configuration information
output "topic_configuration" {
  description = "SNS topic configuration details"
  value = {
    book_workflow = {
      arn = aws_sns_topic.book_workflow.arn
      name = aws_sns_topic.book_workflow.name
      encryption_enabled = var.enable_encryption
      kms_key_id = var.kms_key_id
      delivery_policy = "configured"
    }
    user_notifications = {
      arn = aws_sns_topic.user_notifications.arn
      name = aws_sns_topic.user_notifications.name
      encryption_enabled = var.enable_encryption
      kms_key_id = var.kms_key_id
      delivery_policy = "configured"
    }
    system_alerts = {
      arn = aws_sns_topic.system_alerts.arn
      name = aws_sns_topic.system_alerts.name
      encryption_enabled = var.enable_encryption
      kms_key_id = var.kms_key_id
    }
  }
}

# Integration information for Lambda functions
output "lambda_integration" {
  description = "Integration information for Lambda functions"
  value = {
    environment_variables = {
      BOOK_WORKFLOW_TOPIC_ARN = aws_sns_topic.book_workflow.arn
      USER_NOTIFICATIONS_TOPIC_ARN = aws_sns_topic.user_notifications.arn
      SYSTEM_ALERTS_TOPIC_ARN = aws_sns_topic.system_alerts.arn
    }
    required_permissions = [
      "sns:Publish"
    ]
    policy_arn = var.create_iam_policy ? aws_iam_policy.sns_publish[0].arn : null
  }
}

# Development and testing information
output "development_info" {
  description = "Development and testing information"
  value = {
    test_commands = {
      publish_test_message = "aws sns publish --topic-arn ${aws_sns_topic.book_workflow.arn} --message 'Test message'"
      list_subscriptions = "aws sns list-subscriptions-by-topic --topic-arn ${aws_sns_topic.book_workflow.arn}"
      get_topic_attributes = "aws sns get-topic-attributes --topic-arn ${aws_sns_topic.book_workflow.arn}"
    }
    message_examples = {
      book_workflow = {
        book_submitted = jsonencode({
          eventType = "book.submitted"
          bookId = "book-123"
          authorId = "user-456"
          timestamp = "2024-01-15T10:30:00Z"
          metadata = {
            title = "Sample Book"
            genre = "fiction"
          }
        })
        book_approved = jsonencode({
          eventType = "book.approved"
          bookId = "book-123"
          editorId = "user-789"
          timestamp = "2024-01-15T11:30:00Z"
          comments = "Approved for publication"
        })
      }
      user_notifications = {
        welcome_message = jsonencode({
          eventType = "user.welcome"
          userId = "user-123"
          email = "user@example.com"
          timestamp = "2024-01-15T10:00:00Z"
        })
        book_published = jsonencode({
          eventType = "book.published"
          bookId = "book-123"
          authorId = "user-456"
          timestamp = "2024-01-15T12:00:00Z"
          title = "Sample Book"
        })
      }
    }
  }
}

# Monitoring and alerting information
output "monitoring_info" {
  description = "Monitoring and alerting configuration"
  value = {
    cloudwatch_alarms = {
      publish_count = var.enable_free_tier_monitoring ? {
        alarm_name = "${var.environment}-sns-publish-count"
        threshold = var.sns_publish_threshold
        metric = "NumberOfMessagesPublished"
      } : null
      delivery_failures = {
        book_workflow = {
          alarm_name = "${var.environment}-sns-book-workflow-delivery-failures"
          threshold = 5
          metric = "NumberOfNotificationsFailed"
        }
        user_notifications = {
          alarm_name = "${var.environment}-sns-user-notifications-delivery-failures"
          threshold = 5
          metric = "NumberOfNotificationsFailed"
        }
      }
    }
    alert_destinations = {
      email = var.alert_email != "" ? var.alert_email : null
      system_alerts_topic = aws_sns_topic.system_alerts.arn
    }
  }
}