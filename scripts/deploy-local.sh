#!/bin/bash

# Exit on error
set -e

echo "🚀 Deploying to LocalStack..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required commands
if ! command_exists awslocal; then
    echo "❌ awslocal command not found. Installing..."
    pip install awscli-local
fi

# Create Lambda function
echo "📦 Creating Lambda function..."
awslocal lambda create-function \
    --function-name hello-world \
    --runtime nodejs18.x \
    --handler index.handler \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --zip-file fileb://hello.zip \
    --region us-west-2 \
    2>/dev/null || \
awslocal lambda update-function-code \
    --function-name hello-world \
    --zip-file fileb://hello.zip \
    --region us-west-2

# Create REST API
echo "🌐 Creating API Gateway..."
API_ID=$(awslocal apigateway create-rest-api \
    --name "HelloWorldAPI" \
    --region us-west-2 \
    --query 'id' \
    --output text \
    2>/dev/null || \
    awslocal apigateway get-rest-apis \
    --query 'items[?name==`HelloWorldAPI`].id' \
    --output text)

# Get root resource ID
ROOT_RESOURCE_ID=$(awslocal apigateway get-resources \
    --rest-api-id $API_ID \
    --query 'items[?path==`/`].id' \
    --output text)

# Create resource
RESOURCE_ID=$(awslocal apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "hello" \
    --query 'id' \
    --output text \
    2>/dev/null || \
    awslocal apigateway get-resources \
    --rest-api-id $API_ID \
    --query 'items[?path==`/hello`].id' \
    --output text)

# Set up CORS
echo "🔒 Setting up CORS..."
awslocal apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    2>/dev/null || true

awslocal apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    2>/dev/null || true

awslocal apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{
        \"method.response.header.Access-Control-Allow-Headers\": true,
        \"method.response.header.Access-Control-Allow-Methods\": true,
        \"method.response.header.Access-Control-Allow-Origin\": true
    }" \
    2>/dev/null || true

awslocal apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{
        \"method.response.header.Access-Control-Allow-Headers\": \"'Content-Type,Authorization,X-Amz-Date,X-Api-Key'\"
        \"method.response.header.Access-Control-Allow-Methods\": \"'GET,POST,PUT,DELETE,OPTIONS'\",
        \"method.response.header.Access-Control-Allow-Origin\": \"'*'\"
    }" \
    2>/dev/null || true

# Set up GET method
echo "📡 Setting up GET method..."
awslocal apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method GET \
    --authorization-type NONE \
    2>/dev/null || true

# Set up Lambda integration
echo "🔗 Setting up Lambda integration..."
awslocal apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:000000000000:function:hello-world/invocations \
    2>/dev/null || true

# Deploy API
echo "🚀 Deploying API..."
DEPLOYMENT_ID=$(awslocal apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name local \
    --query 'id' \
    --output text)

echo "✅ Deployment complete!"
echo "
📝 API Details:
- API ID: $API_ID
- Deployment ID: $DEPLOYMENT_ID
- Endpoint: http://localhost:4566/restapis/$API_ID/local/_user_request_/hello
"
