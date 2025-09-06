# API Gateway module for REST and WebSocket APIs with Free Tier optimization

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

# REST API Gateway
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.environment}-ebook-api"
  description = "Ebook Publishing Platform REST API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  binary_media_types = [
    "application/octet-stream",
    "image/*",
    "multipart/form-data"
  ]

  tags = merge(var.tags, {
    Component = "api-gateway"
    Type      = "rest-api"
  })
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    # CORS methods
    aws_api_gateway_method.cors_auth,
    aws_api_gateway_method.cors_auth_proxy,
    aws_api_gateway_method.cors_books,
    aws_api_gateway_method.cors_books_proxy,
    aws_api_gateway_method.cors_users,
    aws_api_gateway_method.cors_reviews,
    aws_api_gateway_method.cors_workflow,
    aws_api_gateway_method.cors_workflow_proxy,
    aws_api_gateway_method.cors_notifications,
    # API methods
    aws_api_gateway_method.auth_post,
    aws_api_gateway_method.auth_proxy_any,
    aws_api_gateway_method.books_get,
    aws_api_gateway_method.books_post,
    aws_api_gateway_method.books_proxy_any,
    aws_api_gateway_method.users_get,
    aws_api_gateway_method.reviews_get,
    aws_api_gateway_method.workflow_get,
    aws_api_gateway_method.workflow_post,
    aws_api_gateway_method.workflow_proxy_any,
    aws_api_gateway_method.workflow_health_get,
    aws_api_gateway_method.cors_workflow_health,
    aws_api_gateway_method.notifications_get,
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.api.id,
      aws_api_gateway_resource.auth.id,
      aws_api_gateway_resource.auth_proxy.id,
      aws_api_gateway_resource.books.id,
      aws_api_gateway_resource.books_proxy.id,
      aws_api_gateway_resource.users.id,
      aws_api_gateway_resource.reviews.id,
      aws_api_gateway_resource.workflow.id,
      aws_api_gateway_resource.workflow_proxy.id,
      aws_api_gateway_resource.workflow_health.id,
      aws_api_gateway_resource.notifications.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  # Enable caching for production (Free Tier: 0.5GB cache)
  cache_cluster_enabled = var.environment == "prod"
  cache_cluster_size    = var.environment == "prod" ? "0.5" : null

  # Note: Throttling is configured at the method level or via usage plans

  # Enable detailed CloudWatch metrics
  xray_tracing_enabled = false  # Avoid X-Ray costs

  tags = var.tags
}

# API Gateway resources
# Parent /api resource
resource "aws_api_gateway_resource" "api" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "api"
}

# Child resources under /api
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "auth"
}

resource "aws_api_gateway_resource" "books" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "books"
}

resource "aws_api_gateway_resource" "users" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "users"
}

resource "aws_api_gateway_resource" "reviews" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "reviews"
}

resource "aws_api_gateway_resource" "workflow" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "workflow"
}

resource "aws_api_gateway_resource" "notifications" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "notifications"
}

# CORS configuration for all resources
# Local values for consistent CORS headers
locals {
  cors_headers = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE,PATCH'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  
  cors_response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# CORS for /api/auth
resource "aws_api_gateway_method" "cors_auth" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_auth" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.cors_auth.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_auth" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.auth.id
  http_method         = aws_api_gateway_method.cors_auth.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_auth" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.auth.id
  http_method         = aws_api_gateway_method.cors_auth.http_method
  status_code         = aws_api_gateway_method_response.cors_auth.status_code
  response_parameters = local.cors_headers
}

# CORS for /api/books
resource "aws_api_gateway_method" "cors_books" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.books.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_books" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.books.id
  http_method = aws_api_gateway_method.cors_books.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_books" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.books.id
  http_method         = aws_api_gateway_method.cors_books.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_books" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.books.id
  http_method         = aws_api_gateway_method.cors_books.http_method
  status_code         = aws_api_gateway_method_response.cors_books.status_code
  response_parameters = local.cors_headers
}

# CORS for /api/users
resource "aws_api_gateway_method" "cors_users" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.users.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_users" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.users.id
  http_method = aws_api_gateway_method.cors_users.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_users" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.users.id
  http_method         = aws_api_gateway_method.cors_users.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_users" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.users.id
  http_method         = aws_api_gateway_method.cors_users.http_method
  status_code         = aws_api_gateway_method_response.cors_users.status_code
  response_parameters = local.cors_headers
}

# CORS for /api/reviews
resource "aws_api_gateway_method" "cors_reviews" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.reviews.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_reviews" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.reviews.id
  http_method = aws_api_gateway_method.cors_reviews.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_reviews" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.reviews.id
  http_method         = aws_api_gateway_method.cors_reviews.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_reviews" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.reviews.id
  http_method         = aws_api_gateway_method.cors_reviews.http_method
  status_code         = aws_api_gateway_method_response.cors_reviews.status_code
  response_parameters = local.cors_headers
}

