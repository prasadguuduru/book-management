# QA environment configuration

environment = "qa"
aws_region  = "us-east-1"

# JWT keys (matching .env.qa values)
jwt_public_key  = "qa-ebook-platform-jwt-public-key-2024-secure"
jwt_private_key = "qa-jwt-secret-key-for-ebook-platform-2024-secure"

# Encryption key (matching .env.qa values)
encryption_key = "qa-encryption-key-32-bytes-long-!"

# Lambda configuration optimized for AWS Free Tier
lambda_memory_size = {
  auth_service         = 128
  book_service         = 256
  user_service         = 192
  workflow_service     = 192
  review_service       = 128
  notification_service = 192
  custom_authorizer    = 128
}

lambda_timeout = {
  auth_service         = 10
  book_service         = 30
  user_service         = 15
  workflow_service     = 20
  review_service       = 15
  notification_service = 20
  custom_authorizer    = 10
}

# Free Tier monitoring
enable_free_tier_monitoring = true
free_tier_alert_threshold   = 0.8 # Alert at 80% of Free Tier limits

# QA settings
enable_debug_logging = true

# CORS configuration
cors_allowed_origins = [
  "https://d2xg2iv1qaydac.cloudfront.net",
  "http://qa-ebook-frontend-96c175f3.s3-website-us-east-1.amazonaws.com",
  "http://localhost:3000",
  "http://localhost:5173"
]

# Custom domain (optional)
domain_name     = ""
certificate_arn = ""

# IAM Deployment User Configuration
deployment_user_name = ""

# Enable CloudFront for CDN
enable_cloudfront = true