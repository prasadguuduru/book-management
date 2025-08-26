#!/bin/bash

# Seed data with correct table name from Terraform
set -e

echo "🌱 Getting table name from Terraform and seeding data..."

# Set LocalStack environment
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Get the actual table name from Terraform
cd infrastructure
TABLE_NAME=$(terraform output -raw dynamodb_table_name)
cd ..

echo "Using table name: $TABLE_NAME"

# Export for the seed script
export DYNAMODB_TABLE_NAME="$TABLE_NAME"

# Run the seed script
node scripts/seed-mock-data.js