# Main Terraform configuration for Ebook Publishing Platform

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  # LocalStack configuration for local development
  dynamic "endpoints" {
    for_each = var.environment == "local" ? [1] : []
    content {
      apigateway     = "http://localhost:4566"
      cloudformation = "http://localhost:4566"
      cloudwatch     = "http://localhost:4566"
      dynamodb       = "http://localhost:4566"
      iam            = "http://localhost:4566"
      lambda         = "http://localhost:4566"
      s3             = "http://localhost:4566"
      sns            = "http://localhost:4566"
      sqs            = "http://localhost:4566"
      sts            = "http://localhost:4566"
    }
  }

  # Skip credentials validation for LocalStack
  skip_credentials_validation = var.environment == "local"
  skip_metadata_api_check     = var.environment == "local"
  skip_requesting_account_id  = var.environment == "local"

  # Use dummy credentials for LocalStack
  access_key = var.environment == "local" ? "test" : null
  secret_key = var.environment == "local" ? "test" : null
}

# Local variables
locals {
  project_name = "ebook-platform"
  common_tags = {
    Project     = local.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# SNS Topics Module (created first to avoid circular dependencies)
module "sns" {
  source = "./modules/sns"

  environment                 = var.environment
  enable_free_tier_monitoring = var.enable_free_tier_monitoring

  tags = local.common_tags
}

# SQS Queues Module
module "sqs" {
  source = "./modules/sqs"

  environment                 = var.environment
  enable_free_tier_monitoring = var.enable_free_tier_monitoring
  alarm_topic_arn             = module.sns.topic_arns.system_alerts

  tags = local.common_tags
}

# DynamoDB Table Module
module "dynamodb" {
  source = "./modules/dynamodb"

  environment                 = var.environment
  table_name                  = local.project_name
  enable_free_tier_monitoring = var.enable_free_tier_monitoring
  alarm_topic_arn             = module.sns.topic_arns.system_alerts

  tags = local.common_tags
}

# S3 Buckets Module
module "s3" {
  source = "./modules/s3"

  environment                 = var.environment
  enable_free_tier_monitoring = var.enable_free_tier_monitoring
  alarm_topic_arn             = module.sns.topic_arns.system_alerts
  cors_allowed_origins        = var.cors_allowed_origins

  tags = local.common_tags
}

# IAM Module (created after basic resources)
module "iam" {
  source = "./modules/iam"

  environment = var.environment

  # Resource ARNs
  table_arn            = module.dynamodb.table_arn
  frontend_bucket_arn  = module.s3.frontend_bucket_arn
  frontend_bucket_name = module.s3.frontend_bucket_name
  assets_bucket_arn    = module.s3.assets_bucket_arn
  sns_topic_arns       = values(module.sns.topic_arns)
  sqs_queue_arns       = values(module.sqs.queue_arns)

  # Lambda function information (will be empty initially)
  lambda_function_arns = []
  lambda_functions     = {}

  # Feature flags
  enable_cloudfront       = var.environment != "local"
  enable_dynamodb_streams = true
  enable_scheduled_tasks  = false

  tags = local.common_tags

  depends_on = [
    module.dynamodb,
    module.s3,
    module.sns,
    module.sqs
  ]
}

# Lambda Functions Module
module "lambda" {
  source = "./modules/lambda"

  environment            = var.environment
  table_name             = module.dynamodb.table_name
  table_arn              = module.dynamodb.table_arn
  assets_bucket_name     = module.s3.assets_bucket_name
  assets_bucket_arn      = module.s3.assets_bucket_arn
  notification_topic_arn = module.sns.topic_arns.user_notifications
  alarm_topic_arn        = module.sns.topic_arns.system_alerts

  # IAM role from IAM module
  lambda_execution_role_arn = module.iam.lambda_execution_role_arn

  # JWT and encryption configuration
  jwt_public_key  = var.jwt_public_key
  jwt_private_key = var.jwt_private_key
  encryption_key  = var.encryption_key

  # Lambda configuration
  lambda_memory_size = var.lambda_memory_size
  lambda_timeout     = var.lambda_timeout

  # Free Tier monitoring
  enable_free_tier_monitoring = var.enable_free_tier_monitoring
  cors_allowed_origins        = var.cors_allowed_origins

  tags = local.common_tags

  depends_on = [module.iam]
}

# API Gateway Module
module "api_gateway" {
  source = "./modules/api_gateway"

  environment      = var.environment
  lambda_functions = module.lambda.service_integrations
  alarm_topic_arn  = module.sns.topic_arns.system_alerts

  # Rate limiting configuration
  api_rate_limit  = 1000
  api_burst_limit = 2000

  # Free Tier monitoring
  enable_free_tier_monitoring = var.enable_free_tier_monitoring
  cors_allowed_origins        = var.cors_allowed_origins

  tags = local.common_tags
}

# CloudFront Distribution Module (only for non-local environments)
module "cloudfront" {
  count  = var.environment != "local" ? 1 : 0
  source = "./modules/cloudfront"

  environment            = var.environment
  frontend_bucket_name   = module.s3.frontend_bucket_name
  frontend_bucket_domain = module.s3.cloudfront_integration.frontend_origin_domain
  api_gateway_domain     = module.api_gateway.api_gateway_domain
  alarm_topic_arn        = module.sns.topic_arns.system_alerts

  # Custom domain configuration
  domain_name     = var.domain_name
  certificate_arn = var.certificate_arn

  # Free Tier monitoring
  enable_free_tier_monitoring = var.enable_free_tier_monitoring

  tags = local.common_tags
}

# CloudWatch Module
module "cloudwatch" {
  source = "./modules/cloudwatch"

  environment      = var.environment
  lambda_functions = module.lambda.lambda_functions
  table_name       = module.dynamodb.table_name
  alarm_topic_arn  = module.sns.topic_arns.system_alerts

  # Optional resources
  cloudfront_distribution_id = var.environment != "local" ? module.cloudfront[0].distribution_id : null
  frontend_bucket_name       = module.s3.frontend_bucket_name

  # Free Tier monitoring
  enable_free_tier_monitoring = var.enable_free_tier_monitoring

  tags = local.common_tags
}

# IAM Permissions Module (after all resources are created)
# Note: This module will be added later once all Lambda functions are deployed
# For now, basic permissions are handled by the IAM module