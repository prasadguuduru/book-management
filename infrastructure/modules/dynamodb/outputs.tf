# Outputs for DynamoDB module

output "table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.main.name
}

output "table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.main.arn
}

output "table_id" {
  description = "ID of the DynamoDB table"
  value       = aws_dynamodb_table.main.id
}

output "stream_arn" {
  description = "ARN of the DynamoDB stream"
  value       = var.enable_streams ? aws_dynamodb_table.main.stream_arn : null
}

output "stream_label" {
  description = "Label of the DynamoDB stream"
  value       = var.enable_streams ? aws_dynamodb_table.main.stream_label : null
}

output "gsi_names" {
  description = "Names of Global Secondary Indexes"
  value       = ["GSI1", "GSI2"]
}

# Connection information for applications
output "connection_info" {
  description = "Connection information for applications"
  value = {
    table_name = aws_dynamodb_table.main.name
    region     = data.aws_region.current.name
    gsi1_name  = "GSI1"
    gsi2_name  = "GSI2"
  }
}

# Data source for current AWS region
data "aws_region" "current" {}

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    storage_limit_gb = 25
    read_capacity_units_per_second = 25
    write_capacity_units_per_second = 25
    billing_mode = "PAY_PER_REQUEST"
    monitoring_enabled = var.enable_free_tier_monitoring
  }
}

# Integration information for other modules
output "integration_info" {
  description = "Integration information for other modules"
  value = {
    # Environment variables for Lambda functions
    environment_variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.main.name
      DYNAMODB_REGION = data.aws_region.current.name
    }
    
    # IAM policy requirements
    required_permissions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem"
    ]
    
    # Resource ARNs for IAM policies
    resource_arns = [
      aws_dynamodb_table.main.arn,
      "${aws_dynamodb_table.main.arn}/index/*"
    ]
  }
}

# Access patterns documentation
output "access_patterns" {
  description = "Documented access patterns for the single table design"
  value = {
    user_profile = {
      operation = "GetItem"
      key = "PK=USER#{userId}, SK=PROFILE"
    }
    book_metadata = {
      operation = "GetItem"
      key = "PK=BOOK#{bookId}, SK=METADATA"
    }
    books_by_status = {
      operation = "Query"
      index = "GSI1"
      key = "GSI1PK=STATUS#{status}"
    }
    books_by_genre = {
      operation = "Query"
      index = "GSI2"
      key = "GSI2PK=GENRE#{genre}"
    }
    book_reviews = {
      operation = "Query"
      key = "PK=BOOK#{bookId}, SK begins_with REVIEW#"
    }
    workflow_history = {
      operation = "Query"
      key = "PK=WORKFLOW#{bookId}"
    }
    user_notifications = {
      operation = "Query"
      key = "PK=USER#{userId}, SK begins_with NOTIFICATION#"
    }
  }
}