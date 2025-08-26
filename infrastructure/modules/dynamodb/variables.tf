# Variables for DynamoDB module

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
}

variable "table_name" {
  description = "Base name for the DynamoDB table"
  type        = string
  default     = "ebook-platform"
}

variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Advanced configuration options
variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "enable_streams" {
  description = "Enable DynamoDB streams"
  type        = bool
  default     = true
}

variable "stream_view_type" {
  description = "Stream view type for DynamoDB streams"
  type        = string
  default     = "NEW_AND_OLD_IMAGES"
  validation {
    condition = contains([
      "KEYS_ONLY",
      "NEW_IMAGE",
      "OLD_IMAGE",
      "NEW_AND_OLD_IMAGES"
    ], var.stream_view_type)
    error_message = "Stream view type must be one of: KEYS_ONLY, NEW_IMAGE, OLD_IMAGE, NEW_AND_OLD_IMAGES."
  }
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}