# S3 module for file storage and static website hosting with Free Tier optimization

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Random suffix for unique bucket names
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket for frontend static website hosting
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.environment}-ebook-frontend-${random_id.bucket_suffix.hex}"

  tags = merge(var.tags, {
    Component = "frontend-hosting"
    Purpose   = "static-website"
  })
}

# Frontend bucket versioning
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# Frontend bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Frontend bucket public access block (initially block all)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Frontend bucket website configuration
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }

  # SPA routing support
  routing_rule {
    condition {
      http_error_code_returned_equals = "404"
    }
    redirect {
      replace_key_with = "index.html"
    }
  }

  routing_rule {
    condition {
      http_error_code_returned_equals = "403"
    }
    redirect {
      replace_key_with = "index.html"
    }
  }
}

# Frontend bucket CORS configuration
resource "aws_s3_bucket_cors_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Frontend bucket policy for public read access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# S3 bucket for assets (book covers, user avatars, etc.)
resource "aws_s3_bucket" "assets" {
  bucket = "${var.environment}-ebook-assets-${random_id.bucket_suffix.hex}"

  tags = merge(var.tags, {
    Component = "asset-storage"
    Purpose   = "user-uploads"
  })
}

# Assets bucket versioning
resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# Assets bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Assets bucket public access block (keep private by default)
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Assets bucket CORS configuration
resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag", "x-amz-meta-custom-header"]
    max_age_seconds = 3000
  }
}

# Assets bucket lifecycle configuration for cost optimization
resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    id     = "asset_lifecycle"
    status = "Enabled"

    filter {
      prefix = ""
    }

    # Move to IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Move to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # Delete incomplete multipart uploads after 7 days
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    # Delete old versions after 30 days
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# S3 bucket notification configuration for processing uploads
resource "aws_s3_bucket_notification" "assets" {
  count  = var.enable_upload_processing ? 1 : 0
  bucket = aws_s3_bucket.assets.id

  # Trigger Lambda function on object creation
  lambda_function {
    lambda_function_arn = var.upload_processor_lambda_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ""
  }

  depends_on = [var.upload_processor_lambda_permission]
}

# CloudWatch alarms for S3 storage usage (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "frontend_bucket_size" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-s3-frontend-bucket-size"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400"  # Daily check
  statistic           = "Average"
  threshold           = "4294967296"  # 4GB (80% of 5GB Free Tier limit)
  alarm_description   = "Frontend S3 bucket size approaching Free Tier limit"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    BucketName  = aws_s3_bucket.frontend.bucket
    StorageType = "StandardStorage"
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "assets_bucket_size" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-s3-assets-bucket-size"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400"  # Daily check
  statistic           = "Average"
  threshold           = "1073741824"  # 1GB threshold for assets
  alarm_description   = "Assets S3 bucket size is growing"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    BucketName  = aws_s3_bucket.assets.bucket
    StorageType = "StandardStorage"
  }

  tags = var.tags
}

# CloudWatch alarms for S3 requests (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "s3_get_requests" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-s3-get-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "NumberOfObjects"
  namespace           = "AWS/S3"
  period              = "86400"  # Daily check
  statistic           = "Average"
  threshold           = "16000"  # 80% of 20K GET requests Free Tier limit
  alarm_description   = "S3 GET requests approaching Free Tier limit"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    BucketName = aws_s3_bucket.frontend.bucket
  }

  tags = var.tags
}

# S3 bucket for CloudFront logs (if needed)
resource "aws_s3_bucket" "logs" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = "${var.environment}-ebook-logs-${random_id.bucket_suffix.hex}"

  tags = merge(var.tags, {
    Component = "access-logs"
    Purpose   = "cloudfront-logs"
  })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Logs bucket lifecycle for automatic cleanup
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  count  = var.enable_access_logging ? 1 : 0
  bucket = aws_s3_bucket.logs[0].id

  rule {
    id     = "log_cleanup"
    status = "Enabled"

    filter {
      prefix = ""
    }

    # Delete logs after 30 days to save costs
    expiration {
      days = 30
    }

    # Delete incomplete multipart uploads after 1 day
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}