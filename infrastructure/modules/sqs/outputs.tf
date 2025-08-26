# Outputs for SQS module

output "queue_urls" {
  description = "URLs of all SQS queues"
  value = {
    book_workflow     = aws_sqs_queue.book_workflow.id
    user_notifications = aws_sqs_queue.user_notifications.id
    email_processing  = aws_sqs_queue.email_processing.id
  }
}

output "queue_arns" {
  description = "ARNs of all SQS queues"
  value = {
    book_workflow     = aws_sqs_queue.book_workflow.arn
    user_notifications = aws_sqs_queue.user_notifications.arn
    email_processing  = aws_sqs_queue.email_processing.arn
  }
}

output "queue_names" {
  description = "Names of all SQS queues"
  value = {
    book_workflow     = aws_sqs_queue.book_workflow.name
    user_notifications = aws_sqs_queue.user_notifications.name
    email_processing  = aws_sqs_queue.email_processing.name
  }
}

# Dead letter queue information
output "dlq_urls" {
  description = "URLs of dead letter queues (if enabled)"
  value = var.enable_dlq ? {
    book_workflow     = aws_sqs_queue.book_workflow_dlq[0].id
    user_notifications = aws_sqs_queue.user_notifications_dlq[0].id
    email_processing  = aws_sqs_queue.email_processing_dlq[0].id
  } : {}
}

output "dlq_arns" {
  description = "ARNs of dead letter queues (if enabled)"
  value = var.enable_dlq ? {
    book_workflow     = aws_sqs_queue.book_workflow_dlq[0].arn
    user_notifications = aws_sqs_queue.user_notifications_dlq[0].arn
    email_processing  = aws_sqs_queue.email_processing_dlq[0].arn
  } : {}
}

# IAM policy for queue access
output "access_policy_arn" {
  description = "ARN of the IAM policy for accessing SQS queues"
  value       = aws_iam_policy.sqs_access.arn
}

output "access_policy_name" {
  description = "Name of the IAM policy for accessing SQS queues"
  value       = aws_iam_policy.sqs_access.name
}

# Queue configuration information
output "queue_configuration" {
  description = "SQS queue configuration details"
  value = {
    book_workflow = {
      url = aws_sqs_queue.book_workflow.id
      arn = aws_sqs_queue.book_workflow.arn
      name = aws_sqs_queue.book_workflow.name
      visibility_timeout = var.visibility_timeout_seconds
      message_retention = var.message_retention_seconds
      dlq_enabled = var.enable_dlq
      dlq_arn = var.enable_dlq ? aws_sqs_queue.book_workflow_dlq[0].arn : null
      encryption_enabled = var.enable_encryption
    }
    user_notifications = {
      url = aws_sqs_queue.user_notifications.id
      arn = aws_sqs_queue.user_notifications.arn
      name = aws_sqs_queue.user_notifications.name
      visibility_timeout = var.visibility_timeout_seconds
      message_retention = var.message_retention_seconds
      dlq_enabled = var.enable_dlq
      dlq_arn = var.enable_dlq ? aws_sqs_queue.user_notifications_dlq[0].arn : null
      encryption_enabled = var.enable_encryption
    }
    email_processing = {
      url = aws_sqs_queue.email_processing.id
      arn = aws_sqs_queue.email_processing.arn
      name = aws_sqs_queue.email_processing.name
      visibility_timeout = var.email_processing_timeout
      message_retention = var.message_retention_seconds
      dlq_enabled = var.enable_dlq
      dlq_arn = var.enable_dlq ? aws_sqs_queue.email_processing_dlq[0].arn : null
      encryption_enabled = var.enable_encryption
    }
  }
}

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    monthly_request_limit = 1000000  # 1M requests
    monitoring_enabled = var.enable_free_tier_monitoring
    request_threshold = var.sqs_request_threshold
    message_count_threshold = var.message_count_threshold
    encryption_enabled = var.enable_encryption
    dlq_enabled = var.enable_dlq
  }
}

