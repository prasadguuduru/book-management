# Variables for Terraform configuration

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["local", "dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: local, dev, staging, prod."
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
    book_service         = number
    user_service         = number
    workflow_service     = number
    review_service       = number
    notification_service = number
  })
  default = {
    auth_service         = 128
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
    book_service         = number
    user_service         = number
    workflow_service     = number
    review_service       = number
    notification_service = number
  })
  default = {
    auth_service         = 10
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