# Outputs for CloudWatch module

output "dashboard_urls" {
  description = "URLs of CloudWatch dashboards"
  value = {
    main_dashboard = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
    free_tier_dashboard = var.enable_free_tier_monitoring ? "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.free_tier[0].dashboard_name}" : null
  }
}

output "dashboard_names" {
  description = "Names of CloudWatch dashboards"
  value = {
    main_dashboard = aws_cloudwatch_dashboard.main.dashboard_name
    free_tier_dashboard = var.enable_free_tier_monitoring ? aws_cloudwatch_dashboard.free_tier[0].dashboard_name : null
  }
}

# Log group information
output "log_groups" {
  description = "CloudWatch log group information"
  value = {
    application_logs = {
      name = aws_cloudwatch_log_group.application_logs.name
      arn  = aws_cloudwatch_log_group.application_logs.arn
      retention_days = var.log_retention_days
    }
    security_logs = {
      name = aws_cloudwatch_log_group.security_logs.name
      arn  = aws_cloudwatch_log_group.security_logs.arn
      retention_days = var.security_log_retention_days
    }
    audit_logs = {
      name = aws_cloudwatch_log_group.audit_logs.name
      arn  = aws_cloudwatch_log_group.audit_logs.arn
      retention_days = var.audit_log_retention_days
    }
  }
}

# Metric filter information
output "metric_filters" {
  description = "CloudWatch metric filter information"
  value = {
    user_registrations = {
      name = aws_cloudwatch_log_metric_filter.user_registrations.name
      metric_name = "UserRegistrations"
      namespace = "EbookPlatform/Business"
    }
    book_submissions = {
      name = aws_cloudwatch_log_metric_filter.book_submissions.name
      metric_name = "BookSubmissions"
      namespace = "EbookPlatform/Business"
    }
    book_publications = {
      name = aws_cloudwatch_log_metric_filter.book_publications.name
      metric_name = "BookPublications"
      namespace = "EbookPlatform/Business"
    }
    authentication_failures = {
      name = aws_cloudwatch_log_metric_filter.authentication_failures.name
      metric_name = "AuthenticationFailures"
      namespace = "EbookPlatform/Security"
    }
  }
}

# Alarm information
output "alarms" {
  description = "CloudWatch alarm information"
  value = {
    lambda_error_alarms = {
      for k, v in aws_cloudwatch_metric_alarm.lambda_error_rate : k => {
        name = v.alarm_name
        arn  = v.arn
        threshold = v.threshold
      }
    }
    lambda_duration_alarms = {
      for k, v in aws_cloudwatch_metric_alarm.lambda_duration : k => {
        name = v.alarm_name
        arn  = v.arn
        threshold = v.threshold
      }
    }
    api_gateway_alarms = {
      errors = {
        name = aws_cloudwatch_metric_alarm.api_gateway_5xx_errors.alarm_name
        arn  = aws_cloudwatch_metric_alarm.api_gateway_5xx_errors.arn
        threshold = aws_cloudwatch_metric_alarm.api_gateway_5xx_errors.threshold
      }
      latency = {
        name = aws_cloudwatch_metric_alarm.api_gateway_latency.alarm_name
        arn  = aws_cloudwatch_metric_alarm.api_gateway_latency.arn
        threshold = aws_cloudwatch_metric_alarm.api_gateway_latency.threshold
      }
    }
    dynamodb_alarms = {
      throttled_requests = {
        name = aws_cloudwatch_metric_alarm.dynamodb_throttled_requests.alarm_name
        arn  = aws_cloudwatch_metric_alarm.dynamodb_throttled_requests.arn
        threshold = aws_cloudwatch_metric_alarm.dynamodb_throttled_requests.threshold
      }
    }
    security_alarms = {
      auth_failures = {
        name = aws_cloudwatch_metric_alarm.high_authentication_failures.alarm_name
        arn  = aws_cloudwatch_metric_alarm.high_authentication_failures.arn
        threshold = aws_cloudwatch_metric_alarm.high_authentication_failures.threshold
      }
    }
  }
}

