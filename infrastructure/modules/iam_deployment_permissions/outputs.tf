# Outputs for IAM Deployment Permissions Module

output "cloudfront_policy_arn" {
  description = "ARN of the CloudFront deployment policy"
  value       = aws_iam_policy.cloudfront_deployment.arn
}

output "cloudfront_policy_name" {
  description = "Name of the CloudFront deployment policy"
  value       = aws_iam_policy.cloudfront_deployment.name
}

output "iam_policy_arn" {
  description = "ARN of the IAM deployment policy"
  value       = aws_iam_policy.iam_deployment.arn
}

output "iam_policy_name" {
  description = "Name of the IAM deployment policy"
  value       = aws_iam_policy.iam_deployment.name
}

output "sqs_policy_arn" {
  description = "ARN of the SQS deployment policy"
  value       = aws_iam_policy.sqs_deployment.arn
}

output "sqs_policy_name" {
  description = "Name of the SQS deployment policy"
  value       = aws_iam_policy.sqs_deployment.name
}

output "cloudwatch_policy_arn" {
  description = "ARN of the CloudWatch deployment policy"
  value       = aws_iam_policy.cloudwatch_deployment.arn
}

output "cloudwatch_policy_name" {
  description = "Name of the CloudWatch deployment policy"
  value       = aws_iam_policy.cloudwatch_deployment.name
}

output "sns_policy_arn" {
  description = "ARN of the SNS deployment policy"
  value       = aws_iam_policy.sns_deployment.arn
}

output "sns_policy_name" {
  description = "Name of the SNS deployment policy"
  value       = aws_iam_policy.sns_deployment.name
}

output "consolidated_policy_arn" {
  description = "ARN of the consolidated deployment policy (if created)"
  value       = var.create_consolidated_policy ? aws_iam_policy.consolidated_deployment[0].arn : null
}

output "consolidated_policy_name" {
  description = "Name of the consolidated deployment policy (if created)"
  value       = var.create_consolidated_policy ? aws_iam_policy.consolidated_deployment[0].name : null
}

output "all_policy_arns" {
  description = "List of all created policy ARNs"
  value = compact([
    aws_iam_policy.cloudfront_deployment.arn,
    aws_iam_policy.iam_deployment.arn,
    aws_iam_policy.sqs_deployment.arn,
    aws_iam_policy.cloudwatch_deployment.arn,
    aws_iam_policy.sns_deployment.arn,
    var.create_consolidated_policy ? aws_iam_policy.consolidated_deployment[0].arn : null
  ])
}

output "policy_attachment_status" {
  description = "Status of policy attachments to deployment user"
  value = {
    user_name                    = var.deployment_user_name
    individual_policies_attached = var.attach_individual_policies && var.deployment_user_name != ""
    consolidated_policy_attached = var.create_consolidated_policy && !var.attach_individual_policies && var.deployment_user_name != ""
    total_policies_attached      = var.deployment_user_name != "" ? (var.attach_individual_policies ? 5 : (var.create_consolidated_policy ? 1 : 0)) : 0
  }
}

output "deployment_readiness" {
  description = "Deployment readiness information"
  value = {
    policies_created = true
    user_configured  = var.deployment_user_name != ""
    ready_for_deployment = var.deployment_user_name != "" && (var.attach_individual_policies || var.create_consolidated_policy)
    next_steps = var.deployment_user_name == "" ? [
      "Set deployment_user_name variable to attach policies to a user",
      "Run terraform apply to create and attach policies"
    ] : [
      "Policies are attached to user: ${var.deployment_user_name}",
      "Ready for infrastructure deployment"
    ]
  }
}