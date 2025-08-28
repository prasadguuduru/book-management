# CloudFront module for CDN distribution with Free Tier optimization

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_region" "current" {}

# Origin Access Control for S3 integration
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.environment}-frontend-oac"
  description                       = "Origin Access Control for frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution for frontend
resource "aws_cloudfront_distribution" "frontend" {
  # S3 origin for frontend static files
  origin {
    domain_name              = "${var.frontend_bucket_name}.s3.us-east-1.amazonaws.com"
    origin_id                = "S3-${var.frontend_bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # API Gateway origin for API calls
  origin {
    domain_name = var.api_gateway_domain
    origin_id   = "API-Gateway"
    origin_path = "/${var.environment}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.environment} Ebook Platform Frontend Distribution"

  # Aliases for custom domain (if provided)
  aliases = var.domain_name != "" ? [var.domain_name] : []

  # Default cache behavior for frontend static files
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.frontend_bucket_name}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Use AWS managed cache policy for SPA
    cache_policy_id = "5f3960fe-4fd7-462c-b26c-53ae11482a72"  # Managed-CachingOptimized

    # Use AWS managed security headers policy
    response_headers_policy_id = "94d7c305-1698-4b59-9dc4-564927ac1c6c"  # Managed-SecurityHeadersPolicy

    # Function associations for security headers
    dynamic "function_association" {
      for_each = var.enable_security_headers ? [1] : []
      content {
        event_type   = "viewer-response"
        function_arn = aws_cloudfront_function.security_headers[0].arn
      }
    }
  }

  # Cache behavior for API calls (no caching) - MUST come first
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "API-Gateway"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Use AWS managed cache policy for API calls (no caching)
    cache_policy_id = "bb4a7d60-d21b-424b-b20c-16727785a24b"  # Managed-CachingDisabled

    # Use AWS managed origin request policy that forwards Authorization header
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"  # Managed-AllViewerExceptHostHeaderAndCloudFrontHeaders

    # Function to preserve /api/* paths for API Gateway
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.api_path_rewrite.arn
    }
  }

  # Cache behavior for static assets (JS, CSS, images)
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.frontend_bucket_name}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Use AWS managed cache policy for static assets
    cache_policy_id = "5e37d64e-5cbf-4c43-b648-393608d13f14"  # Managed-CachingOptimizedForUncompressedObjects
  }

  # Custom error pages for SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 300
  }

  # Geographic restrictions (none for global access)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL certificate configuration
  viewer_certificate {
    # Use custom certificate if domain is provided
    acm_certificate_arn      = var.certificate_arn != "" ? var.certificate_arn : null
    ssl_support_method       = var.certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version = var.certificate_arn != "" ? "TLSv1.2_2021" : null
    
    # Use CloudFront default certificate if no custom domain
    cloudfront_default_certificate = var.certificate_arn == "" ? true : null
  }

  # Logging configuration (optional)
  dynamic "logging_config" {
    for_each = var.enable_logging ? [1] : []
    content {
      include_cookies = false
      bucket          = var.logs_bucket_domain
      prefix          = "cloudfront-logs/"
    }
  }

  # Price class for Free Tier optimization
  price_class = var.price_class

  tags = merge(var.tags, {
    Component = "cdn"
    Service   = "cloudfront"
  })

  # Prevent destruction in production
  lifecycle {
    prevent_destroy = false
  }
}

# Using AWS managed origin request policy that forwards Authorization header

# Using AWS managed policies for other behaviors:
# - 5f3960fe-4fd7-462c-b26c-53ae11482a72: Managed-CachingOptimized (for SPA)
# - 5e37d64e-5cbf-4c43-b648-393608d13f14: Managed-CachingOptimizedForUncompressedObjects (for static assets)
# - bb4a7d60-d21b-424b-b20c-16727785a24b: Managed-CachingDisabled (for API calls)
# - 94d7c305-1698-4b59-9dc4-564927ac1c6c: Managed-SecurityHeadersPolicy (for security headers)

# CloudFront function to preserve API paths
resource "aws_cloudfront_function" "api_path_rewrite" {
  name    = "${var.environment}-api-path-rewrite"
  runtime = "cloudfront-js-1.0"
  comment = "Preserve /api/* paths for API Gateway"
  publish = true

  code = <<-EOT
function handler(event) {
    var request = event.request;
    // Pass through the request without modifying the URI
    // This preserves the /api/* path structure
    return request;
}
EOT
}

# CloudFront function for additional security headers
resource "aws_cloudfront_function" "security_headers" {
  count   = var.enable_security_headers ? 1 : 0
  name    = "${var.environment}-security-headers"
  runtime = "cloudfront-js-1.0"
  comment = "Add security headers to responses"
  publish = true

  code = <<-EOT
function handler(event) {
    var response = event.response;
    var headers = response.headers;

    // Add security headers
    headers['x-frame-options'] = { value: 'DENY' };
    headers['x-content-type-options'] = { value: 'nosniff' };
    headers['x-xss-protection'] = { value: '1; mode=block' };
    headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };
    
    // Add HSTS header
    headers['strict-transport-security'] = { 
        value: 'max-age=31536000; includeSubDomains' 
    };

    return response;
}
EOT
}

# CloudWatch alarms for CloudFront (Free Tier monitoring)
resource "aws_cloudwatch_metric_alarm" "cloudfront_requests" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-cloudfront-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Requests"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.request_threshold
  alarm_description   = "CloudFront requests approaching Free Tier limit"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_data_transfer" {
  count = var.enable_free_tier_monitoring ? 1 : 0

  alarm_name          = "${var.environment}-cloudfront-data-transfer"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BytesDownloaded"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.data_transfer_threshold
  alarm_description   = "CloudFront data transfer approaching Free Tier limit"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_error_rate" {
  alarm_name          = "${var.environment}-cloudfront-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"  # 5% error rate
  alarm_description   = "CloudFront 4xx error rate is high"
  alarm_actions       = var.alarm_topic_arn != "" ? [var.alarm_topic_arn] : []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend.id
  }

  tags = var.tags
}