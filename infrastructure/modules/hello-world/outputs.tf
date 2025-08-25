output "api_url" {
  description = "Base URL of the API Gateway stage"
  value       = "${aws_api_gateway_stage.hello.invoke_url}/hello"
}

output "lambda_function_name" {
  description = "Name of the created Lambda function"
  value       = aws_lambda_function.hello_world.function_name
}

output "api_gateway_id" {
  description = "ID of the created API Gateway"
  value       = aws_api_gateway_rest_api.hello_api.id
}