# CloudWatch Insights queries
output "insights_queries" {
  description = "CloudWatch Insights query information"
  value = var.enable_insights_queries ? {
    error_analysis = {
      name = aws_cloudwatch_query_definition.error_analysis.name
      query_definition_id = aws_cloudwatch_query_definition.error_analysis.query_definition_id
    }
    performance_analysis = {
      name = aws_cloudwatch_query_definition.performance_analysis.name
      query_definition_id = aws_cloudwatch_query_definition.performance_analysis.query_definition_id
    }
    user_activity = {
      name = aws_cloudwatch_query_definition.user_activity.name
      query_definition_id = aws_cloudwatch_query_definition.user_activity.query_definition_id
    }
  } : {}
}

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    custom_metrics_limit = 10
    alarms_limit = 10
    logs_ingestion_limit_gb = 5
    logs_archival_limit_gb = 5
    monitoring_enabled = var.enable_free_tier_monitoring
    log_retention_strategy = {
      application_logs = var.log_retention_days
      security_logs = var.security_log_retention_days
      audit_logs = var.audit_log_retention_days
    }
  }
}

# Monitoring configuration
output "monitoring_configuration" {
  description = "Complete monitoring configuration"
  value = {
    dashboards = {
      main = aws_cloudwatch_dashboard.main.dashboard_name
      free_tier = var.enable_free_tier_monitoring ? aws_cloudwatch_dashboard.free_tier[0].dashboard_name : null
    }
    log_groups = [
      aws_cloudwatch_log_group.application_logs.name,
      aws_cloudwatch_log_group.security_logs.name,
      aws_cloudwatch_log_group.audit_logs.name
    ]
    custom_metrics = var.enable_business_metrics ? [
      "EbookPlatform/Business/UserRegistrations",
      "EbookPlatform/Business/BookSubmissions",
      "EbookPlatform/Business/BookPublications",
      "EbookPlatform/Security/AuthenticationFailures"
    ] : []
    alarm_topics = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []
  }
}

# Development and testing information
output "development_info" {
  description = "Development and testing information"
  value = {
    log_streaming_commands = {
      application_logs = "aws logs tail ${aws_cloudwatch_log_group.application_logs.name} --follow"
      security_logs = "aws logs tail ${aws_cloudwatch_log_group.security_logs.name} --follow"
      audit_logs = "aws logs tail ${aws_cloudwatch_log_group.audit_logs.name} --follow"
    }
    insights_query_examples = {
      recent_errors = "fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20"
      slow_requests = "fields @timestamp, @duration | filter @type = \"REPORT\" | filter @duration > 1000 | sort @duration desc"
      user_activity = "fields @timestamp, userId, operation | filter @message like /USER_/ | stats count() by userId"
    }
    metric_queries = {
      lambda_invocations = "aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 300 --statistics Sum"
      api_requests = "aws cloudwatch get-metric-statistics --namespace AWS/ApiGateway --metric-name Count --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 300 --statistics Sum"
    }
  }
}

# Integration information for other services
output "integration_info" {
  description = "Integration information for other AWS services"
  value = {
    lambda_environment_variables = {
      APPLICATION_LOG_GROUP = aws_cloudwatch_log_group.application_logs.name
      SECURITY_LOG_GROUP = aws_cloudwatch_log_group.security_logs.name
      AUDIT_LOG_GROUP = aws_cloudwatch_log_group.audit_logs.name
    }
    required_permissions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "cloudwatch:PutMetricData"
    ]
    log_group_arns = [
      aws_cloudwatch_log_group.application_logs.arn,
      aws_cloudwatch_log_group.security_logs.arn,
      aws_cloudwatch_log_group.audit_logs.arn
    ]
  }
}

# Operational information
output "operational_info" {
  description = "Operational monitoring information"
  value = {
    dashboard_links = {
      main = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
      free_tier = var.enable_free_tier_monitoring ? "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.free_tier[0].dashboard_name}" : null
    }
    alarm_summary = {
      total_alarms = length(aws_cloudwatch_metric_alarm.lambda_error_rate) + length(aws_cloudwatch_metric_alarm.lambda_duration) + 4  # API Gateway, DynamoDB, Auth failures
      critical_alarms = [
        aws_cloudwatch_metric_alarm.api_gateway_5xx_errors.alarm_name,
        aws_cloudwatch_metric_alarm.dynamodb_throttled_requests.alarm_name,
        aws_cloudwatch_metric_alarm.high_authentication_failures.alarm_name
      ]
      warning_alarms = [
        aws_cloudwatch_metric_alarm.api_gateway_latency.alarm_name
      ]
    }
    log_analysis_tools = {
      insights_queries = var.enable_insights_queries ? 3 : 0
      metric_filters = var.enable_business_metrics ? 4 : 0
      retention_policies = 3
    }
  }
}

# Data source for current AWS region is already declared in main.tf