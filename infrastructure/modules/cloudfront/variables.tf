# Variables for CloudFront module

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
}

variable "frontend_bucket_name" {
  description = "Name of the frontend S3 bucket"
  type        = string
}

variable "frontend_bucket_domain" {
  description = "Domain name of the frontend S3 bucket"
  type        = string
}

variable "api_gateway_domain" {
  description = "Domain name of the API Gateway"
  type        = string
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

# Custom domain configuration
variable "domain_name" {
  description = "Custom domain name for CloudFront distribution"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain (must be in us-east-1)"
  type        = string
  default     = ""
}

# Caching configuration
variable "default_cache_ttl" {
  description = "Default TTL for cached objects (seconds)"
  type        = number
  default     = 300  # 5 minutes
}

variable "max_cache_ttl" {
  description = "Maximum TTL for cached objects (seconds)"
  type        = number
  default     = 86400  # 24 hours
}

variable "static_assets_ttl" {
  description = "TTL for static assets (seconds)"
  type        = number
  default     = 31536000  # 1 year
}

# Price class for cost optimization
variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"  # US, Canada, Europe (cheapest)
  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200",
      "PriceClass_100"
    ], var.price_class)
    error_message = "Price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}

# Security configuration
variable "enable_security_headers" {
  description = "Enable security headers via CloudFront function"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable AWS WAF for additional security"
  type        = bool
  default     = false  # WAF is not in Free Tier
}

# Logging configuration
variable "enable_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = false
}

variable "logs_bucket_domain" {
  description = "S3 bucket domain for CloudFront logs"
  type        = string
  default     = ""
}

# Free Tier monitoring
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

variable "request_threshold" {
  description = "Threshold for CloudFront request alarms (80% of 10M Free Tier)"
  type        = number
  default     = 8000000
}

variable "data_transfer_threshold" {
  description = "Threshold for CloudFront data transfer alarms (80% of 1TB Free Tier in bytes)"
  type        = number
  default     = 858993459200  # 800GB in bytes
}

# Performance optimization
variable "enable_compression" {
  description = "Enable CloudFront compression"
  type        = bool
  default     = true
}

variable "enable_http2" {
  description = "Enable HTTP/2 support"
  type        = bool
  default     = true
}

variable "enable_ipv6" {
  description = "Enable IPv6 support"
  type        = bool
  default     = true
}

# Origin configuration
variable "origin_timeout" {
  description = "Origin request timeout (seconds)"
  type        = number
  default     = 30
}

variable "origin_keepalive_timeout" {
  description = "Origin keep-alive timeout (seconds)"
  type        = number
  default     = 5
}

# Error page configuration
variable "custom_error_pages" {
  description = "Custom error page configurations"
  type = list(object({
    error_code         = number
    response_code      = number
    response_page_path = string
    error_caching_min_ttl = number
  }))
  default = [
    {
      error_code         = 404
      response_code      = 200
      response_page_path = "/index.html"
      error_caching_min_ttl = 300
    },
    {
      error_code         = 403
      response_code      = 200
      response_page_path = "/index.html"
      error_caching_min_ttl = 300
    }
  ]
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}