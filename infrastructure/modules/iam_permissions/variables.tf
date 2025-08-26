# Variables for IAM Permissions module

variable "environment" {
  description = "Environment name (local, dev, qa, staging, prod)"
  type        = string
}

# Lambda function information
variable "lambda_functions" {
  description = "Map of Lambda function information"
  type = map(object({
    function_name = string
    arn          = string
  }))
}

variable "auth_service_function_name" {
  description = "Auth service Lambda function name"
  type        = string
}

variable "book_service_function_name" {
  description = "Book service Lambda function name"
  type        = string
}

variable "user_service_function_name" {
  description = "User service Lambda function name"
  type        = string
}

variable "workflow_service_function_name" {
  description = "Workflow service Lambda function name"
  type        = string
}

variable "review_service_function_name" {
  description = "Review service Lambda function name"
  type        = string
}

variable "notification_service_function_name" {
  description = "Notification service Lambda function name"
  type        = string
}

variable "notification_service_function_arn" {
  description = "Notification service Lambda function ARN"
  type        = string
}

# Resource ARNs
variable "table_arn" {
  description = "DynamoDB table ARN"
  type        = string
}

variable "dynamodb_stream_arn" {
  description = "DynamoDB stream ARN"
  type        = string
  default     = ""
}

variable "frontend_bucket_arn" {
  description = "Frontend S3 bucket ARN"
  type        = string
}

variable "frontend_bucket_name" {
  description = "Frontend S3 bucket name"
  type        = string
}

variable "assets_bucket_arn" {
  description = "Assets S3 bucket ARN"
  type        = string
}

variable "notification_topic_arn" {
  description = "SNS notification topic ARN"
  type        = string
}

variable "workflow_queue_arn" {
  description = "SQS workflow queue ARN"
  type        = string
}

variable "notification_queue_arn" {
  description = "SQS notification queue ARN"
  type        = string
}

# API Gateway information
variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

variable "api_gateway_cloudwatch_role_arn" {
  description = "API Gateway CloudWatch role ARN"
  type        = string
}

# CloudFront information
variable "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  type        = string
  default     = ""
}

# Feature flags
variable "enable_cloudfront" {
  description = "Enable CloudFront-specific permissions"
  type        = bool
  default     = true
}

variable "enable_dynamodb_streams" {
  description = "Enable DynamoDB Streams event source mapping"
  type        = bool
  default     = true
}

variable "enable_s3_notifications" {
  description = "Enable S3 bucket notifications"
  type        = bool
  default     = false
}

variable "enable_scheduled_tasks" {
  description = "Enable EventBridge scheduled tasks"
  type        = bool
  default     = false
}

variable "enable_sqs_triggers" {
  description = "Enable SQS event source mappings for Lambda"
  type        = bool
  default     = true
}

# Security configuration
variable "enable_resource_based_policies" {
  description = "Enable resource-based policies for additional security"
  type        = bool
  default     = true
}

variable "enable_cross_account_access" {
  description = "Enable cross-account access for development environments"
  type        = bool
  default     = false
}

# Event source mapping configuration
variable "sqs_batch_size" {
  description = "Batch size for SQS event source mappings"
  type        = number
  default     = 10
  validation {
    condition     = var.sqs_batch_size >= 1 && var.sqs_batch_size <= 10
    error_message = "SQS batch size must be between 1 and 10."
  }
}

variable "sqs_maximum_batching_window" {
  description = "Maximum batching window for SQS event source mappings (seconds)"
  type        = number
  default     = 5
  validation {
    condition     = var.sqs_maximum_batching_window >= 0 && var.sqs_maximum_batching_window <= 300
    error_message = "SQS maximum batching window must be between 0 and 300 seconds."
  }
}

variable "dynamodb_batch_size" {
  description = "Batch size for DynamoDB Streams event source mapping"
  type        = number
  default     = 10
  validation {
    condition     = var.dynamodb_batch_size >= 1 && var.dynamodb_batch_size <= 1000
    error_message = "DynamoDB batch size must be between 1 and 1000."
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}