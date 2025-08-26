# Variables for IAM Deployment Permissions Module

variable "environment" {
  description = "Environment name (dev, qa, staging, prod)"
  type        = string
  
  validation {
    condition     = contains(["local", "dev", "qa", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: local, dev, qa, staging, prod."
  }
}

variable "deployment_user_name" {
  description = "Name of the IAM user for deployment (leave empty to skip policy attachments)"
  type        = string
  default     = ""
}

variable "attach_individual_policies" {
  description = "Whether to attach individual service policies (true) or consolidated policy (false)"
  type        = bool
  default     = true
}

variable "create_consolidated_policy" {
  description = "Whether to create a consolidated policy combining all service permissions"
  type        = bool
  default     = false
}

variable "enable_cloudfront_permissions" {
  description = "Enable CloudFront deployment permissions"
  type        = bool
  default     = true
}

variable "enable_iam_permissions" {
  description = "Enable IAM management permissions"
  type        = bool
  default     = true
}

variable "enable_sqs_permissions" {
  description = "Enable SQS deployment permissions"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_permissions" {
  description = "Enable CloudWatch deployment permissions"
  type        = bool
  default     = true
}

variable "enable_sns_permissions" {
  description = "Enable SNS deployment permissions"
  type        = bool
  default     = true
}

variable "resource_prefix" {
  description = "Prefix for resource naming (defaults to environment)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "ebook-platform"
    ManagedBy = "terraform"
  }
}

variable "policy_name_suffix" {
  description = "Suffix to append to policy names for uniqueness"
  type        = string
  default     = ""
}