# IAM Deployment Permissions Module
# Provides comprehensive permissions for Terraform deployment user

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudFront permissions policy
resource "aws_iam_policy" "cloudfront_deployment" {
  name        = "${var.environment}-cloudfront-deployment-policy"
  description = "CloudFront permissions for infrastructure deployment"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateCachePolicy",
          "cloudfront:CreateOriginRequestPolicy",
          "cloudfront:CreateResponseHeadersPolicy",
          "cloudfront:GetCachePolicy",
          "cloudfront:GetOriginRequestPolicy", 
          "cloudfront:GetResponseHeadersPolicy",
          "cloudfront:UpdateCachePolicy",
          "cloudfront:UpdateOriginRequestPolicy",
          "cloudfront:UpdateResponseHeadersPolicy",
          "cloudfront:DeleteCachePolicy",
          "cloudfront:DeleteOriginRequestPolicy",
          "cloudfront:DeleteResponseHeadersPolicy",
          "cloudfront:ListCachePolicies",
          "cloudfront:ListOriginRequestPolicies",
          "cloudfront:ListResponseHeadersPolicies",
          "cloudfront:CreateDistribution",
          "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig",
          "cloudfront:UpdateDistribution",
          "cloudfront:DeleteDistribution",
          "cloudfront:ListDistributions",
          "cloudfront:TagResource",
          "cloudfront:UntagResource",
          "cloudfront:ListTagsForResource"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.environment}-cloudfront-deployment-policy"
    Component   = "iam-deployment-permissions"
    Service     = "cloudfront"
  })
}

# IAM management permissions policy
resource "aws_iam_policy" "iam_deployment" {
  name        = "${var.environment}-iam-deployment-policy"
  description = "IAM permissions for infrastructure deployment"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "iam:CreatePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicyVersions",
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:DeletePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:CreateRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:DeleteRole",
          "iam:ListRoles",
          "iam:PassRole",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:ListRoleTags"
        ]
        Resource = [
          "arn:aws:iam::*:policy/${var.environment}-*",
          "arn:aws:iam::*:role/${var.environment}-*"
        ]
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.environment}-iam-deployment-policy"
    Component   = "iam-deployment-permissions"
    Service     = "iam"
  })
}

# SQS management permissions policy
resource "aws_iam_policy" "sqs_deployment" {
  name        = "${var.environment}-sqs-deployment-policy"
  description = "SQS permissions for infrastructure deployment"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:CreateQueue",
          "sqs:DeleteQueue",
          "sqs:GetQueueAttributes",
          "sqs:SetQueueAttributes",
          "sqs:ListQueues",
          "sqs:TagQueue",
          "sqs:UntagQueue",
          "sqs:ListQueueTags",
          "sqs:AddPermission",
          "sqs:RemovePermission"
        ]
        Resource = [
          "arn:aws:sqs:*:*:${var.environment}-*"
        ]
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.environment}-sqs-deployment-policy"
    Component   = "iam-deployment-permissions"
    Service     = "sqs"
  })
}

# CloudWatch enhanced permissions policy
resource "aws_iam_policy" "cloudwatch_deployment" {
  name        = "${var.environment}-cloudwatch-deployment-policy"
  description = "CloudWatch permissions for infrastructure deployment"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:PutRetentionPolicy",
          "logs:DeleteRetentionPolicy",
          "logs:PutMetricFilter",
          "logs:DescribeMetricFilters",
          "logs:DeleteMetricFilter",
          "logs:TagLogGroup",
          "logs:UntagLogGroup",
          "logs:ListTagsLogGroup",
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:DeleteAlarms",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:PutDashboard",
          "cloudwatch:GetDashboard",
          "cloudwatch:DeleteDashboards",
          "cloudwatch:ListDashboards",
          "cloudwatch:TagResource",
          "cloudwatch:UntagResource",
          "cloudwatch:ListTagsForResource"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.environment}-cloudwatch-deployment-policy"
    Component   = "iam-deployment-permissions"
    Service     = "cloudwatch"
  })
}

# SNS management permissions policy
resource "aws_iam_policy" "sns_deployment" {
  name        = "${var.environment}-sns-deployment-policy"
  description = "SNS permissions for infrastructure deployment"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:CreateTopic",
          "sns:DeleteTopic",
          "sns:GetTopicAttributes",
          "sns:SetTopicAttributes",
          "sns:ListTopics",
          "sns:TagResource",
          "sns:UntagResource",
          "sns:ListTagsForResource",
          "sns:Subscribe",
          "sns:Unsubscribe",
          "sns:ListSubscriptions",
          "sns:ListSubscriptionsByTopic"
        ]
        Resource = [
          "arn:aws:sns:*:*:${var.environment}-*"
        ]
      }
    ]
  })

  tags = merge(var.tags, {
    Name        = "${var.environment}-sns-deployment-policy"
    Component   = "iam-deployment-permissions"
    Service     = "sns"
  })
}

# Consolidated deployment policy combining all service permissions
resource "aws_iam_policy" "consolidated_deployment" {
  count = var.create_consolidated_policy ? 1 : 0
  
  name        = "${var.environment}-consolidated-deployment-policy"
  description = "Consolidated deployment permissions for all AWS services"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      jsondecode(aws_iam_policy.cloudfront_deployment.policy).Statement,
      jsondecode(aws_iam_policy.iam_deployment.policy).Statement,
      jsondecode(aws_iam_policy.sqs_deployment.policy).Statement,
      jsondecode(aws_iam_policy.cloudwatch_deployment.policy).Statement,
      jsondecode(aws_iam_policy.sns_deployment.policy).Statement
    )
  })

  tags = merge(var.tags, {
    Name        = "${var.environment}-consolidated-deployment-policy"
    Component   = "iam-deployment-permissions"
    Service     = "consolidated"
  })
}

# Policy attachments for deployment user
resource "aws_iam_user_policy_attachment" "cloudfront_deployment" {
  count = var.deployment_user_name != "" && var.attach_individual_policies ? 1 : 0
  
  user       = var.deployment_user_name
  policy_arn = aws_iam_policy.cloudfront_deployment.arn
}

resource "aws_iam_user_policy_attachment" "iam_deployment" {
  count = var.deployment_user_name != "" && var.attach_individual_policies ? 1 : 0
  
  user       = var.deployment_user_name
  policy_arn = aws_iam_policy.iam_deployment.arn
}

resource "aws_iam_user_policy_attachment" "sqs_deployment" {
  count = var.deployment_user_name != "" && var.attach_individual_policies ? 1 : 0
  
  user       = var.deployment_user_name
  policy_arn = aws_iam_policy.sqs_deployment.arn
}

resource "aws_iam_user_policy_attachment" "cloudwatch_deployment" {
  count = var.deployment_user_name != "" && var.attach_individual_policies ? 1 : 0
  
  user       = var.deployment_user_name
  policy_arn = aws_iam_policy.cloudwatch_deployment.arn
}

resource "aws_iam_user_policy_attachment" "sns_deployment" {
  count = var.deployment_user_name != "" && var.attach_individual_policies ? 1 : 0
  
  user       = var.deployment_user_name
  policy_arn = aws_iam_policy.sns_deployment.arn
}

resource "aws_iam_user_policy_attachment" "consolidated_deployment" {
  count = var.deployment_user_name != "" && var.create_consolidated_policy && !var.attach_individual_policies ? 1 : 0
  
  user       = var.deployment_user_name
  policy_arn = aws_iam_policy.consolidated_deployment[0].arn
}