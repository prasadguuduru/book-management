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

    # Caching configuration optimized for SPA
    cache_policy_id = aws_cloudfront_cache_policy.spa_cache.id

    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id

    # Function associations for security headers
    dynamic "function_association" {
      for_each = var.enable_security_headers ? [1] : []
      content {
        event_type   = "viewer-response"
        function_arn = aws_cloudfront_function.security_headers[0].arn
      }
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

    # Long-term caching for static assets
    cache_policy_id = aws_cloudfront_cache_policy.static_assets.id
  }

  # Cache behavior for API calls (no caching)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "API-Gateway"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # No caching for API calls
    cache_policy_id = aws_cloudfront_cache_policy.api_no_cache.id

    # Forward headers for API authentication
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api_headers.id
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

# Cache policy for SPA (HTML files)
resource "aws_cloudfront_cache_policy" "spa_cache" {
  name        = "${var.environment}-spa-cache-policy"
  comment     = "Cache policy for SPA HTML files"
  default_ttl = 300    # 5 minutes
  max_ttl     = 86400  # 24 hours
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# Cache policy for static assets (long-term caching)
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "${var.environment}-static-assets-cache-policy"
  comment     = "Cache policy for static assets"
  default_ttl = 86400   # 24 hours
  max_ttl     = 31536000 # 1 year
  min_ttl     = 86400   # 24 hours

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# Cache policy for API calls (no caching)
resource "aws_cloudfront_cache_policy" "api_no_cache" {
  name        = "${var.environment}-api-no-cache-policy"
  comment     = "No cache policy for API calls"
  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = false
    enable_accept_encoding_gzip   = false

    query_strings_config {
      query_string_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# Origin request policy for API calls
resource "aws_cloudfront_origin_request_policy" "api_headers" {
  name    = "${var.environment}-api-headers-policy"
  comment = "Origin request policy for API calls"

  query_strings_config {
    query_string_behavior = "all"
  }

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "Content-Type",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Referer",
        "User-Agent",
        "X-Forwarded-For",
        "CloudFront-Viewer-Country"
      ]
    }
  }

  cookies_config {
    cookie_behavior = "all"
  }
}

# Response headers policy for security
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.environment}-security-headers-policy"
  comment = "Security headers policy"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  custom_headers_config {
    items {
      header   = "X-Content-Security-Policy"
      value    = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
      override = true
    }
  }
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