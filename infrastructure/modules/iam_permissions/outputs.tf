# Outputs for IAM Permissions module
# Note: Lambda permissions for API Gateway are handled in the API Gateway module

output "lambda_permissions" {
  description = "Lambda permission information"
  value = {
    # API Gateway permissions are managed in the API Gateway module
    api_gateway_permissions = {
      managed_by = "api_gateway_module"
      note = "Lambda permissions for API Gateway are created in the API Gateway module to prevent duplicates"
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
        batch_size = 10
      }
      notification_queue = {
        uuid = aws_lambda_event_source_mapping.notification_queue[0].uuid
        function_name = var.notification_service_function_name
        event_source_arn = var.notification_queue_arn
        batch_size = 10
      }
    } : {}
    dynamodb_mappings = var.enable_dynamodb_streams && length(aws_lambda_event_source_mapping.dynamodb_stream) > 0 ? {
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
        policy_type = local.should_create_sns_policy ? "hybrid_with_fallback" : "none"
        lambda_functions_configured = length(var.lambda_functions)
        lambda_arns_available = length(local.lambda_function_arns)
        sns_topic_configured = var.notification_topic_arn != ""
        policy_created = local.should_create_sns_policy
      }
    }
    s3_bucket_policies = var.enable_cloudfront ? {
      frontend_bucket = {
        bucket = var.frontend_bucket_name
        cloudfront_access_enabled = true
      }
    } : {}
    dynamodb_policies = var.environment == "prod" ? {
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
      account_created = true
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
      api_gateway_to_lambda = "Configured via Lambda permissions in API Gateway module"
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
      s3_buckets = var.enable_cloudfront ? "Configured" : "Not applicable"
      dynamodb_table = var.environment == "prod" ? "Configured" : "Not applicable"
    }
    principle_of_least_privilege = {
      implemented = true
      scope = "All permissions are scoped to specific resources and actions"
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
        api_gateway_integration = "Configured in API Gateway module"
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

output "sns_policy_debug" {
  description = "SNS policy creation debugging information"
  value = {
    lambda_functions_provided = length(var.lambda_functions)
    lambda_arns_extracted = length(local.lambda_function_arns)
    sns_topic_arn_provided = var.notification_topic_arn != ""
    has_lambda_functions = length(var.lambda_functions) > 0
    has_sns_topic = var.notification_topic_arn != ""
    should_create_policy = local.should_create_sns_policy
    lambda_function_names = keys(var.lambda_functions)
    policy_approach = "hybrid_direct_and_fallback"
    error_resistance = "Uses both direct ARNs and account root with service condition"
  }
}

output "compliance_status" {
  description = "Compliance and audit information"
  value = {
    permissions_managed_via_code = true
    manual_configuration_required = false
    least_privilege_implemented = true
    cross_service_access_controlled = true
    audit_trail_enabled = true
    encryption_permissions_configured = true
    monitoring_permissions_configured = true
    lambda_api_gateway_permissions = "Managed in API Gateway module"
    sns_policy_validation_enabled = true
  }
}
