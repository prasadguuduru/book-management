# CloudWatch Module Changelog

## [Fixed] - Log Group Dependencies

### Problem
CloudWatch metric filters were failing during Terraform deployment with the error:
```
ResourceNotFoundException: The specified log group does not exist.
```

This occurred because metric filters were being created before the Lambda log groups existed.

### Solution
- **Removed duplicate log group creation**: CloudWatch module no longer creates Lambda log groups
- **Added data source references**: Uses `data.aws_cloudwatch_log_group` to reference existing Lambda log groups
- **Proper dependency management**: Metric filters now depend on existing log groups via data sources
- **Coordinated with Lambda module**: Lambda module creates log groups, CloudWatch module references them

### Changes Made
1. **Replaced resource with data source**:
   ```hcl
   # Before (causing conflicts)
   resource "aws_cloudwatch_log_group" "lambda_logs" {
     for_each = var.lambda_functions
     name     = "/aws/lambda/${each.value.function_name}"
   }

   # After (references existing)
   data "aws_cloudwatch_log_group" "lambda_logs" {
     for_each = var.lambda_functions
     name     = "/aws/lambda/${each.value.function_name}"
   }
   ```

2. **Updated metric filter references**:
   ```hcl
   # Before
   log_group_name = aws_cloudwatch_log_group.lambda_logs["auth-service"].name

   # After  
   log_group_name = data.aws_cloudwatch_log_group.lambda_logs["auth-service"].name
   ```

3. **Fixed CloudWatch Insights queries**: Now reference data sources instead of resources

4. **Updated outputs**: Lambda log group information now comes from data sources

### Benefits
- ✅ Eliminates "log group does not exist" errors
- ✅ Prevents resource conflicts between modules
- ✅ Maintains proper dependency ordering
- ✅ Preserves all monitoring functionality
- ✅ Follows Terraform best practices for module coordination

### Deployment Impact
- **No breaking changes**: All existing functionality preserved
- **Requires Lambda module first**: Lambda functions must be deployed before CloudWatch monitoring
- **Automatic dependency resolution**: Terraform will handle proper creation order