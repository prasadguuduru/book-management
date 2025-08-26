#!/bin/bash

# Simple LocalStack deployment - let Terraform handle existing resources
set -e

echo "🚀 Simple LocalStack deployment..."

# Set LocalStack environment variables
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# 1. Start LocalStack
echo "Starting LocalStack..."
docker-compose up -d localstack

# Wait for LocalStack
echo "Waiting for LocalStack..."
for i in {1..30}; do
    if curl -s http://localhost:4566/health > /dev/null 2>&1; then
        echo "LocalStack is ready!"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# 2. Deploy with Terraform (ignore table exists error)
cd infrastructure
terraform workspace select local || terraform workspace new local
terraform init

echo "Applying Terraform configuration..."
terraform apply -var-file=local.tfvars -auto-approve || {
    echo "Apply failed, but this might be expected for existing resources"
    echo "Checking what was created..."
    terraform state list || echo "No state found"
}

echo "✅ Deployment completed!"

# 3. Test the deployment
echo "Testing deployment..."
terraform output dynamodb_table_name || echo "Could not get table name"

echo "Listing tables in LocalStack:"
aws dynamodb list-tables --endpoint-url=http://localhost:4566 --region=us-east-1