# Outputs for CloudFront module

output "distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.arn
}

output "domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "hosted_zone_id" {
  description = "CloudFront hosted zone ID for Route 53 alias records"
  value       = aws_cloudfront_distribution.frontend.hosted_zone_id
}

output "distribution_url" {
  description = "URL of the CloudFront distribution"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "custom_domain_url" {
  description = "Custom domain URL (if configured)"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : null
}

# Cache policy information (using AWS managed policies)
output "cache_policies" {
  description = "CloudFront cache policy information"
  value = {
    spa_cache = {
      id   = "5f3960fe-4fd7-462c-b26c-53ae11482a72"
      name = "Managed-CachingOptimized"
    }
    static_assets = {
      id   = "5e37d64e-5cbf-4c43-b648-393608d13f14"
      name = "Managed-CachingOptimizedForUncompressedObjects"
    }
    api_no_cache = {
      id   = "bb4a7d60-d21b-424b-b20c-16727785a24b"
      name = "Managed-CachingDisabled"
    }
  }
}

# Origin information
output "origins" {
  description = "CloudFront origin information"
  value = {
    frontend_s3 = {
      domain_name = var.frontend_bucket_domain
      origin_id   = "S3-${var.frontend_bucket_name}"
    }
    api_gateway = {
      domain_name = var.api_gateway_domain
      origin_id   = "API-Gateway"
      origin_path = "/${var.environment}"
    }
  }
}

# Security configuration
output "security_info" {
  description = "Security configuration information"
  value = {
    security_headers_enabled = var.enable_security_headers
    security_headers_function_arn = var.enable_security_headers ? aws_cloudfront_function.security_headers[0].arn : null
    response_headers_policy_id = "94d7c305-1698-4b59-9dc4-564927ac1c6c"  # Managed-SecurityHeadersPolicy
    ssl_support_method = var.certificate_arn != "" ? "sni-only" : "cloudfront-default"
    minimum_protocol_version = var.certificate_arn != "" ? "TLSv1.2_2021" : null
  }
}

# Free Tier usage information
output "free_tier_info" {
  description = "Free Tier usage information and limits"
  value = {
    monthly_data_transfer_limit_gb = 1024  # 1TB
    monthly_request_limit = 10000000       # 10M requests
    price_class = var.price_class
    monitoring_enabled = var.enable_free_tier_monitoring
    request_threshold = var.request_threshold
    data_transfer_threshold_gb = var.data_transfer_threshold / 1073741824  # Convert bytes to GB
  }
}

# Performance configuration
output "performance_info" {
  description = "Performance configuration information"
  value = {
    compression_enabled = var.enable_compression
    http2_enabled = var.enable_http2
    ipv6_enabled = var.enable_ipv6
    price_class = var.price_class
    cache_behaviors = {
      default_ttl = var.default_cache_ttl
      max_ttl = var.max_cache_ttl
      static_assets_ttl = var.static_assets_ttl
    }
  }
}

# Deployment information
output "deployment_info" {
  description = "Deployment and invalidation information"
  value = {
    distribution_id = aws_cloudfront_distribution.frontend.id
    invalidation_command = "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.frontend.id} --paths '/*'"
    deployment_url = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
    cache_invalidation_paths = [
      "/*",           # All files
      "/index.html",  # Main HTML file
      "/static/*"     # Static assets
    ]
  }
}

# Monitoring and logging
output "monitoring_info" {
  description = "Monitoring and logging configuration"
  value = {
    cloudwatch_metrics_enabled = true
    real_time_logs_enabled = false  # Not in Free Tier
    standard_logs_enabled = var.enable_logging
    logs_bucket = var.enable_logging ? var.logs_bucket_domain : null
    alarm_thresholds = {
      requests = var.request_threshold
      data_transfer_bytes = var.data_transfer_threshold
      error_rate_percent = 5
    }
  }
}

# Integration information for other services
output "integration_info" {
  description = "Integration information for other AWS services"
  value = {
    s3_origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
    api_gateway_integration = {
      path_pattern = "/api/*"
      origin_id = "API-Gateway"
      cache_disabled = true
    }
    custom_error_responses = var.custom_error_pages
  }
}

# Development and testing information
output "development_info" {
  description = "Development and testing information"
  value = {
    test_urls = {
      main_site = "https://${aws_cloudfront_distribution.frontend.domain_name}"
      api_endpoint = "https://${aws_cloudfront_distribution.frontend.domain_name}/api"
      health_check = "https://${aws_cloudfront_distribution.frontend.domain_name}/health"
    }
    curl_commands = {
      test_frontend = "curl -I https://${aws_cloudfront_distribution.frontend.domain_name}"
      test_api = "curl -I https://${aws_cloudfront_distribution.frontend.domain_name}/api/health"
      test_cors = "curl -H 'Origin: http://localhost:3000' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: X-Requested-With' -X OPTIONS https://${aws_cloudfront_distribution.frontend.domain_name}/api/health"
    }
    cache_testing = {
      check_cache_headers = "curl -I https://${aws_cloudfront_distribution.frontend.domain_name}/static/js/main.js"
      check_no_cache_api = "curl -I https://${aws_cloudfront_distribution.frontend.domain_name}/api/health"
    }
  }
}