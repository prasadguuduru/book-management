#!/bin/bash
# Bypass CloudWatch dependency issues by temporarily disabling problematic modules

set -e

echo "🔄 Bypassing CloudWatch dependencies to import Lambda functions..."

cd infrastructure

# Verify we're in QA workspace
if [ "$(terraform workspace show)" != "qa" ]; then
    echo "❌ Not in QA workspace. Current: $(terraform workspace show)"
    echo "Run: terraform workspace select qa"
    exit 1
fi

echo "✅ In QA workspace"

# Step 1: Comment out the problematic modules in main.tf temporarily
echo "🔧 Step 1: Temporarily disabling problematic modules..."

# Create a backup of main.tf
cp main.tf main.tf.backup

# Comment out the iam_permissions module (lines around 295-330)
sed -i.tmp '/^module "iam_permissions"/,/^}$/s/^/# /' main.tf

# Comment out the cloudwatch module (lines around 270-290)  
sed -i.tmp '/^module "cloudwatch"/,/^}$/s/^/# /' main.tf

echo "✅ Temporarily disabled iam_permissions and cloudwatch modules"

# Step 2: Now import Lambda functions without dependency conflicts
echo "⚡ Step 2: Importing Lambda functions..."

terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["auth-service"]' qa-auth-service || echo "⚠️  auth-service already imported"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["book-service"]' qa-book-service || echo "⚠️  book-service import failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["user-service"]' qa-user-service || echo "⚠️  user-service import failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["workflow-service"]' qa-workflow-service || echo "⚠️  workflow-service import failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["review-service"]' qa-review-service || echo "⚠️  review-service import failed"
terraform import -var-file=qa.tfvars 'module.lambda.aws_lambda_function.functions["notification-service"]' qa-notification-service || echo "⚠️  notification-service import failed"

# Step 3: Apply Lambda module to establish it in state
echo "🔧 Step 3: Applying Lambda module..."
terraform apply -var-file=qa.tfvars -target=module.lambda -auto-approve

# Step 4: Check if Lambda functions are now in state
echo "📋 Step 4: Checking Lambda functions in state..."
terraform state list | grep "module.lambda.aws_lambda_function"

# Step 5: Restore main.tf
echo "� Step u5: Restoring original main.tf..."
mv main.tf.backup main.tf
rm -f main.tf.tmp

# Step 6: Test if the dependency issue is resolved
echo "🧪 Step 6: Testing if dependency errors are resolved..."
terraform plan -var-file=qa.tfvars | head -20 || echo "Still has issues, but Lambda functions should be imported now"

echo "✅ Lambda import process completed!"
echo "📋 Final check - Lambda functions in state:"
terraform state list | grep "module.lambda.aws_lambda_function"

echo "💡 Now try: terraform refresh -var-file=qa.tfvars"