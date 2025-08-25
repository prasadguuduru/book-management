#!/bin/bash

# Create Lambda function
echo "Creating Lambda function..."
awslocal lambda create-function \
  --function-name hello-world \
  --runtime nodejs18.x \
  --handler index.handler \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --zip-file fileb://../backend/dist/hello.zip

# Create API Gateway
echo "Creating API Gateway..."
awslocal apigateway create-rest-api \
  --name 'HelloWorld API' \
  --description 'Hello World API'

# Get API ID
API_ID=$(awslocal apigateway get-rest-apis --query 'items[?name==`HelloWorld API`].id' --output text)

# Get root resource ID
ROOT_RESOURCE_ID=$(awslocal apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)

# Create resource
echo "Creating API resource..."
RESOURCE_ID=$(awslocal apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_RESOURCE_ID \
  --path-part 'hello' \
  --query 'id' --output text)

# Create method
echo "Creating API method..."
awslocal apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method GET \
  --authorization-type NONE \
  --no-api-key-required

# Create integration
echo "Creating Lambda integration..."
awslocal apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:000000000000:function:hello-world/invocations

# Enable CORS
echo "Enabling CORS..."
awslocal apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method GET \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false"

# Deploy API
echo "Deploying API..."
awslocal apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name local

echo "Setup complete!"
echo "API Endpoint: http://localhost:4566/restapis/$API_ID/local/_user_request_/hello"
