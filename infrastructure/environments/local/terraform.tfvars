# Local development environment configuration

environment = "local"
aws_region  = "us-east-1"

# JWT keys (dummy values for local development)
jwt_public_key  = "dummy-public-key-for-local-development"
jwt_private_key = "dummy-private-key-for-local-development"

# Encryption key (dummy value for local development)
encryption_key = "dummy-encryption-key-for-local-development-32-chars"

# Lambda configuration optimized for local development
lambda_memory_size = {
  auth_service         = 128
  book_service        = 256
  user_service        = 192
  workflow_service    = 192
  review_service      = 128
  notification_service = 192
}

lambda_timeout = {
  auth_service         = 30  # Longer timeout for local debugging
  book_service        = 60
  user_service        = 30
  workflow_service    = 30
  review_service      = 30
  notification_service = 30
}

# Development settings
enable_debug_logging = true
enable_free_tier_monitoring = false  # Not needed for local

# CORS configuration for local development
cors_allowed_origins = [
  "http://localhost:3001",  # Frontend dev server
  "http://localhost:3000",  # Alternative frontend port
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3000"
]