# DynamoDB module for single-table design with Free Tier optimization

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Generate random suffix for table name to avoid conflicts (only for non-local environments)
resource "random_id" "table_suffix" {
  count       = var.environment == "local" ? 0 : 1
  byte_length = 4
  
  # Use keepers to ensure suffix stays consistent for existing environments
  keepers = {
    environment = var.environment
    table_name  = var.table_name
  }
}

# Generate table names with environment-specific logic
locals {
  table_name = var.environment == "local" ? "ebook-platform-local" : "${var.environment}-${var.table_name}-${random_id.table_suffix[0].hex}"
}

# Main DynamoDB table with single-table design
resource "aws_dynamodb_table" "main" {
  
  # Use simple naming for LocalStack compatibility
  name           = local.table_name
  

  billing_mode   = "PAY_PER_REQUEST"  # Better for variable workloads and Free Tier
  hash_key       = "PK"
  range_key      = "SK"

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 for status-based queries (books by status)
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI2 for genre-based queries (books by genre)
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # Global Secondary Index 1 - Status Index
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # Global Secondary Index 2 - Genre Index
  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup of temporary data
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }

  # Server-side encryption with AWS managed KMS key
  server_side_encryption {
    enabled = true
  }

  # DynamoDB Streams for real-time processing (conditional)
  stream_enabled   = var.enable_streams
  stream_view_type = var.enable_streams ? var.stream_view_type : null

  # Deletion protection for production
  deletion_protection_enabled = var.environment == "prod"

  tags = merge(var.tags, {
    Name        = "${var.environment}-${var.table_name}"
    Component   = "database"
    TableType   = "single-table"
    BillingMode = "pay-per-request"
  })

  lifecycle {
    prevent_destroy = false  # Allow destruction in development
  }
}

# CloudWatch alarms for Free Tier monitoring
resource "aws_cloudwatch_metric_alarm" "read_throttled_requests" {
  count = var.enable_free_tier_monitoring && var.environment != "local" ? 1 : 0

  alarm_name          = "${var.environment}-dynamodb-read-throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadThrottledEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "DynamoDB read requests are being throttled"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    TableName = aws_dynamodb_table.main.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "write_throttled_requests" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-dynamodb-write-throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteThrottledEvents"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "DynamoDB write requests are being throttled"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    TableName = aws_dynamodb_table.main.name
  }

  tags = var.tags
}

# Custom metric for tracking table size (Free Tier: 25GB limit)
resource "aws_cloudwatch_metric_alarm" "table_size" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-dynamodb-table-size"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "TableSizeBytes"
  namespace           = "AWS/DynamoDB"
  period              = "86400"  # Daily check
  statistic           = "Average"
  threshold           = "21474836480"  # 20GB (80% of 25GB Free Tier limit)
  alarm_description   = "DynamoDB table size approaching Free Tier limit"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    TableName = aws_dynamodb_table.main.name
  }

  tags = var.tags
}