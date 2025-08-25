# Main Terraform configuration for Ebook Publishing Platform

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

# DynamoDB Table Module
module "dynamodb" {
  source = "./modules/dynamodb"
  
  environment = var.environment
  table_name  = "${var.environment}-${local.project_name}"
  
  tags = local.common_tags
}

# Lambda Functions Module
module "lambda" {
  source = "./modules/lambda"
  
  environment = var.environment
  table_name  = module.dynamodb.table_name
  
  tags = local.common_tags
}

# API Gateway Module
module "api_gateway" {
  source = "./modules/api_gateway"
  
  environment    = var.environment
  lambda_functions = module.lambda.lambda_functions
  
  tags = local.common_tags
}

# S3 Buckets Module
module "s3" {
  source = "./modules/s3"
  
  environment = var.environment
  
  tags = local.common_tags
}

# CloudFront Distribution Module (only for non-local environments)
module "cloudfront" {
  count  = var.environment != "local" ? 1 : 0
  source = "./modules/cloudfront"
  
  environment           = var.environment
  frontend_bucket_name  = module.s3.frontend_bucket_name
  api_gateway_domain    = module.api_gateway.api_gateway_domain
  
  tags = local.common_tags
}

# SNS Topics Module
module "sns" {
  source = "./modules/sns"
  
  environment = var.environment
  
  tags = local.common_tags
}

# SQS Queues Module
module "sqs" {
  source = "./modules/sqs"
  
  environment = var.environment
  
  tags = local.common_tags
}

# CloudWatch Module
module "cloudwatch" {
  source = "./modules/cloudwatch"
  
  environment      = var.environment
  lambda_functions = module.lambda.lambda_functions
  table_name       = module.dynamodb.table_name
  
  tags = local.common_tags
}