# CloudWatch module for monitoring and observability with Free Tier optimization

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

# CloudWatch dashboard for system overview
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.environment}-ebook-platform-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.environment}-auth-service"],
            [".", "Duration", ".", "."],
            [".", "Errors", ".", "."],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.environment}-book-service"],
            [".", "Duration", ".", "."],
            [".", "Errors", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Lambda Functions Overview"
          view   = "timeSeries"
          stacked = false
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.table_name],
            [".", "ConsumedWriteCapacityUnits", ".", "."],
            [".", "ItemCount", ".", "."],
            [".", "TableSizeBytes", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "DynamoDB Performance"
          view   = "timeSeries"
          stacked = false
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", "${var.environment}-ebook-api"],
            [".", "Latency", ".", "."],
            [".", "4XXError", ".", "."],
            [".", "5XXError", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "API Gateway Performance"
          view   = "timeSeries"
          stacked = false
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", var.cloudfront_distribution_id != null ? var.cloudfront_distribution_id : "N/A"],
            [".", "BytesDownloaded", ".", "."],
            [".", "4xxErrorRate", ".", "."],
            [".", "5xxErrorRate", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = "us-east-1"  # CloudFront metrics are always in us-east-1
          title  = "CloudFront Performance"
          view   = "timeSeries"
          stacked = false
        }
      }
    ]
  })
}

# Free Tier usage dashboard
resource "aws_cloudwatch_dashboard" "free_tier" {
  count = var.enable_free_tier_monitoring ? 1 : 0
  dashboard_name = "${var.environment}-free-tier-usage"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { "stat": "Sum" }]
          ]
          period = 86400  # Daily
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Lambda Invocations (Free Tier: 1M/month)"
          view   = "singleValue"
          annotations = {
            horizontal = [
              {
                label = "Free Tier Limit"
                value = 1000000
              },
              {
                label = "80% Threshold"
                value = 800000
              }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.table_name, { "stat": "Sum" }],
            [".", "ConsumedWriteCapacityUnits", ".", ".", { "stat": "Sum" }]
          ]
          period = 86400  # Daily
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "DynamoDB Capacity (Free Tier: 25 RCU/WCU per second)"
          view   = "timeSeries"
          annotations = {
            horizontal = [
              {
                label = "Free Tier Daily Limit (RCU)"
                value = 2160000  # 25 * 86400
              },
              {
                label = "Free Tier Daily Limit (WCU)"
                value = 2160000  # 25 * 86400
              }
            ]
          }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "BucketName", var.frontend_bucket_name, "StorageType", "StandardStorage", { "stat": "Average" }]
          ]
          period = 86400  # Daily
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "S3 Storage Usage (Free Tier: 5GB)"
          view   = "singleValue"
          annotations = {
            horizontal = [
              {
                label = "Free Tier Limit"
                value = 5368709120  # 5GB in bytes
              },
              {
                label = "80% Threshold"
                value = 4294967296  # 4GB in bytes
              }
            ]
          }
        }
      }
    ]
  })
}

# Create Lambda log groups explicitly instead of using data sources
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = var.lambda_functions
  
  name              = "/aws/lambda/${each.value.function_name}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Component = "logging"
    Purpose   = "lambda-logs"
    Service   = each.key
  })
}

# Custom metrics for business KPIs
resource "aws_cloudwatch_log_metric_filter" "user_registrations" {
  name           = "${var.environment}-user-registrations"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["auth-service"].name
  pattern        = "[timestamp, requestId, level=\"INFO\", message=\"USER_REGISTRATION_SUCCESS\", ...]"

  metric_transformation {
    name      = "UserRegistrations"
    namespace = "EbookPlatform/Business"
    value     = "1"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_log_metric_filter" "book_submissions" {
  name           = "${var.environment}-book-submissions"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["book-service"].name
  pattern        = "[timestamp, requestId, level=\"INFO\", message=\"BOOK_SUBMITTED\", ...]"

  metric_transformation {
    name      = "BookSubmissions"
    namespace = "EbookPlatform/Business"
    value     = "1"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_log_metric_filter" "book_publications" {
  name           = "${var.environment}-book-publications"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["workflow-service"].name
  pattern        = "[timestamp, requestId, level=\"INFO\", message=\"BOOK_PUBLISHED\", ...]"

  metric_transformation {
    name      = "BookPublications"
    namespace = "EbookPlatform/Business"
    value     = "1"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_log_metric_filter" "authentication_failures" {
  name           = "${var.environment}-auth-failures"
  log_group_name = aws_cloudwatch_log_group.lambda_logs["auth-service"].name
  pattern        = "[timestamp, requestId, level=\"SECURITY\", message=\"AUTHENTICATION_FAILED\", ...]"

  metric_transformation {
    name      = "AuthenticationFailures"
    namespace = "EbookPlatform/Security"
    value     = "1"
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

# CloudWatch alarms for system health
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  for_each = var.lambda_functions

  alarm_name          = "${var.environment}-lambda-${each.key}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Lambda ${each.key} error rate is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  ok_actions          = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    FunctionName = each.value.function_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  for_each = var.lambda_functions

  alarm_name          = "${var.environment}-lambda-${each.key}-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = each.value.timeout * 1000 * 0.8  # 80% of timeout in milliseconds
  alarm_description   = "Lambda ${each.key} duration approaching timeout"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    FunctionName = each.value.function_name
  }

  tags = var.tags
}

# API Gateway alarms
resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx_errors" {
  alarm_name          = "${var.environment}-api-gateway-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "API Gateway 5XX error rate is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    ApiName = "${var.environment}-ebook-api"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_latency" {
  alarm_name          = "${var.environment}-api-gateway-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000"  # 5 seconds
  alarm_description   = "API Gateway latency is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    ApiName = "${var.environment}-ebook-api"
  }

  tags = var.tags
}

# DynamoDB alarms
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttled_requests" {
  alarm_name          = "${var.environment}-dynamodb-throttled-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "DynamoDB requests are being throttled"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    TableName = var.table_name
  }

  tags = var.tags
}

