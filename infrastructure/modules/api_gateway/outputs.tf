# Outputs for API Gateway module

output "api_gateway_id" {
  description = "ID of the REST API Gateway"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_gateway_url" {
  description = "URL of the REST API Gateway"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
}

output "api_gateway_domain" {
  description = "Domain of the REST API Gateway"
  value       = "${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com"
}

output "api_gateway_execution_arn" {
  description = "Execution ARN of the REST API Gateway"
  value       = aws_api_gateway_rest_api.main.execution_arn
}

output "websocket_api_id" {
  description = "ID of the WebSocket API"
  value       = aws_apigatewayv2_api.websocket.id
}

output "websocket_api_url" {
  description = "URL of the WebSocket API"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
}

output "websocket_api_endpoint" {
  description = "WebSocket API endpoint"
  value       = aws_apigatewayv2_api.websocket.api_endpoint
}

# Custom domain outputs (if configured)
output "custom_domain_name" {
  description = "Custom domain name (if configured)"
  value       = var.domain_name != "" ? var.domain_name : null
}

# API Gateway stage information
output "stage_info" {
  description = "API Gateway stage information"
  value = {
    rest_api = {
      stage_name = aws_api_gateway_stage.main.stage_name
      url        = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
      caching_enabled = aws_api_gateway_stage.main.cache_cluster_enabled
    }
    websocket = {
      stage_name = aws_apigatewayv2_stage.websocket.name
      url        = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
    }
  }
}

# Authorizer information
output "authorizer_info" {
  description = "JWT authorizer information"
  value = {
    id   = aws_api_gateway_authorizer.jwt.id
    name = aws_api_gateway_authorizer.jwt.name
    type = aws_api_gateway_authorizer.jwt.type
  }
}

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    monthly_request_limit = 1000000
    current_rate_limit = var.api_rate_limit
    current_burst_limit = var.api_burst_limit
    monitoring_enabled = var.enable_free_tier_monitoring
    request_threshold = var.api_request_threshold
    caching_enabled = var.enable_caching
    cache_size = var.enable_caching ? var.cache_cluster_size : null
  }
}

# Development and testing information
output "development_info" {
  description = "Development and testing information"
  value = {
    rest_api_test_url = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
    websocket_test_url = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
    cors_origins = var.cors_allowed_origins
    cors_methods = var.cors_allowed_methods
    cors_headers = var.cors_allowed_headers
  }
}

# API endpoints for documentation
output "api_endpoints" {
  description = "Available API endpoints"
  value = {
    base_url = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
    endpoints = {
      auth = {
        login = "POST /auth/login"
        register = "POST /auth/register"
        refresh = "POST /auth/refresh"
        logout = "POST /auth/logout"
      }
      books = {
        list = "GET /books"
        create = "POST /books"
        get = "GET /books/{id}"
        update = "PUT /books/{id}"
        delete = "DELETE /books/{id}"
      }
      users = {
        profile = "GET /users/profile"
        update_profile = "PUT /users/profile"
      }
      reviews = {
        list = "GET /reviews"
        create = "POST /reviews"
        get = "GET /reviews/{id}"
        update = "PUT /reviews/{id}"
        delete = "DELETE /reviews/{id}"
      }
      workflow = {
        submit = "POST /workflow/submit"
        approve = "POST /workflow/approve"
        reject = "POST /workflow/reject"
        publish = "POST /workflow/publish"
      }
      notifications = {
        list = "GET /notifications"
        mark_read = "PUT /notifications/{id}/read"
      }
    }
    websocket = {
      connect = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
      actions = [
        "book.edit",
        "book.comment",
        "notification.send",
        "presence.update"
      ]
    }
  }
}

# Data source for current AWS region is already declared in main.tf