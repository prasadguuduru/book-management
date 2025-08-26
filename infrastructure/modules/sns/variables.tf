# Variables for SNS module

variable "environment" {
  description = "Environment name (local, dev, staging, prod)"
  type        = string
}

# Subscription configuration
variable "alert_email" {
  description = "Email address for system alerts"
  type        = string
  default     = ""
}

variable "notification_lambda_arn" {
  description = "ARN of Lambda function for processing notifications"
  type        = string
  default     = ""
}

variable "workflow_queue_arn" {
  description = "ARN of SQS queue for workflow processing"
  type        = string
  default     = ""
}

variable "notification_queue_arn" {
  description = "ARN of SQS queue for notification processing"
  type        = string
  default     = ""
}

# Free Tier monitoring
variable "enable_free_tier_monitoring" {
  description = "Enable Free Tier usage monitoring and alerts"
  type        = bool
  default     = true
}

variable "sns_publish_threshold" {
  description = "Threshold for SNS publish alarms (80% of 1M Free Tier)"
  type        = number
  default     = 800000
}

# Topic configuration
variable "enable_encryption" {
  description = "Enable server-side encryption for SNS topics"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for SNS encryption (default: alias/aws/sns)"
  type        = string
  default     = "alias/aws/sns"
}

# Delivery configuration
variable "delivery_retry_policy" {
  description = "Delivery retry policy configuration"
  type = object({
    min_delay_target     = number
    max_delay_target     = number
    num_retries         = number
    num_max_delay_retries = number
    num_min_delay_retries = number
    num_no_delay_retries  = number
    backoff_function     = string
  })
  default = {
    min_delay_target     = 20
    max_delay_target     = 20
    num_retries         = 3
    num_max_delay_retries = 0
    num_min_delay_retries = 0
    num_no_delay_retries  = 0
    backoff_function     = "linear"
  }
}

# Message filtering
variable "enable_message_filtering" {
  description = "Enable SNS message filtering"
  type        = bool
  default     = true
}

# Dead letter queue configuration
variable "enable_dlq" {
  description = "Enable dead letter queue for failed deliveries"
  type        = bool
  default     = true
}

variable "dlq_max_receive_count" {
  description = "Maximum receive count before sending to DLQ"
  type        = number
  default     = 3
}

# Topic-specific configuration
variable "topic_configurations" {
  description = "Configuration for individual topics"
  type = map(object({
    display_name = string
    description  = string
    enable_fifo  = bool
  }))
  default = {
    book_workflow = {
      display_name = "Book Workflow Notifications"
      description  = "Notifications for book workflow state changes"
      enable_fifo  = false
    }
    user_notifications = {
      display_name = "User Notifications"
      description  = "General user notifications and alerts"
      enable_fifo  = false
    }
    system_alerts = {
      display_name = "System Alerts"
      description  = "System monitoring and alert notifications"
      enable_fifo  = false
    }
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}