# Business KPI alarms
resource "aws_cloudwatch_metric_alarm" "high_authentication_failures" {
  alarm_name          = "${var.environment}-high-auth-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "AuthenticationFailures"
  namespace           = "EbookPlatform/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High number of authentication failures detected"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  tags = var.tags
}

# Notification service specific alarms
resource "aws_cloudwatch_metric_alarm" "notification_failure_rate" {
  alarm_name          = "${var.environment}-notification-failure-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NotificationProcessed"
  namespace           = "EbookPlatform/Notifications/${var.environment}"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "High notification failure rate detected"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    Status = "Failed"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "email_delivery_failures" {
  alarm_name          = "${var.environment}-email-delivery-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "EmailDelivery"
  namespace           = "EbookPlatform/Notifications/${var.environment}"
  period              = "300"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "High email delivery failure rate detected"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    DeliveryStatus = "failed"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "notification_processing_time" {
  alarm_name          = "${var.environment}-notification-processing-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NotificationProcessingTime"
  namespace           = "EbookPlatform/Notifications/${var.environment}"
  period              = "300"
  statistic           = "Average"
  threshold           = "30000"  # 30 seconds
  alarm_description   = "Notification processing time is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "sqs_batch_failure_rate" {
  alarm_name          = "${var.environment}-sqs-batch-failure-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SQSBatchSuccessRate"
  namespace           = "EbookPlatform/Notifications/${var.environment}"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"  # 80% success rate
  alarm_description   = "SQS batch processing success rate is low"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  tags = var.tags
}

# Log groups for centralized logging (conditional)
resource "aws_cloudwatch_log_group" "application_logs" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/ebook-platform/${var.environment}/application"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Component = "logging"
    Purpose   = "application-logs"
  })
}

resource "aws_cloudwatch_log_group" "security_logs" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/ebook-platform/${var.environment}/security"
  retention_in_days = var.security_log_retention_days

  tags = merge(var.tags, {
    Component = "logging"
    Purpose   = "security-logs"
  })
}

resource "aws_cloudwatch_log_group" "audit_logs" {
  count             = var.enable_cloudwatch_logs ? 1 : 0
  name              = "/ebook-platform/${var.environment}/audit"
  retention_in_days = var.audit_log_retention_days

  tags = merge(var.tags, {
    Component = "logging"
    Purpose   = "audit-logs"
  })
}

# CloudWatch Insights queries for common investigations
resource "aws_cloudwatch_query_definition" "error_analysis" {
  name = "${var.environment}-error-analysis"

  log_group_names = [for k, v in aws_cloudwatch_log_group.lambda_logs : v.name]

  query_string = <<EOF
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
EOF

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  name = "${var.environment}-performance-analysis"

  log_group_names = [for k, v in aws_cloudwatch_log_group.lambda_logs : v.name]

  query_string = <<EOF
fields @timestamp, @duration, @requestId, @message
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
| sort @timestamp desc
EOF

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_query_definition" "user_activity" {
  name = "${var.environment}-user-activity"

  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["auth-service"].name,
    aws_cloudwatch_log_group.lambda_logs["book-service"].name,
    aws_cloudwatch_log_group.lambda_logs["user-service"].name
  ]

  query_string = <<EOF
fields @timestamp, @message, userId, operation
| filter @message like /USER_/
| stats count() by userId, operation
| sort count desc
| limit 50
EOF

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_query_definition" "notification_failures" {
  name = "${var.environment}-notification-failures"

  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["notification-service"].name
  ]

  query_string = <<EOF
fields @timestamp, @message, eventId, bookId, notificationType, error
| filter @message like /❌/ or @message like /FAILED/
| sort @timestamp desc
| limit 100
EOF

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_query_definition" "notification_performance" {
  name = "${var.environment}-notification-performance"

  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["notification-service"].name
  ]

  query_string = <<EOF
fields @timestamp, @message, processingTimeMs, emailDeliveryTimeMs, notificationType
| filter @message like /EMAIL SENT SUCCESSFULLY/
| stats avg(processingTimeMs), max(processingTimeMs), avg(emailDeliveryTimeMs), max(emailDeliveryTimeMs) by notificationType
| sort avg(processingTimeMs) desc
EOF

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}

resource "aws_cloudwatch_query_definition" "sqs_batch_analysis" {
  name = "${var.environment}-sqs-batch-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.lambda_logs["notification-service"].name
  ]

  query_string = <<EOF
fields @timestamp, @message, recordCount, successfullyProcessed, failed, processingTimeMs
| filter @message like /SQS EVENT HANDLER COMPLETED/
| stats avg(recordCount), avg(successfullyProcessed), avg(failed), avg(processingTimeMs) by bin(5m)
| sort @timestamp desc
EOF

  depends_on = [aws_cloudwatch_log_group.lambda_logs]
}