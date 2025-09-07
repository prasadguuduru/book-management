# Variables for IAM module

variable "environment" {
  description = "Environment name (local, dev, qa, staging, prod)"
  type        = string
}

# Resource ARNs for permission policies
variable "table_arn" {
  description = "DynamoDB table ARN"
  type        = string
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

variable "sns_topic_arns" {
  description = "List of SNS topic ARNs"
  type        = list(string)
  default     = []
}

variable "sqs_queue_arns" {
  description = "List of SQS queue ARNs"
  type        = list(string)
  default     = []
}

variable "lambda_function_arns" {
  description = "List of Lambda function ARNs"
  type        = list(string)
  default     = []
}

variable "lambda_functions" {
  description = "Map of Lambda function information"
  type = map(object({
    function_name = string
    arn          = string
  }))
  default = {}
}

# API Gateway information
variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
  default     = ""
}

variable "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  type        = string
  default     = ""
}

# Feature flags
variable "enable_cloudfront" {
  description = "Enable CloudFront-specific IAM policies"
  type        = bool
  default     = true
}

variable "enable_dynamodb_streams" {
  description = "Enable DynamoDB Streams access"
  type        = bool
  default     = true
}

variable "enable_scheduled_tasks" {
  description = "Enable EventBridge scheduled tasks"
  type        = bool
  default     = false
}

variable "enable_custom_kms_key" {
  description = "Create custom KMS key for encryption"
  type        = bool
  default     = false
}

# Email configuration for SES
variable "from_email" {
  description = "Default sender email address for notifications"
  type        = string
  default     = "noreply@ebook-platform.com"
}

variable "ses_from_addresses" {
  description = "List of allowed SES from addresses"
  type        = list(string)
  default     = []
}

# CloudWatch configuration
variable "enable_custom_metrics" {
  description = "Enable custom CloudWatch metrics"
  type        = bool
  default     = true
}

variable "custom_metric_namespaces" {
  description = "List of custom CloudWatch metric namespaces"
  type        = list(string)
  default = [
    "EbookPlatform/Business",
    "EbookPlatform/Security",
    "EbookPlatform/Performance"
  ]
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}