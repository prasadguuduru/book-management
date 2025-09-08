# DLQ Monitoring Dashboard Configuration
# This creates a CloudWatch dashboard for monitoring Dead Letter Queue metrics

resource "aws_cloudwatch_dashboard" "dlq_monitoring" {
  dashboard_name = "${var.environment}-dlq-monitoring"

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
            ["NotificationSystem/DLQ", "DLQMessageCount", "QueueName", "${var.environment}-user-notifications-dlq"],
            ["AWS/SQS", "ApproximateNumberOfMessages", "QueueName", "${var.environment}-user-notifications-dlq"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "DLQ Message Count"
          period  = 300
          stat    = "Average"
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
            ["NotificationSystem/DLQ", "DLQOldestMessageAge", "QueueName", "${var.environment}-user-notifications-dlq"],
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", "${var.environment}-user-notifications-dlq"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Oldest Message Age (seconds)"
          period  = 300
          stat    = "Average"
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
            ["NotificationSystem/DLQ", "DLQMessageRate", "QueueName", "${var.environment}-user-notifications-dlq"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Message Rate (messages/second)"
          period  = 300
          stat    = "Average"
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
            ["AWS/Lambda", "Errors", "FunctionName", "${var.environment}-notification-service"],
            [".", "Duration", ".", "."],
            [".", "Invocations", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Notification Service Lambda Metrics"
          period  = 300
          stat    = "Sum"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/lambda/${var.environment}-notification-service'\n| fields @timestamp, @message\n| filter @message like /ERROR/ or @message like /Cannot read properties/\n| sort @timestamp desc\n| limit 20"
          region  = var.aws_region
          title   = "Recent Notification Service Errors"
        }
      }
    ]
  })
}

# CloudWatch Alarms for DLQ monitoring
resource "aws_cloudwatch_metric_alarm" "dlq_message_count_high" {
  alarm_name          = "${var.environment}-dlq-message-count-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApproximateNumberOfMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.dlq_message_count_threshold
  alarm_description   = "This metric monitors DLQ message count"
  alarm_actions       = [aws_sns_topic.dlq_alerts.arn]

  dimensions = {
    QueueName = "${var.environment}-user-notifications-dlq"
  }

  tags = {
    Environment = var.environment
    Service     = "notification-system"
    Component   = "dlq-monitoring"
  }
}

resource "aws_cloudwatch_metric_alarm" "dlq_message_age_high" {
  alarm_name          = "${var.environment}-dlq-message-age-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Maximum"
  threshold           = var.dlq_message_age_threshold
  alarm_description   = "This metric monitors DLQ oldest message age"
  alarm_actions       = [aws_sns_topic.dlq_alerts.arn]

  dimensions = {
    QueueName = "${var.environment}-user-notifications-dlq"
  }

  tags = {
    Environment = var.environment
    Service     = "notification-system"
    Component   = "dlq-monitoring"
  }
}

resource "aws_cloudwatch_metric_alarm" "notification_lambda_errors" {
  alarm_name          = "${var.environment}-notification-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors notification Lambda errors"
  alarm_actions       = [aws_sns_topic.dlq_alerts.arn]

  dimensions = {
    FunctionName = "${var.environment}-notification-service"
  }

  tags = {
    Environment = var.environment
    Service     = "notification-system"
    Component   = "lambda-monitoring"
  }
}

# SNS Topic for DLQ alerts
resource "aws_sns_topic" "dlq_alerts" {
  name = "${var.environment}-dlq-alerts"

  tags = {
    Environment = var.environment
    Service     = "notification-system"
    Component   = "alerting"
  }
}

# SNS Topic subscription for email alerts
resource "aws_sns_topic_subscription" "dlq_alerts_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.dlq_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Output the dashboard URL
output "dlq_dashboard_url" {
  description = "URL to the DLQ monitoring dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.dlq_monitoring.dashboard_name}"
}

output "dlq_alerts_topic_arn" {
  description = "ARN of the DLQ alerts SNS topic"
  value       = aws_sns_topic.dlq_alerts.arn
}