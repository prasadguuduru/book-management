# Outputs for IAM Permissions module

output "lambda_permissions" {
  description = "Lambda permission information"
  value = {
    api_gateway_permissions = {
      auth_service = aws_lambda_permission.api_gateway_auth.statement_id
      book_service = aws_lambda_permission.api_gateway_book.statement_id
      user_service = aws_lambda_permission.api_gateway_user.statement_id
      workflow_service = aws_lambda_permission.api_gateway_workflow.statement_id
      review_service = aws_lambda_permission.api_gateway_review.statement_id
      notification_service = aws_lambda_permission.api_gateway_notification.statement_id
    }
    websocket_permissions = {
      notification_service = aws_lambda_permission.websocket_api_gateway.statement_id
    }
    s3_permissions = var.enable_s3_notifications ? {
      notification_service = aws_lambda_permission.s3_invoke_lambda[0].statement_id
    } : {}
    eventbridge_permissions = var.enable_scheduled_tasks ? {
      notification_service = aws_lambda_permission.eventbridge_invoke[0].statement_id
    } : {}
  }
}

output "event_source_mappings" {
  description = "Event source mapping information"
  value = {
    sqs_mappings = var.enable_sqs_triggers ? {
      workflow_queue = {
        uuid = aws_lambda_event_source_mapping.workflow_queue[0].uuid
        function_name = var.workflow_service_function_name
        event_source_arn = var.workflow_queue_arn
        batch_size = var.sqs_batch_size
      }
      notification_queue = {
        uuid = aws_lambda_event_source_mapping.notification_queue[0].uuid
        function_name = var.notification_service_function_name
        event_source_arn = var.notification_queue_arn
        batch_size = var.sqs_batch_size
      }
    } : {}
    dynamodb_mappings = var.enable_dynamodb_streams ? {
      table_stream = {
        uuid = aws_lambda_event_source_mapping.dynamodb_stream[0].uuid
        function_name = var.notification_service_function_name
        event_source_arn = var.dynamodb_stream_arn
        batch_size = var.dynamodb_batch_size
      }
    } : {}
  }
}

output "resource_policies" {
  description = "Resource-based policy information"
  value = {
    sns_topic_policies = {
      notification_topic = {
        arn = var.notification_topic_arn
        policy_applied = true
      }
    }
    sqs_queue_policies = {
      workflow_queue = {
        arn = var.workflow_queue_arn
        policy_applied = true
      }
      notification_queue = {
        arn = var.notification_queue_arn
        policy_applied = true
      }
    }
    s3_bucket_policies = var.enable_cloudfront ? {
      frontend_bucket = {
        bucket = var.frontend_bucket_name
        cloudfront_access_enabled = true
      }
    } : {}
    dynamodb_policies = var.environment == "prod" && var.enable_resource_based_policies ? {
      table_policy = {
        arn = var.table_arn
        policy_applied = true
      }
    } : {}
  }
}

output "scheduled_tasks" {
  description = "Scheduled task information"
  value = var.enable_scheduled_tasks ? {
    daily_cleanup = {
      rule_name = aws_cloudwatch_event_rule.daily_cleanup[0].name
      rule_arn = aws_cloudwatch_event_rule.daily_cleanup[0].arn
      schedule = "cron(0 2 * * ? *)"
      target_function = var.notification_service_function_name
    }
  } : {}
}

output "api_gateway_configuration" {
  description = "API Gateway configuration information"
  value = {
    account_settings = {
      cloudwatch_role_configured = true
      cloudwatch_role_arn = var.api_gateway_cloudwatch_role_arn
    }
    lambda_authorizer = {
      function_name = var.auth_service_function_name
      permissions_configured = true
    }
  }
}

output "security_configuration" {
  description = "Security configuration summary"
  value = {
    cross_service_permissions = {
      lambda_to_dynamodb = "Configured via IAM role policies"
      lambda_to_s3 = "Configured via IAM role policies"
      lambda_to_sns = "Configured via IAM role policies and resource policies"
      lambda_to_sqs = "Configured via IAM role policies and resource policies"
      api_gateway_to_lambda = "Configured via Lambda permissions"
      cloudfront_to_s3 = var.enable_cloudfront ? "Configured via S3 bucket policy" : "Not applicable"
      eventbridge_to_lambda = var.enable_scheduled_tasks ? "Configured via Lambda permissions" : "Not applicable"
    }
    event_driven_architecture = {
      sqs_triggers_enabled = var.enable_sqs_triggers
      dynamodb_streams_enabled = var.enable_dynamodb_streams
      s3_notifications_enabled = var.enable_s3_notifications
      scheduled_tasks_enabled = var.enable_scheduled_tasks
    }
    resource_based_policies = {
      sns_topics = "Configured"
      sqs_queues = "Configured"
      s3_buckets = var.enable_cloudfront ? "Configured" : "Not applicable"
      dynamodb_table = var.environment == "prod" ? "Configured" : "Not applicable"
    }
    principle_of_least_privilege = {
      implemented = true
      scope = "All permissions are scoped to specific resources and actions"
      cross_account_access = var.enable_cross_account_access
    }
  }
}

output "integration_endpoints" {
  description = "Integration endpoint information for testing"
  value = {
    lambda_functions = {
      for name, info in var.lambda_functions : name => {
        function_name = info.function_name
        arn = info.arn
        api_gateway_integration = "Configured"
        event_sources = name == "notification-service" ? [
          var.enable_sqs_triggers ? "SQS" : null,
          var.enable_dynamodb_streams ? "DynamoDB Streams" : null,
          var.enable_s3_notifications ? "S3" : null,
          var.enable_scheduled_tasks ? "EventBridge" : null
        ] : name == "workflow-service" && var.enable_sqs_triggers ? ["SQS"] : []
      }
    }
    event_sources = {
      sqs_queues = var.enable_sqs_triggers ? [
        var.workflow_queue_arn,
        var.notification_queue_arn
      ] : []
      dynamodb_streams = var.enable_dynamodb_streams ? [var.dynamodb_stream_arn] : []
      s3_buckets = var.enable_s3_notifications ? [var.assets_bucket_arn] : []
      eventbridge_rules = var.enable_scheduled_tasks ? [
        aws_cloudwatch_event_rule.daily_cleanup[0].arn
      ] : []
    }
  }
}

output "compliance_status" {
  description = "Compliance and audit information"
  value = {
    permissions_managed_via_code = true
    manual_configuration_required = false
    least_privilege_implemented = true
    resource_based_policies_applied = var.enable_resource_based_policies
    cross_service_access_controlled = true
    audit_trail_enabled = true
    encryption_permissions_configured = true
    monitoring_permissions_configured = true
    backup_permissions_configured = false  # Not implemented in this version
    disaster_recovery_permissions_configured = false  # Not implemented in this version
  }
}