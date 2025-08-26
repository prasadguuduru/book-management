# Outputs for S3 module

output "frontend_bucket_name" {
  description = "Name of the frontend S3 bucket"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_bucket_arn" {
  description = "ARN of the frontend S3 bucket"
  value       = aws_s3_bucket.frontend.arn
}

output "frontend_bucket_id" {
  description = "ID of the frontend S3 bucket"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_website_endpoint" {
  description = "Website endpoint of the frontend S3 bucket"
  value       = aws_s3_bucket_website_configuration.frontend.website_endpoint
}

output "frontend_bucket_website_domain" {
  description = "Website domain of the frontend S3 bucket"
  value       = aws_s3_bucket_website_configuration.frontend.website_domain
}

output "assets_bucket_name" {
  description = "Name of the assets S3 bucket"
  value       = aws_s3_bucket.assets.bucket
}

output "assets_bucket_arn" {
  description = "ARN of the assets S3 bucket"
  value       = aws_s3_bucket.assets.arn
}

output "assets_bucket_id" {
  description = "ID of the assets S3 bucket"
  value       = aws_s3_bucket.assets.id
}

output "logs_bucket_name" {
  description = "Name of the logs S3 bucket (if enabled)"
  value       = var.enable_access_logging ? aws_s3_bucket.logs[0].bucket : null
}

output "logs_bucket_arn" {
  description = "ARN of the logs S3 bucket (if enabled)"
  value       = var.enable_access_logging ? aws_s3_bucket.logs[0].arn : null
}

# Bucket URLs for applications
output "bucket_urls" {
  description = "S3 bucket URLs for applications"
  value = {
    frontend_website = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
    frontend_s3      = "https://${aws_s3_bucket.frontend.bucket}.s3.${data.aws_region.current.name}.amazonaws.com"
    assets_s3        = "https://${aws_s3_bucket.assets.bucket}.s3.${data.aws_region.current.name}.amazonaws.com"
  }
}

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    storage_limit_gb = 5
    get_requests_limit = 20000
    put_requests_limit = 2000
    monitoring_enabled = var.enable_free_tier_monitoring
    versioning_enabled = var.enable_versioning
    lifecycle_management_enabled = var.enable_lifecycle_management
  }
}

# Development and deployment information
output "deployment_info" {
  description = "Deployment and development information"
  value = {
    frontend_sync_command = "aws s3 sync ./dist/ s3://${aws_s3_bucket.frontend.bucket} --delete"
    frontend_upload_url   = "s3://${aws_s3_bucket.frontend.bucket}"
    assets_upload_url     = "s3://${aws_s3_bucket.assets.bucket}"
    website_url          = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
    cors_enabled         = true
    cors_origins         = var.cors_allowed_origins
  }
}

# Security and access information
output "security_info" {
  description = "Security and access configuration"
  value = {
    frontend_public_read = var.enable_public_read_access
    assets_private       = true
    ssl_required        = var.enable_ssl_requests_only
    versioning_enabled  = var.enable_versioning
    encryption_enabled  = true
    encryption_type     = "AES256"
  }
}

# CloudFront integration information
output "cloudfront_integration" {
  description = "Information for CloudFront integration"
  value = {
    frontend_origin_domain = aws_s3_bucket_website_configuration.frontend.website_endpoint
    assets_origin_domain   = "${aws_s3_bucket.assets.bucket}.s3.${data.aws_region.current.name}.amazonaws.com"
    frontend_origin_path   = ""
    assets_origin_path     = ""
    logs_bucket           = var.enable_access_logging ? aws_s3_bucket.logs[0].bucket : null
  }
}

# Presigned URL configuration for uploads
output "upload_configuration" {
  description = "Configuration for presigned URL uploads"
  value = {
    assets_bucket = aws_s3_bucket.assets.bucket
    allowed_file_types = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf"
    ]
    max_file_size_mb = 10
    upload_prefix    = "uploads/"
    cors_configured  = true
  }
}

# Lifecycle management information
output "lifecycle_info" {
  description = "S3 lifecycle management configuration"
  value = {
    enabled = var.enable_lifecycle_management
    transitions = {
      to_ia_days      = var.transition_to_ia_days
      to_glacier_days = var.transition_to_glacier_days
    }
    cleanup = {
      incomplete_multipart_days = var.delete_incomplete_multipart_days
      old_versions_days        = 30
      logs_retention_days      = var.enable_access_logging ? 30 : null
    }
  }
}

# Data source for current AWS region is already declared in main.tf