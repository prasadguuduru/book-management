# Variables for Terraform configuration

variable "environment" {
  description = "Environment name (local, dev, qa, staging, prod)"
  type        = string
  validation {
    condition     = contains(["local", "dev", "qa", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: local, dev, qa, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

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

variable "from_email" {
  description = "Default sender email address for notifications"
  type        = string
  default     = "noreply@ebook-platform.com"
}

variable "domain_name" {
  description = "Custom domain name for the application"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

# Lambda configuration variables
variable "lambda_memory_size" {
  description = "Memory size for Lambda functions"
  type = object({
    auth_service         = number
    custom_authorizer    = number
    book_service         = number
    user_service         = number
    workflow_service     = number
    review_service       = number
    notification_service = number
  })
  default = {
    auth_service         = 128
    custom_authorizer    = 128
    book_service         = 256
    user_service         = 192
    workflow_service     = 192
    review_service       = 128
    notification_service = 192
  }
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type = object({
    auth_service         = number
    custom_authorizer    = number
    book_service         = number
    user_service         = number
    workflow_service     = number
    review_service       = number
    notification_service = number
  })
  default = {
    auth_service         = 10
    custom_authorizer    = 5
    book_service         = 30
    user_service         = 15
    workflow_service     = 20
    review_service       = 15
    notification_service = 20
  }
}

# Free Tier optimization variables
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

variable "free_tier_alert_threshold" {
  description = "Threshold percentage for Free Tier alerts (0.8 = 80%)"
  type        = number
  default     = 0.8
  validation {
    condition     = var.free_tier_alert_threshold > 0 && var.free_tier_alert_threshold <= 1
    error_message = "Free tier alert threshold must be between 0 and 1."
  }
}

# Development configuration
variable "enable_debug_logging" {
  description = "Enable debug logging for development"
  type        = bool
  default     = false
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}
# IAM Deployment User Configuration
variable "deployment_user_name" {
  description = "Name of the IAM user for Terraform deployment (leave empty to skip policy attachments)"
  type        = string
  default     = ""
}

# Feature flags for LocalStack compatibility
variable "enable_websocket_api" {
  description = "Enable WebSocket API Gateway (not supported in free LocalStack)"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch Logs (limited support in LocalStack)"
  type        = bool
  default     = true
}

variable "enable_advanced_monitoring" {
  description = "Enable advanced monitoring features"
  type        = bool
  default     = true
}

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution"
  type        = bool
  default     = true
}

variable "enable_ses" {
  description = "Enable SES email service"
  type        = bool
  default     = true
}

variable "enable_route53" {
  description = "Enable Route53 DNS service"
  type        = bool
  default     = true
}

variable "enable_acm" {
  description = "Enable ACM certificate management"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable WAF web application firewall"
  type        = bool
  default     = true
}

variable "enable_xray" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "enable_secrets_manager" {
  description = "Enable AWS Secrets Manager"
  type        = bool
  default     = true
}

variable "enable_parameter_store" {
  description = "Enable Systems Manager Parameter Store"
  type        = bool
  default     = true
}

variable "enable_eventbridge" {
  description = "Enable EventBridge event bus"
  type        = bool
  default     = true
}

variable "enable_kinesis" {
  description = "Enable Kinesis data streaming"
  type        = bool
  default     = true
}

variable "enable_dynamodb_streams" {
  description = "Enable DynamoDB streams for real-time processing"
  type        = bool
  default     = true
}