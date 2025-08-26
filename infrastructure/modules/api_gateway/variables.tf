# Variables for API Gateway module

variable "environment" {
  description = "Environment name (local, dev, qa, staging, prod)"
  type        = string
}

variable "lambda_functions" {
  description = "Lambda function information for integrations"
  type = map(object({
    function_name   = string
    arn            = string
    invoke_arn     = string
    integration_uri = string
  }))
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

# API Gateway configuration
variable "api_rate_limit" {
  description = "API Gateway rate limit (requests per second)"
  type        = number
  default     = 1000
}

variable "api_burst_limit" {
  description = "API Gateway burst limit"
  type        = number
  default     = 2000
}

variable "websocket_rate_limit" {
  description = "WebSocket API rate limit (requests per second)"
  type        = number
  default     = 500
}

variable "websocket_burst_limit" {
  description = "WebSocket API burst limit"
  type        = number
  default     = 1000
}

# Feature flags
variable "enable_websocket_api" {
  description = "Enable WebSocket API Gateway"
  type        = bool
  default     = true
}

# Free Tier monitoring
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

variable "api_request_threshold" {
  description = "Threshold for API Gateway request alarms (80% of 1M Free Tier)"
  type        = number
  default     = 800000
}

# CORS configuration
variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allowed_methods" {
  description = "CORS allowed methods"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}

variable "cors_allowed_headers" {
  description = "CORS allowed headers"
  type        = list(string)
  default     = [
    "Content-Type",
    "X-Amz-Date",
    "Authorization",
    "X-Api-Key",
    "X-Amz-Security-Token",
    "X-Requested-With"
  ]
}

# Custom domain configuration
variable "domain_name" {
  description = "Custom domain name for API Gateway"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = ""
}

# Caching configuration
variable "enable_caching" {
  description = "Enable API Gateway caching"
  type        = bool
  default     = false
}

variable "cache_cluster_size" {
  description = "API Gateway cache cluster size"
  type        = string
  default     = "0.5"
  validation {
    condition = contains([
      "0.5", "1.6", "6.1", "13.5", "28.4", "58.2", "118", "237"
    ], var.cache_cluster_size)
    error_message = "Cache cluster size must be one of: 0.5, 1.6, 6.1, 13.5, 28.4, 58.2, 118, 237."
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}