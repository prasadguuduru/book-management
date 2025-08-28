# Terraform Variables Configuration
# Update these values for your deployment

# Environment configuration
environment = "qa"
aws_region  = "us-east-1"

# IAM Deployment User (run ./scripts/get-current-user.sh to get this)
deployment_user_name = ""

# JWT Configuration (temporary keys for testing - generate proper ones for production)
jwt_public_key = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4f5wg5l2hKsTeNem/V41\nfGnJm6gOdrj8ym3rFkEjWT2btf06kkstX2W92jIXd4jAWmb1kMTidQhmZ39wEL7u\n1Z7HpQHEuOK-9hLmvvmfDkcv\n-----END PUBLIC KEY-----"

jwt_private_key = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDh/nCDmXaEqxN4\n16b9XjV8acmbqA52uPzKbesWQSNZPZu1/TqSSy1fZb3aMhd3iMBaZvWQxOJ1CGZn\nf3AQvu7VnselAcS44r72Eua++Z8ORy/\n-----END PRIVATE KEY-----"

# Encryption key for PII data (32-byte hex key for testing)
encryption_key = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

# Lambda configuration (optimized for Free Tier)
lambda_memory_size = {
  auth_service         = 128
  custom_authorizer    = 128
  book_service         = 256
  user_service         = 192
  workflow_service     = 192
  review_service       = 128
  notification_service = 192
}

lambda_timeout = {
  auth_service         = 10
  custom_authorizer    = 5
  book_service         = 30
  user_service         = 15
  workflow_service     = 20
  review_service       = 15
  notification_service = 20
}

# Free Tier monitoring
enable_free_tier_monitoring = true

# CORS configuration
cors_allowed_origins = ["http://localhost:3000"]

# Development settings
enable_debug_logging = true