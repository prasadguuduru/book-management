# Variables for DLQ monitoring module

variable "environment" {
  description = "Environment name (local, qa, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "dlq_message_count_threshold" {
  description = "Threshold for DLQ message count alarm"
  type        = number
  default     = 10
}

variable "dlq_message_age_threshold" {
  description = "Threshold for DLQ message age alarm (seconds)"
  type        = number
  default     = 7200  # 2 hours
}

variable "alert_email" {
  description = "Email address for DLQ alerts"
  type        = string
  default     = ""
}