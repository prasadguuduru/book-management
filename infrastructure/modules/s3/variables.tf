# Variables for S3 module

variable "environment" {
  description = "Environment name (local, dev, qa, staging, prod)"
  type        = string
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

# S3 configuration
variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "enable_access_logging" {
  description = "Enable S3 access logging"
  type        = bool
  default     = false
}

variable "enable_upload_processing" {
  description = "Enable Lambda processing of uploaded files"
  type        = bool
  default     = false
}

variable "upload_processor_lambda_arn" {
  description = "ARN of Lambda function to process uploads"
  type        = string
  default     = ""
}

variable "upload_processor_lambda_permission" {
  description = "Lambda permission resource for S3 notifications"
  type        = any
  default     = null
}

# Free Tier monitoring
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
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
  default     = ["GET", "HEAD", "PUT", "POST", "DELETE"]
}

variable "cors_allowed_headers" {
  description = "CORS allowed headers"
  type        = list(string)
  default     = ["*"]
}

# Lifecycle configuration
variable "enable_lifecycle_management" {
  description = "Enable S3 lifecycle management for cost optimization"
  type        = bool
  default     = true
}

variable "transition_to_ia_days" {
  description = "Days after which objects transition to IA storage class"
  type        = number
  default     = 30
}

variable "transition_to_glacier_days" {
  description = "Days after which objects transition to Glacier storage class"
  type        = number
  default     = 90
}

variable "delete_incomplete_multipart_days" {
  description = "Days after which incomplete multipart uploads are deleted"
  type        = number
  default     = 7
}

# Security configuration
variable "enable_public_read_access" {
  description = "Enable public read access for frontend bucket"
  type        = bool
  default     = true
}

variable "enable_ssl_requests_only" {
  description = "Require SSL for all requests"
  type        = bool
  default     = true
}

# Content configuration
variable "default_cache_control" {
  description = "Default Cache-Control header for objects"
  type        = string
  default     = "public, max-age=31536000"  # 1 year for static assets
}

variable "html_cache_control" {
  description = "Cache-Control header for HTML files"
  type        = string
  default     = "public, max-age=300"  # 5 minutes for HTML
}

variable "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN for Origin Access Control"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}