# CORS for /api/workflow
resource "aws_api_gateway_method" "cors_workflow" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.workflow.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_workflow" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.workflow.id
  http_method = aws_api_gateway_method.cors_workflow.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_workflow" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.workflow.id
  http_method         = aws_api_gateway_method.cors_workflow.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_workflow" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.workflow.id
  http_method         = aws_api_gateway_method.cors_workflow.http_method
  status_code         = aws_api_gateway_method_response.cors_workflow.status_code
  response_parameters = local.cors_headers
}

# CORS for /api/notifications
resource "aws_api_gateway_method" "cors_notifications" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.notifications.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_notifications" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.notifications.id
  http_method = aws_api_gateway_method.cors_notifications.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_notifications" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.notifications.id
  http_method         = aws_api_gateway_method.cors_notifications.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_notifications" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.notifications.id
  http_method         = aws_api_gateway_method.cors_notifications.http_method
  status_code         = aws_api_gateway_method_response.cors_notifications.status_code
  response_parameters = local.cors_headers
}

# Auth service proxy resource for sub-paths like /login, /register, etc.
resource "aws_api_gateway_resource" "auth_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "{proxy+}"
}

# Auth service endpoints - ANY method for proxy resource
resource "aws_api_gateway_method" "auth_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.auth_proxy.id
  http_method   = "ANY"
  authorization = "NONE"  # Auth service handles its own authentication
}

resource "aws_api_gateway_integration" "auth_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.auth_proxy.id
  http_method = aws_api_gateway_method.auth_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["auth-service"].integration_uri
}

# CORS for auth proxy resource
resource "aws_api_gateway_method" "cors_auth_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.auth_proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_auth_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.auth_proxy.id
  http_method = aws_api_gateway_method.cors_auth_proxy.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_auth_proxy" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.auth_proxy.id
  http_method         = aws_api_gateway_method.cors_auth_proxy.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_auth_proxy" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.auth_proxy.id
  http_method         = aws_api_gateway_method.cors_auth_proxy.http_method
  status_code         = aws_api_gateway_method_response.cors_auth_proxy.status_code
  response_parameters = local.cors_headers
}

# Auth service endpoints - Keep original POST method for backward compatibility
resource "aws_api_gateway_method" "auth_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.auth.id
  http_method   = "POST"
  authorization = "NONE"  # Auth service handles its own authentication
}

resource "aws_api_gateway_integration" "auth_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.auth.id
  http_method = aws_api_gateway_method.auth_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["auth-service"].integration_uri
}

