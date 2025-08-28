# Outputs for Terraform configuration

# DynamoDB outputs
output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = module.dynamodb.table_arn
}

# Lambda outputs
output "lambda_function_names" {
  description = "Names of all Lambda functions"
  value       = module.lambda.lambda_function_names
}

output "lambda_function_arns" {
  description = "ARNs of all Lambda functions"
  value       = module.lambda.lambda_function_arns
}

# API Gateway outputs
output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = module.api_gateway.api_gateway_url
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = module.api_gateway.api_gateway_id
}

output "websocket_api_url" {
  description = "URL of the WebSocket API"
  value       = module.api_gateway.websocket_api_url
}

# S3 outputs
output "frontend_bucket_name" {
  description = "Name of the frontend S3 bucket"
  value       = module.s3.frontend_bucket_name
}

output "assets_bucket_name" {
  description = "Name of the assets S3 bucket"
  value       = module.s3.assets_bucket_name
}

output "frontend_bucket_website_endpoint" {
  description = "Website endpoint of the frontend S3 bucket"
  value       = module.s3.frontend_bucket_website_endpoint
}

# CloudFront outputs (only when enabled)
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? module.cloudfront[0].distribution_id : null
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.enable_cloudfront ? module.cloudfront[0].domain_name : null
}

output "frontend_url" {
  description = "URL to access the frontend application"
  value       = var.environment == "local" ? "http://localhost:3001" : (var.enable_cloudfront ? "https://${module.cloudfront[0].domain_name}" : "http://${module.s3.frontend_bucket_website_endpoint}")
}

# SNS outputs
output "sns_topic_arns" {
  description = "ARNs of SNS topics"
  value       = module.sns.topic_arns
}

# SQS outputs - TEMPORARILY DISABLED FOR TERRAFORM SYNC
# output "sqs_queue_urls" {
#   description = "URLs of SQS queues"
#   value       = module.sqs.queue_urls
# }

# Environment configuration
output "environment_config" {
  description = "Environment configuration for frontend"
  value = {
    VITE_APIGATEWAY_URL = var.environment == "local" ? "http://localhost:4566/restapis/${module.api_gateway.api_gateway_id}/local/_user_request_" : module.api_gateway.api_gateway_url
    VITE_WS_URL         = var.environment == "local" ? "ws://localhost:4566" : module.api_gateway.websocket_api_url
    VITE_ENVIRONMENT    = var.environment
    VITE_ENABLE_DEBUG   = var.enable_debug_logging
  }
  sensitive = false
}

# Development URLs
output "development_urls" {
  description = "URLs for development and testing"
  value = {
    frontend       = var.environment == "local" ? "http://localhost:3001" : (var.enable_cloudfront ? "https://${module.cloudfront[0].domain_name}" : "http://${module.s3.frontend_bucket_website_endpoint}")
    api            = var.environment == "local" ? "http://localhost:4566/restapis/${module.api_gateway.api_gateway_id}/local/_user_request_" : module.api_gateway.api_gateway_url
    websocket      = var.environment == "local" ? "ws://localhost:4566" : module.api_gateway.websocket_api_url
    dynamodb_admin = var.environment == "local" ? "http://localhost:8001" : null
  }
}