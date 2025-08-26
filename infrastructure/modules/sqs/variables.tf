# Variables for SQS module

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
}

variable "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

# Queue configuration
variable "message_retention_seconds" {
  description = "Message retention period in seconds"
  type        = number
  default     = 1209600  # 14 days
}

variable "visibility_timeout_seconds" {
  description = "Visibility timeout in seconds"
  type        = number
  default     = 300  # 5 minutes
}

variable "email_processing_timeout" {
  description = "Visibility timeout for email processing queue"
  type        = number
  default     = 900  # 15 minutes (longer for email processing)
}

# Dead letter queue configuration
variable "enable_dlq" {
  description = "Enable dead letter queues"
  type        = bool
  default     = true
}

variable "max_receive_count" {
  description = "Maximum receive count before sending to DLQ"
  type        = number
  default     = 3
}

variable "dlq_message_retention_seconds" {
  description = "Message retention period for DLQ in seconds"
  type        = number
  default     = 1209600  # 14 days
}

# Security configuration
variable "enable_encryption" {
  description = "Enable server-side encryption for SQS queues"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for SQS encryption (default: alias/aws/sqs)"
  type        = string
  default     = "alias/aws/sqs"
}

# Free Tier monitoring
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

variable "sqs_request_threshold" {
  description = "Threshold for SQS request alarms (80% of 1M Free Tier)"
  type        = number
  default     = 800000
}

variable "message_count_threshold" {
  description = "Threshold for queue message count alarms"
  type        = number
  default     = 1000
}

# Batch processing configuration
variable "enable_batch_processing" {
  description = "Enable batch processing for queues"
  type        = bool
  default     = true
}

variable "batch_size" {
  description = "Batch size for message processing"
  type        = number
  default     = 10
  validation {
    condition     = var.batch_size >= 1 && var.batch_size <= 10
    error_message = "Batch size must be between 1 and 10."
  }
}

# Queue-specific configuration
variable "queue_configurations" {
  description = "Configuration for individual queues"
  type = map(object({
    visibility_timeout_seconds = number
    message_retention_seconds  = number
    max_receive_count         = number
    enable_content_based_deduplication = bool
  }))
  default = {
    book_workflow = {
      visibility_timeout_seconds = 300
      message_retention_seconds  = 1209600
      max_receive_count         = 3
      enable_content_based_deduplication = false
    }
    user_notifications = {
      visibility_timeout_seconds = 300
      message_retention_seconds  = 1209600
      max_receive_count         = 3
      enable_content_based_deduplication = false
    }
    email_processing = {
      visibility_timeout_seconds = 900
      message_retention_seconds  = 1209600
      max_receive_count         = 5
      enable_content_based_deduplication = false
    }
  }
}

# Lambda integration configuration
variable "lambda_event_source_mapping" {
  description = "Configuration for Lambda event source mappings"
  type = map(object({
    enabled                            = bool
    batch_size                        = number
    maximum_batching_window_in_seconds = number
    function_response_types           = list(string)
  }))
  default = {
    book_workflow = {
      enabled                            = true
      batch_size                        = 10
      maximum_batching_window_in_seconds = 5
      function_response_types           = ["ReportBatchItemFailures"]
    }
    user_notifications = {
      enabled                            = true
      batch_size                        = 10
      maximum_batching_window_in_seconds = 5
      function_response_types           = ["ReportBatchItemFailures"]
    }
    email_processing = {
      enabled                            = true
      batch_size                        = 5
      maximum_batching_window_in_seconds = 10
      function_response_types           = ["ReportBatchItemFailures"]
    }
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}