# Lambda permissions for API Gateway invocation
resource "aws_lambda_permission" "api_gateway_auth" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["auth-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Additional Lambda permission for auth proxy paths
resource "aws_lambda_permission" "api_gateway_auth_proxy" {
  statement_id  = "AllowExecutionFromAPIGatewayAuthProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["auth-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/ANY/api/auth/*"
}

# Lambda permission for custom authorizer (general API Gateway access)
resource "aws_lambda_permission" "api_gateway_custom_authorizer" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["custom-authorizer"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Lambda permission for custom authorizer (specific authorizer access)
resource "aws_lambda_permission" "api_gateway_custom_authorizer_specific" {
  statement_id  = "AllowExecutionFromAPIGatewayAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["custom-authorizer"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/authorizers/*"
}

# Books service proxy resource for sub-paths like /book-001, etc.
resource "aws_api_gateway_resource" "books_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.books.id
  path_part   = "{proxy+}"
}

# Books service endpoints - ANY method for proxy resource
resource "aws_api_gateway_method" "books_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.books_proxy.id
  http_method   = "ANY"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "books_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.books_proxy.id
  http_method = aws_api_gateway_method.books_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["book-service"].integration_uri
}

# CORS for books proxy resource
resource "aws_api_gateway_method" "cors_books_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.books_proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_books_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.books_proxy.id
  http_method = aws_api_gateway_method.cors_books_proxy.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_books_proxy" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.books_proxy.id
  http_method         = aws_api_gateway_method.cors_books_proxy.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_books_proxy" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.books_proxy.id
  http_method         = aws_api_gateway_method.cors_books_proxy.http_method
  status_code         = aws_api_gateway_method_response.cors_books_proxy.status_code
  response_parameters = local.cors_headers
}

# Books service endpoints - Keep original methods for backward compatibility
resource "aws_api_gateway_method" "books_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.books.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "books_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.books.id
  http_method = aws_api_gateway_method.books_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["book-service"].integration_uri
}

resource "aws_api_gateway_method" "books_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.books.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "books_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.books.id
  http_method = aws_api_gateway_method.books_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["book-service"].integration_uri
}

# Lambda permissions for API Gateway invocation
resource "aws_lambda_permission" "api_gateway_book" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["book-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Additional Lambda permission for proxy paths
resource "aws_lambda_permission" "api_gateway_book_proxy" {
  statement_id  = "AllowExecutionFromAPIGatewayProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["book-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/ANY/api/books/*"
}

# Users service endpoints
resource "aws_api_gateway_method" "users_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.users.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "users_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.users.id
  http_method = aws_api_gateway_method.users_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["user-service"].integration_uri
}

# Reviews service endpoints
resource "aws_api_gateway_method" "reviews_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.reviews.id
  http_method   = "GET"
  authorization = "NONE"  # Public endpoint for reading reviews
}

resource "aws_api_gateway_integration" "reviews_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.reviews.id
  http_method = aws_api_gateway_method.reviews_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["review-service"].integration_uri
}

# Workflow service proxy resource for sub-paths like /books/{id}/status, etc.
resource "aws_api_gateway_resource" "workflow_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.workflow.id
  path_part   = "{proxy+}"
}

# Workflow service endpoints - ANY method for proxy resource
resource "aws_api_gateway_method" "workflow_proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.workflow_proxy.id
  http_method   = "ANY"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "workflow_proxy_any" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.workflow_proxy.id
  http_method = aws_api_gateway_method.workflow_proxy_any.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["workflow-service"].integration_uri
}

# CORS for workflow proxy resource
resource "aws_api_gateway_method" "cors_workflow_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.workflow_proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_workflow_proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.workflow_proxy.id
  http_method = aws_api_gateway_method.cors_workflow_proxy.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_workflow_proxy" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.workflow_proxy.id
  http_method         = aws_api_gateway_method.cors_workflow_proxy.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_workflow_proxy" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.workflow_proxy.id
  http_method         = aws_api_gateway_method.cors_workflow_proxy.http_method
  status_code         = aws_api_gateway_method_response.cors_workflow_proxy.status_code
  response_parameters = local.cors_headers
}

# Workflow service endpoints - Keep original POST method for backward compatibility
resource "aws_api_gateway_method" "workflow_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.workflow.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "workflow_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.workflow.id
  http_method = aws_api_gateway_method.workflow_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["workflow-service"].integration_uri
}

# Workflow service health endpoint - separate resource for public access
resource "aws_api_gateway_resource" "workflow_health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.workflow.id
  path_part   = "health"
}

resource "aws_api_gateway_method" "workflow_health_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.workflow_health.id
  http_method   = "GET"
  authorization = "NONE"  # Health check should be public
}

resource "aws_api_gateway_integration" "workflow_health_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.workflow_health.id
  http_method = aws_api_gateway_method.workflow_health_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["workflow-service"].integration_uri
}

# CORS for workflow health endpoint
resource "aws_api_gateway_method" "cors_workflow_health" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.workflow_health.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "cors_workflow_health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.workflow_health.id
  http_method = aws_api_gateway_method.cors_workflow_health.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "cors_workflow_health" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.workflow_health.id
  http_method         = aws_api_gateway_method.cors_workflow_health.http_method
  status_code         = "200"
  response_parameters = local.cors_response_parameters
}

resource "aws_api_gateway_integration_response" "cors_workflow_health" {
  rest_api_id         = aws_api_gateway_rest_api.main.id
  resource_id         = aws_api_gateway_resource.workflow_health.id
  http_method         = aws_api_gateway_method.cors_workflow_health.http_method
  status_code         = aws_api_gateway_method_response.cors_workflow_health.status_code
  response_parameters = local.cors_headers
}

# Workflow service endpoints - Add GET method for general workflow operations
resource "aws_api_gateway_method" "workflow_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.workflow.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "workflow_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.workflow.id
  http_method = aws_api_gateway_method.workflow_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["workflow-service"].integration_uri
}

# Notifications service endpoints
resource "aws_api_gateway_method" "notifications_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.notifications.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.jwt.id
}

resource "aws_api_gateway_integration" "notifications_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.notifications.id
  http_method = aws_api_gateway_method.notifications_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.lambda_functions["notification-service"].integration_uri
}



# Lambda permissions for workflow service
resource "aws_lambda_permission" "api_gateway_workflow" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["workflow-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Additional Lambda permission for workflow proxy paths
resource "aws_lambda_permission" "api_gateway_workflow_proxy" {
  statement_id  = "AllowExecutionFromAPIGatewayWorkflowProxy"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["workflow-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/ANY/api/workflow/*"
}

# Lambda permissions for other services are managed by the IAM permissions module

# JWT Custom Authorizer
resource "aws_api_gateway_authorizer" "jwt" {
  name                   = "${var.environment}-jwt-authorizer"
  rest_api_id           = aws_api_gateway_rest_api.main.id
  authorizer_uri        = var.lambda_functions["custom-authorizer"].integration_uri
  authorizer_credentials = aws_iam_role.api_gateway_authorizer.arn
  type                  = "TOKEN"
  identity_source       = "method.request.header.Authorization"
  authorizer_result_ttl_in_seconds = 0  # Disable caching for debugging
}

# IAM role for API Gateway to invoke authorizer
resource "aws_iam_role" "api_gateway_authorizer" {
  name = "${var.environment}-api-gateway-authorizer-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "api_gateway_authorizer" {
  name = "${var.environment}-api-gateway-authorizer-policy"
  role = aws_iam_role.api_gateway_authorizer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = var.lambda_functions["custom-authorizer"].arn
      }
    ]
  })
}

# WebSocket API for real-time features (conditional)
resource "aws_apigatewayv2_api" "websocket" {
  count = var.enable_websocket_api ? 1 : 0
  name                       = "${var.environment}-ebook-websocket"
  protocol_type             = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  description               = "WebSocket API for real-time collaboration"

  tags = merge(var.tags, {
    Component = "websocket-api"
  })
}

# WebSocket routes (conditional)
resource "aws_apigatewayv2_route" "connect" {
  count     = var.enable_websocket_api ? 1 : 0
  api_id    = aws_apigatewayv2_api.websocket[0].id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_connect[0].id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  count     = var.enable_websocket_api ? 1 : 0
  api_id    = aws_apigatewayv2_api.websocket[0].id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_disconnect[0].id}"
}

resource "aws_apigatewayv2_route" "default" {
  count     = var.enable_websocket_api ? 1 : 0
  api_id    = aws_apigatewayv2_api.websocket[0].id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_default[0].id}"
}

# WebSocket integrations (conditional)
resource "aws_apigatewayv2_integration" "websocket_connect" {
  count            = var.enable_websocket_api ? 1 : 0
  api_id           = aws_apigatewayv2_api.websocket[0].id
  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_functions["notification-service"].arn
}

resource "aws_apigatewayv2_integration" "websocket_disconnect" {
  count            = var.enable_websocket_api ? 1 : 0
  api_id           = aws_apigatewayv2_api.websocket[0].id
  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_functions["notification-service"].arn
}

resource "aws_apigatewayv2_integration" "websocket_default" {
  count            = var.enable_websocket_api ? 1 : 0
  api_id           = aws_apigatewayv2_api.websocket[0].id
  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_functions["notification-service"].arn
}

# WebSocket deployment (conditional)
resource "aws_apigatewayv2_deployment" "websocket" {
  count  = var.enable_websocket_api ? 1 : 0
  api_id = aws_apigatewayv2_api.websocket[0].id

  depends_on = [
    aws_apigatewayv2_route.connect,
    aws_apigatewayv2_route.disconnect,
    aws_apigatewayv2_route.default,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

# WebSocket stage (conditional)
resource "aws_apigatewayv2_stage" "websocket" {
  count         = var.enable_websocket_api ? 1 : 0
  api_id        = aws_apigatewayv2_api.websocket[0].id
  deployment_id = aws_apigatewayv2_deployment.websocket[0].id
  name          = var.environment

  # Note: WebSocket throttling is configured at the route level

  tags = var.tags
}

# Lambda permissions for WebSocket API are managed by the IAM permissions module

# CloudWatch alarms for API Gateway (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "api_gateway_requests" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-api-gateway-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Count"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.api_request_threshold
  alarm_description   = "API Gateway requests approaching Free Tier limit"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    ApiName = aws_api_gateway_rest_api.main.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_errors" {
  alarm_name          = "${var.environment}-api-gateway-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "API Gateway 4XX error rate is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    ApiName = aws_api_gateway_rest_api.main.name
  }

  tags = var.tags
}

# Lambda permissions for user service
resource "aws_lambda_permission" "api_gateway_user" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["user-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Lambda permissions for review service
resource "aws_lambda_permission" "api_gateway_review" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["review-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Lambda permissions for notification service
resource "aws_lambda_permission" "api_gateway_notification" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["notification-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# WebSocket Lambda permissions (conditional)
resource "aws_lambda_permission" "websocket_connect" {
  count         = var.enable_websocket_api ? 1 : 0
  statement_id  = "AllowExecutionFromWebSocketConnect"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["notification-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "websocket_disconnect" {
  count         = var.enable_websocket_api ? 1 : 0
  statement_id  = "AllowExecutionFromWebSocketDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["notification-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket[0].execution_arn}/*/*"
}

resource "aws_lambda_permission" "websocket_default" {
  count         = var.enable_websocket_api ? 1 : 0
  statement_id  = "AllowExecutionFromWebSocketDefault"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_functions["notification-service"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket[0].execution_arn}/*/*"
}