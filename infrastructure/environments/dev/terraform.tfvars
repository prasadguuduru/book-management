# Development environment configuration

environment = "dev"
aws_region  = "us-east-1"

# JWT keys (replace with actual keys in production)
jwt_public_key  = "replace-with-actual-public-key"
jwt_private_key = "replace-with-actual-private-key"

# Encryption key (replace with actual key in production)
encryption_key = "replace-with-actual-encryption-key"

# Lambda configuration optimized for AWS Free Tier
lambda_memory_size = {
  auth_service         = 128
  book_service        = 256
  user_service        = 192
  workflow_service    = 192
  review_service      = 128
  notification_service = 192
}

lambda_timeout = {
  auth_service         = 10
  book_service        = 30
  user_service        = 15
  workflow_service    = 20
  review_service      = 15
  notification_service = 20
}

# Free Tier monitoring
enable_free_tier_monitoring = true
free_tier_alert_threshold = 0.8  # Alert at 80% of Free Tier limits

# Development settings
enable_debug_logging = true

# CORS configuration
cors_allowed_origins = [
  "https://dev-ebook-platform.example.com",
  "http://localhost:3001"  # For local frontend development
]