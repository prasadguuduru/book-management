# Variables for CloudWatch module

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
}

variable "table_name" {
  description = "DynamoDB table name for monitoring"
  type        = string
}

variable "lambda_functions" {
  description = "Lambda function information for monitoring"
  type = map(object({
    function_name = string
    arn          = string
    timeout      = number
  }))
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

# Optional resources for monitoring
variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for monitoring"
  type        = string
  default     = null
}

variable "frontend_bucket_name" {
  description = "Frontend S3 bucket name for monitoring"
  type        = string
  default     = ""
}

# Free Tier monitoring
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

# Log retention configuration
variable "log_retention_days" {
  description = "Log retention period for application logs"
  type        = number
  default     = 7
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.log_retention_days)
    error_message = "Log retention days must be one of the allowed CloudWatch values."
  }
}

variable "security_log_retention_days" {
  description = "Log retention period for security logs"
  type        = number
  default     = 30
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.security_log_retention_days)
    error_message = "Log retention days must be one of the allowed CloudWatch values."
  }
}

variable "audit_log_retention_days" {
  description = "Log retention period for audit logs"
  type        = number
  default     = 90
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.audit_log_retention_days)
    error_message = "Log retention days must be one of the allowed CloudWatch values."
  }
}

# Dashboard configuration
variable "enable_detailed_monitoring" {
  description = "Enable detailed monitoring with additional metrics"
  type        = bool
  default     = true
}

variable "dashboard_period" {
  description = "Default period for dashboard metrics (seconds)"
  type        = number
  default     = 300
}

# Alarm thresholds
variable "lambda_error_threshold" {
  description = "Threshold for Lambda error alarms"
  type        = number
  default     = 5
}

variable "lambda_duration_threshold_percentage" {
  description = "Percentage of timeout for Lambda duration alarms"
  type        = number
  default     = 80
  validation {
    condition     = var.lambda_duration_threshold_percentage > 0 && var.lambda_duration_threshold_percentage <= 100
    error_message = "Lambda duration threshold percentage must be between 1 and 100."
  }
}

variable "api_gateway_error_threshold" {
  description = "Threshold for API Gateway error alarms"
  type        = number
  default     = 5
}

variable "api_gateway_latency_threshold" {
  description = "Threshold for API Gateway latency alarms (milliseconds)"
  type        = number
  default     = 5000
}

variable "dynamodb_throttle_threshold" {
  description = "Threshold for DynamoDB throttle alarms"
  type        = number
  default     = 0
}

variable "auth_failure_threshold" {
  description = "Threshold for authentication failure alarms"
  type        = number
  default     = 10
}

# Custom metrics configuration
variable "enable_business_metrics" {
  description = "Enable business KPI metrics collection"
  type        = bool
  default     = true
}

variable "enable_security_metrics" {
  description = "Enable security metrics collection"
  type        = bool
  default     = true
}

# CloudWatch Insights configuration
variable "enable_insights_queries" {
  description = "Enable predefined CloudWatch Insights queries"
  type        = bool
  default     = true
}

variable "insights_query_retention_days" {
  description = "Retention period for CloudWatch Insights queries"
  type        = number
  default     = 30
}

# Cost optimization
variable "enable_log_compression" {
  description = "Enable log compression to reduce costs"
  type        = bool
  default     = true
}

variable "metric_filter_pattern_optimization" {
  description = "Optimize metric filter patterns for cost efficiency"
  type        = bool
  default     = true
}

# Notification configuration
variable "notification_channels" {
  description = "Notification channels for different alarm types"
  type = object({
    critical = list(string)
    warning  = list(string)
    info     = list(string)
  })
  default = {
    critical = []
    warning  = []
    info     = []
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}