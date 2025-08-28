# Variables for Lambda module

variable "environment" {
  description = "Environment name (local, dev, qa, staging, prod)"
  type        = string
}

variable "table_name" {
  description = "DynamoDB table name"
  type        = string
}

variable "table_arn" {
  description = "DynamoDB table ARN"
  type        = string
}

variable "assets_bucket_name" {
  description = "S3 assets bucket name"
  type        = string
  default     = ""
}

variable "assets_bucket_arn" {
  description = "S3 assets bucket ARN"
  type        = string
  default     = ""
}

variable "notification_topic_arn" {
  description = "SNS topic ARN for notifications"
  type        = string
  default     = ""
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role (from IAM module)"
  type        = string
}

# JWT configuration
variable "jwt_public_key" {
  description = "JWT public key for token validation"
  type        = string
  sensitive   = true
}

variable "jwt_private_key" {
  description = "JWT private key for token signing"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for PII data"
  type        = string
  sensitive   = true
}

# Lambda configuration
variable "lambda_memory_size" {
  description = "Memory size for Lambda functions"
  type = object({
    auth_service         = number
    custom_authorizer    = number
    book_service        = number
    user_service        = number
    workflow_service    = number
    review_service      = number
    notification_service = number
  })
  default = {
    auth_service         = 128
    custom_authorizer    = 128
    book_service        = 256
    user_service        = 192
    workflow_service    = 192
    review_service      = 128
    notification_service = 192
  }
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type = object({
    auth_service         = number
    custom_authorizer    = number
    book_service        = number
    user_service        = number
    workflow_service    = number
    review_service      = number
    notification_service = number
  })
  default = {
    auth_service         = 10
    custom_authorizer    = 5
    book_service        = 30
    user_service        = 15
    workflow_service    = 20
    review_service      = 15
    notification_service = 20
  }
}

variable "lambda_zip_path" {
  description = "Path to Lambda deployment packages"
  type        = string
  default     = "../../backend/dist"
}

# Free Tier monitoring
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

variable "lambda_invocation_threshold" {
  description = "Threshold for Lambda invocation alarms (80% of 1M Free Tier)"
  type        = number
  default     = 800000
}

# Development features
variable "enable_function_urls" {
  description = "Enable Lambda function URLs for direct HTTP access"
  type        = bool
  default     = false
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins for function URLs"
  type        = list(string)
  default     = ["*"]
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}