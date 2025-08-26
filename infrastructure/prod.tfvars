# Production environment configuration

environment = "prod"
aws_region  = "us-east-1"

# JWT keys (MUST be replaced with actual secure keys)
jwt_public_key  = "replace-with-actual-production-public-key"
jwt_private_key = "replace-with-actual-production-private-key"

# Encryption key (MUST be replaced with actual secure key)
encryption_key = "replace-with-actual-production-encryption-key-32-chars"

# Lambda configuration optimized for AWS Free Tier
lambda_memory_size = {
  auth_service         = 128
  book_service         = 256
  user_service         = 192
  workflow_service     = 192
  review_service       = 128
  notification_service = 192
}

lambda_timeout = {
  auth_service         = 10
  book_service         = 30
  user_service         = 15
  workflow_service     = 20
  review_service       = 15
  notification_service = 20
}

# Free Tier monitoring
enable_free_tier_monitoring = true
free_tier_alert_threshold   = 0.8 # Alert at 80% of Free Tier limits

# Production settings
enable_debug_logging = false

# CORS configuration
cors_allowed_origins = [
  "https://ebook-platform.example.com"
]

# Custom domain (configure for production)
domain_name     = ""
certificate_arn = ""

# IAM Deployment User Configuration
deployment_user_name = ""