# Lambda integration information
output "lambda_integration" {
  description = "Integration information for Lambda functions"
  value = {
    environment_variables = {
      BOOK_WORKFLOW_QUEUE_URL = aws_sqs_queue.book_workflow.id
      USER_NOTIFICATIONS_QUEUE_URL = aws_sqs_queue.user_notifications.id
      EMAIL_PROCESSING_QUEUE_URL = aws_sqs_queue.email_processing.id
    }
    event_source_mappings = {
      book_workflow = {
        event_source_arn = aws_sqs_queue.book_workflow.arn
        batch_size = var.lambda_event_source_mapping.book_workflow.batch_size
        maximum_batching_window_in_seconds = var.lambda_event_source_mapping.book_workflow.maximum_batching_window_in_seconds
      }
      user_notifications = {
        event_source_arn = aws_sqs_queue.user_notifications.arn
        batch_size = var.lambda_event_source_mapping.user_notifications.batch_size
        maximum_batching_window_in_seconds = var.lambda_event_source_mapping.user_notifications.maximum_batching_window_in_seconds
      }
      email_processing = {
        event_source_arn = aws_sqs_queue.email_processing.arn
        batch_size = var.lambda_event_source_mapping.email_processing.batch_size
        maximum_batching_window_in_seconds = var.lambda_event_source_mapping.email_processing.maximum_batching_window_in_seconds
      }
    }
    required_permissions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:SendMessage"
    ]
    policy_arn = aws_iam_policy.sqs_access.arn
  }
}

# Development and testing information
output "development_info" {
  description = "Development and testing information"
  value = {
    test_commands = {
      send_message = "aws sqs send-message --queue-url ${aws_sqs_queue.book_workflow.id} --message-body 'Test message'"
      receive_messages = "aws sqs receive-message --queue-url ${aws_sqs_queue.book_workflow.id}"
      purge_queue = "aws sqs purge-queue --queue-url ${aws_sqs_queue.book_workflow.id}"
      get_queue_attributes = "aws sqs get-queue-attributes --queue-url ${aws_sqs_queue.book_workflow.id} --attribute-names All"
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
        book_state_change = jsonencode({
          eventType = "book.state.changed"
          bookId = "book-123"
          fromState = "DRAFT"
          toState = "SUBMITTED_FOR_EDITING"
          changedBy = "user-456"
          timestamp = "2024-01-15T10:30:00Z"
        })
      }
      user_notifications = {
        email_notification = jsonencode({
          eventType = "notification.email"
          userId = "user-123"
          templateId = "book-published"
          data = {
            bookTitle = "Sample Book"
            authorName = "John Doe"
          }
          timestamp = "2024-01-15T10:30:00Z"
        })
        in_app_notification = jsonencode({
          eventType = "notification.in-app"
          userId = "user-123"
          title = "Book Published"
          message = "Your book 'Sample Book' has been published!"
          timestamp = "2024-01-15T10:30:00Z"
        })
      }
      email_processing = {
        welcome_email = jsonencode({
          eventType = "email.send"
          to = "user@example.com"
          templateId = "welcome"
          data = {
            firstName = "John"
            activationLink = "https://example.com/activate/token123"
          }
          timestamp = "2024-01-15T10:30:00Z"
        })
        book_notification = jsonencode({
          eventType = "email.send"
          to = "author@example.com"
          templateId = "book-status-change"
          data = {
            bookTitle = "Sample Book"
            newStatus = "PUBLISHED"
            message = "Congratulations! Your book has been published."
          }
          timestamp = "2024-01-15T10:30:00Z"
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
      message_count = {
        book_workflow = {
          alarm_name = "${var.environment}-sqs-book-workflow-message-count"
          threshold = var.message_count_threshold
          metric = "ApproximateNumberOfVisibleMessages"
        }
        user_notifications = {
          alarm_name = "${var.environment}-sqs-user-notifications-message-count"
          threshold = var.message_count_threshold
          metric = "ApproximateNumberOfVisibleMessages"
        }
        email_processing = {
          alarm_name = "${var.environment}-sqs-email-processing-message-count"
          threshold = var.message_count_threshold
          metric = "ApproximateNumberOfVisibleMessages"
        }
      }
      dlq_messages = var.enable_dlq ? {
        book_workflow = {
          alarm_name = "${var.environment}-sqs-book-workflow-dlq-messages"
          threshold = 0
          metric = "ApproximateNumberOfVisibleMessages"
        }
        user_notifications = {
          alarm_name = "${var.environment}-sqs-user-notifications-dlq-messages"
          threshold = 0
          metric = "ApproximateNumberOfVisibleMessages"
        }
        email_processing = {
          alarm_name = "${var.environment}-sqs-email-processing-dlq-messages"
          threshold = 0
          metric = "ApproximateNumberOfVisibleMessages"
        }
      } : {}
      total_requests = var.enable_free_tier_monitoring ? {
        alarm_name = "${var.environment}-sqs-total-requests"
        threshold = var.sqs_request_threshold
        metric = "NumberOfMessagesSent"
      } : null
    }
    alert_destination = var.alarm_topic_arn != "" ? var.alarm_topic_arn : null
  }
}