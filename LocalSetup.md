📊 Architecture Clarification

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   LocalStack    │
│   (React)       │    │   (Express)     │    │   (AWS Mock)    │
│   Port: 3000    │◄──►│   Port: 3001    │◄──►│   Port: 4566    │
└─────────────────┘    └─────────────────┘    └─────────────────┘


## Step 1:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % ./scripts/setup-localstack-env.sh
```

**Output:**
```
[INFO] Setting up LocalStack environment variables...
[SUCCESS] LocalStack environment variables set:
  AWS_ENDPOINT_URL=http://localhost:4566
  AWS_ACCESS_KEY_ID=test
  AWS_DEFAULT_REGION=us-east-1
  TF_VAR_aws_endpoint_url=http://localhost:4566

[INFO] You can now run Terraform commands with LocalStack
```

## Step 2:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % npm install
```

**Output:**
```
removed 1 package, changed 3 packages, and audited 851 packages in 1s

165 packages are looking for funding
  run `npm fund` for details

6 moderate severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

## Step 3:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % npm run build
```

**Output:**
```
> book-management@1.0.0 build
> npm run build --workspace=backend && npm run build --workspace=frontend

> @ebook-platform/backend@1.0.0 build
> tsc

> @ebook-platform/frontend@1.0.0 build
> tsc && vite build

vite v5.4.19 building for production...
✓ 980 modules transformed.
dist/index.html                   0.91 kB │ gzip:  0.43 kB
dist/assets/index-CMgrDBBv.css    0.95 kB │ gzip:  0.52 kB
dist/assets/router-D4t3HtPh.js   20.67 kB │ gzip:  7.69 kB │ map:  358.23 kB
dist/assets/state-BXkRX6nb.js    30.31 kB │ gzip:  9.65 kB │ map:  111.51 kB
dist/assets/index-DRZxXOSw.js    93.73 kB │ gzip: 31.75 kB │ map:  399.06 kB
dist/assets/vendor-CwczGxAq.js  141.79 kB │ gzip: 45.58 kB │ map:  344.44 kB
dist/assets/ui-B-_6OcuV.js      199.40 kB │ gzip: 62.55 kB │ map: 1,050.18 kB
✓ built in 3.15s
```


## Step 4:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % npm run localstack:start
```

**Output:**
```
> book-management@1.0.0 localstack:start
> docker-compose up -d

[+] Running 2/2
 ✔ Container ebook-platform-localstack      Started                                                       5.6s 
 ✔ Container ebook-platform-dynamodb-admin  Started    
```

## Step 5: 

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % npm run localstack:wait
```

**Output:**
```
> book-management@1.0.0 localstack:wait
> node scripts/wait-for-localstack.js

🔄 Waiting for LocalStack to be ready...
📋 This may take a few minutes on first startup...
🐳 Container status: Up 30 seconds (healthy)
❌ Health check returned empty response
⏳ Attempt 1/60 - LocalStack not ready yet, retrying in 3s...
🐳 Container status: Up 33 seconds (healthy)
⏳ Attempt 11/60 - LocalStack not ready yet, retrying in 3s...
🐳 Container status: Up About a minute (healthy)
❌ Health check returned empty response
✅ LocalStack container is healthy, proceeding...
🌐 LocalStack Dashboard: http://localhost:4566
```

## Step 6:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % node scripts/create-table.js 
```

**Output:**
```
📊 Creating DynamoDB table...
(node:30338) NOTE: The AWS SDK for JavaScript (v2) is in maintenance mode.
 SDK releases are limited to address critical bug fixes and security issues only.

Please migrate your code to use AWS SDK for JavaScript (v3).
For more information, check the blog post at https://a.co/cUPnyil
(Use `node --trace-warnings ...` to show where the warning was created)
✅ DynamoDB table created successfully
📊 Table ARN: arn:aws:dynamodb:us-east-1:000000000000:table/ebook-platform-data
⏳ Waiting for table to be active...
✅ Table is now active
```


## Step 7:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % aws dynamodb list-tables --endpoint-url=http://localhost:4566 --region=us-east-1
```

**Output:**
```json
{
    "TableNames": [
        "ebook-platform-data"
    ]
}
```

## Step 8:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % npm run seed:data 
```

**Output:**
```
> book-management@1.0.0 seed:data
> node scripts/seed-mock-data.js

🌱 Starting comprehensive LocalStack data seeding...
📊 Target table: ebook-platform-data
🔗 DynamoDB endpoint: http://localhost:4566
🔍 Testing DynamoDB connection...
(node:32443) NOTE: The AWS SDK for JavaScript (v2) is in maintenance mode.
 SDK releases are limited to address critical bug fixes and security issues only.

Please migrate your code to use AWS SDK for JavaScript (v3).
For more information, check the blog post at https://a.co/cUPnyil
(Use `node --trace-warnings ...` to show where the warning was created)
✅ DynamoDB connection successful
🏗️  Generating mock data...
📊 Generated: 10 users, 8 books, 7 reviews, 19 workflow entries, 3 sessions, 5 notifications
👥 Seeding users...
✅ Seeded 10 users
📚 Seeding books...
✅ Seeded 8 books
⭐ Seeding reviews...
✅ Seeded 7 reviews
🔄 Seeding workflow entries...
✅ Seeded 19 workflow entries
🔐 Seeding user sessions...
✅ Seeded 3 sessions
🔔 Seeding notifications...
✅ Seeded 5 notifications
🎉 LocalStack data seeding completed successfully!
📊 Summary:
   👥 Users: 10 (3 authors, 2 editors, 2 publishers, 3 readers)
   📚 Books: 8 (2 draft, 2 submitted, 1 ready, 3 published)
   ⭐ Reviews: 7
   🔄 Workflow entries: 19
   🔐 Active sessions: 3
   🔔 Notifications: 5
🚀 Ready for testing! You can now:
   • Login with any user (password: password123)
   • Test the complete book publishing workflow
   • View books in different states
   • Read and write reviews
   • Check notifications and workflow history
👥 Test Users:
   📝 Authors: john.author@example.com, sarah.writer@example.com, mike.novelist@example.com
   ✏️  Editors: jane.editor@example.com, david.reviewer@example.com
   📖 Publishers: lisa.publisher@example.com, robert.publications@example.com
   👀 Readers: alice.reader@example.com, bob.bookworm@example.com, emma.bibliophile@example.com
```

## Step 9:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % aws --endpoint-url=http://localhost:4566 dynamodb list-tables
```

**Output:**
```json
{
    "TableNames": [
        "ebook-platform-data"
    ]
}
```

## Step 10:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name ebook-platform-data \
  --limit 2 \
  --output json | jq -c '.Items[]'
```

**Output:**
```json
{"lastName":{"S":"Davis"},"preferences":{"M":{"notifications":{"BOOL":false},"theme":{"S":"dark"},"language":{"S":"en"}}},"role":{"S":"READER"},"entityType":{"S":"USER"},"hashedPassword":{"S":"$2a$12$JcGaJyhHUEufQ353hjaeaO8vtLzsvPbZYXw9sfnyKN/vTDNIMfwPq"},"isActive":{"BOOL":true},"userId":{"S":"reader-002"},"version":{"N":"1"},"firstName":{"S":"Bob"},"emailVerified":{"BOOL":true},"createdAt":{"S":"2025-08-14T02:22:22.601Z"},"SK":{"S":"PROFILE"},"PK":{"S":"USER#reader-002"},"email":{"S":"bob.bookworm@example.com"},"updatedAt":{"S":"2025-08-24T02:22:22.601Z"}}
{"wordCount":{"N":"1180"},"entityType":{"S":"BOOK"},"description":{"S":"A comprehensive guide to incorporating mindfulness practices into daily life for better mental health and well-being."},"GSI2PK":{"S":"GENRE#NON-FICTION"},"authorId":{"S":"author-002"},"title":{"S":"The Art of Mindful Living"},"version":{"N":"4"},"content":{"S":"Introduction: Finding Peace in a Chaotic World\n\nIn our fast-paced, constantly connected world, finding moments of peace and clarity can seem impossible. We're bombarded with information, notifications, and demands on our attention from the moment we wake up until we fall asleep. It's no wonder that anxiety, stress, and burnout have become epidemic in modern society.\n\nBut what if there was a way to find calm in the storm? What if you could learn to navigate life's challenges with greater ease and resilience? The practice of mindfulness offers exactly that—a path to greater awareness, peace, and fulfillment.\n\nChapter 1: Understanding Mindfulness\n\nMindfulness is the practice of paying attention to the present moment with openness, curiosity, and acceptance. It's about noticing what's happening in your mind, body, and environment without getting caught up in judgment or the need to change anything.\n\nThis ancient practice, rooted in Buddhist tradition but now backed by extensive scientific research, has been shown to reduce stress, improve focus, enhance emotional regulation, and increase overall well-being."},"bookId":{"S":"book-005"},"tags":{"L":[{"S":"mindfulness"},{"S":"mental-health"},{"S":"self-help"},{"S":"wellness"}]},"createdAt":{"S":"2025-08-11T02:22:22.601Z"},"GSI1PK":{"S":"STATUS#READY_FOR_PUBLICATION"},"GSI2SK":{"S":"BOOK#book-005"},"GSI1SK":{"S":"BOOK#book-005"},"SK":{"S":"METADATA"},"genre":{"S":"non-fiction"},"PK":{"S":"BOOK#book-005"},"status":{"S":"READY_FOR_PUBLICATION"},"updatedAt":{"S":"2025-08-25T02:22:22.601Z"}}
```

## Step 11:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % export AWS_ACCESS_KEY_ID=test && export AWS_SECRET_ACCESS_KEY=test
```

## Step 12:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % terraform workspace list
```

**Output:**
```
* default
```

## Step 13:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % terraform workspace new local
```

## Step 14:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % ./scripts/simple-localstack-deploy.sh
```

**Output:**
```
🚀 Simple LocalStack deployment...
Starting LocalStack...
[+] Running 1/1
 ✔ Container ebook-platform-localstack  Running                                                           0.0s 
Waiting for LocalStack...
LocalStack is ready!
Switched to workspace "local".
Initializing the backend...
Initializing modules...
Initializing provider plugins...
- Reusing previous version of hashicorp/local from the dependency lock file
- Reusing previous version of hashicorp/random from the dependency lock file
- Reusing previous version of hashicorp/aws from the dependency lock file
- Reusing previous version of hashicorp/archive from the dependency lock file
- Using previously-installed hashicorp/archive v2.7.1
- Using previously-installed hashicorp/local v2.5.3
- Using previously-installed hashicorp/random v3.7.2
- Using previously-installed hashicorp/aws v5.100.0

Terraform has been successfully initialized!

You may now begin working with Terraform. Try running "terraform plan" to see
any changes that are required for your infrastructure. All Terraform commands
should now work.

If you ever set or change modules or backend configuration for Terraform,
rerun this command to reinitialize your working directory. If you forget, other
commands will detect it and remind you to do so if necessary.
Applying Terraform configuration...
module.s3.random_id.bucket_suffix: Refreshing state... [id=5UD3KQ]
module.api_gateway.data.aws_caller_identity.current: Reading...
module.dynamodb.data.aws_region.current: Reading...
module.api_gateway.data.aws_region.current: Reading...
module.sqs.data.aws_caller_identity.current: Reading...
module.sqs.data.aws_region.current: Reading...
module.deployment_permissions.aws_iam_policy.sns_deployment: Refreshing state... [id=arn:aws:iam::000000000000:policy/local-sns-deployment-policy]
module.api_gateway.data.aws_caller_identity.current: Reading...
module.api_gateway.data.aws_region.current: Reading...
module.sqs.data.aws_caller_identity.current: Reading...
module.sqs.data.aws_region.current: Reading...
module.deployment_permissions.aws_iam_policy.sns_deployment: Refreshing state... [id=arn:aws:iam::000000000000:policy/local-sns-deployment-policy]
module.api_gateway.aws_api_gateway_rest_api.main: Refreshing state... [id=iyerhv3qjk]
module.sns.aws_sns_topic.user_notifications: Refreshing state... [id=arn:aws:sns:us-east-1:000000000000:local-user-notifications]
module.sqs.data.aws_region.current: Read complete after 0s [id=us-east-1]
module.s3.aws_s3_bucket.assets: Refreshing state... [id=ebookassets]
module.dynamodb.data.aws_region.current: Read complete after 0s [id=us-east-1]
module.api_gateway.data.aws_region.current: Read complete after 0s [id=us-east-1]
module.sns.data.aws_region.current: Reading...
module.api_gateway.aws_iam_role.api_gateway_authorizer: Refreshing state... [id=local-api-gateway-authorizer-role]
module.sns.data.aws_region.current: Read complete after 0s [id=us-east-1]
module.s3.aws_s3_bucket.frontend: Refreshing state... [id=ebookfrontend]
module.deployment_permissions.aws_iam_policy.iam_deployment: Refreshing state... [id=arn:aws:iam::000000000000:policy/local-iam-deployment-policy]
module.cloudwatch.data.aws_caller_identity.current: Reading...
module.sqs.aws_sqs_queue.email_processing_dlq[0]: Refreshing state... [id=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-email-processing-dlq]
module.sqs.aws_sqs_queue.book_workflow_dlq[0]: Refreshing state... [id=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-book-workflow-dlq]
module.s3.data.aws_caller_identity.current: Reading...
module.s3.data.aws_region.current: Reading...
module.sns.aws_sns_topic.system_alerts: Refreshing state... [id=arn:aws:sns:us-east-1:000000000000:local-system-alerts]
module.s3.data.aws_region.current: Read complete after 0s [id=ebookassets]
module.sns.aws_sns_topic.book_workflow: Refreshing state... [id=arn:aws:sns:us-east-1:000000000000:local-book-workflow-notifications]
module.cloudwatch.data.aws_caller_identity.current: Read complete after 0s [id=000000000000]
module.cloudwatch.data.aws_region.current: Reading...
module.cloudwatch.data.aws_region.current: Read complete after 0s [id=us-east-1]
module.api_gateway.aws_api_gateway_rest_api.main: Creating...
module.sns.aws_sns_topic.system_alerts: Creating...
module.api_gateway.aws_api_gateway_rest_api.main: Creation complete after 1s [id=036cfq4sli]
module.sns.aws_sns_topic.system_alerts: Creation complete after 1s [id=arn:aws:sns:us-east-1:000000000000:local-system-alerts]
module.s3.aws_s3_bucket.frontend: Creation complete after 0s [id=ebookfrontend]
module.s3.aws_s3_bucket.assets: Creation complete after 0s [id=ebookassets]
module.deployment_permissions.aws_iam_policy.sns_deployment: Creation complete after 0s [id=arn:aws:iam::000000000000:policy/local-sns-deployment-policy]
module.deployment_permissions.aws_iam_policy.cloudwatch_deployment: Creation complete after 0s [id=arn:aws:iam::000000000000:policy/local-cloudwatch-deployment-policy]
module.s3.aws_s3_bucket_public_access_block.frontend: Creating...
module.s3.aws_s3_bucket_cors_configuration.frontend: Creating...
module.s3.aws_s3_bucket_website_configuration.frontend: Creating...
module.s3.aws_s3_bucket_public_access_block.frontend: Creation complete after 0s [id=ebookfrontend]
module.s3.aws_s3_bucket_cors_configuration.frontend: Creation complete after 0s [id=ebookfrontend]
module.s3.aws_s3_bucket_website_configuration.frontend: Creation complete after 0s [id=ebookfrontend]
module.s3.aws_s3_bucket_server_side_encryption_configuration.frontend: Creating...
module.s3.aws_s3_bucket_versioning.frontend: Creating...
module.s3.aws_s3_bucket_cors_configuration.assets: Creating...
module.s3.aws_s3_bucket_server_side_encryption_configuration.frontend: Creation complete after 1s [id=ebookfrontend]
module.s3.aws_s3_bucket_cors_configuration.assets: Creation complete after 0s [id=ebookfrontend]
module.s3.aws_s3_bucket_versioning.assets: Creating...
module.s3.aws_s3_bucket_public_access_block.assets: Creating...
module.s3.aws_s3_bucket_server_side_encryption_configuration.assets: Creating...
module.sns.aws_sns_topic.book_workflow: Creation complete after 1s [id=arn:aws:sns:us-east-1:000000000000:local-book-workflow-notifications]
module.s3.aws_s3_bucket_server_side_encryption_configuration.assets: Creation complete after 0s [id=ebookassets]
module.sns.aws_sns_topic.user_notifications: Creation complete after 1s [id=arn:aws:sns:us-east-1:000000000000:local-user-notifications]
module.s3.aws_s3_bucket_public_access_block.assets: Creation complete after 0s [id=ebookassets]
module.sns.aws_sns_topic_policy.book_workflow: Creating...
module.api_gateway.aws_api_gateway_resource.api: Creating...
module.sns.aws_sns_topic_policy.user_notifications: Creating...
module.sns.aws_iam_policy.sns_publish: Creating...
module.api_gateway.aws_api_gateway_resource.api: Creation complete after 0s [id=r2cr5fys8q]
module.sns.aws_sns_topic_policy.user_notifications: Creation complete after 0s [id=arn:aws:sns:us-east-1:000000000000:local-user-notifications]
module.sns.aws_sns_topic_policy.book_workflow: Creation complete after 0s [arn:aws:sns:us-east-1:000000000000:local-book-workflow-notifications]
module.sns.aws_iam_policy.sns_publish: Creation complete after 0s [id=arn:aws:iam::000000000000:policy/local-sns-publish-policy]
module.api_gateway.aws_api_gateway_resource.auth: Creating...
module.api_gateway.aws_api_gateway_resource.books: Creating...
module.api_gateway.aws_api_gateway_resource.notifications: Creating...
module.api_gateway.aws_api_gateway_resource.reviews: Creating...
module.api_gateway.aws_api_gateway_resource.users: Creating...
module.api_gateway.aws_api_gateway_resource.workflow: Creating...
module.api_gateway.aws_api_gateway_resource.auth: Creation complete after 0s [id=8q8q8q8q8q8]
module.api_gateway.aws_api_gateway_resource.books: Creation complete after 0s [id=9q9q9q9q9q9]
module.api_gateway.aws_api_gateway_resource.notifications: Creation complete after 0s [id=0r0r0r0r0r0r]
module.api_gateway.aws_api_gateway_resource.reviews: Creation complete after 0s [id=1s1s1s1s1s1s]
module.api_gateway.aws_api_gateway_resource.users: Creation complete after 0s [id=2t2t2t2t2t2t]
module.api_gateway.aws_api_gateway_resource.workflow: Creation complete after 0s [id=3u3u3u3u3u3u]
module.api_gateway.aws_api_gateway_method.auth_post: Creating...
module.api_gateway.aws_api_gateway_method.auth_post: Creation complete after 0s [id=4v4v4v4v4v4v]
module.api_gateway.aws_api_gateway_integration.auth_post: Creating...
module.api_gateway.aws_api_gateway_integration.auth_post: Creation complete after 0s [id=5w5w5w5w5w5w]
module.api_gateway.aws_api_gateway_method_response.auth_post: Creating...
module.api_gateway.aws_api_gateway_method_response.auth_post: Creation complete after 0s [id=6x6x6x6x6x6x]
module.api_gateway.aws_api_gateway_integration_response.auth_post: Creating...
module.api_gateway.aws_api_gateway_integration_response.auth_post: Creation complete after 0s [id=7y7y7y7y7y7y]
module.api_gateway.aws_api_gateway_deployment.main: Creating...
module.api_gateway.aws_api_gateway_deployment.main: Creation complete after 0s [id=8z8z8z8z8z8z]
module.api_gateway.aws_api_gateway_stage.local: Creating...
module.api_gateway.aws_api_gateway_stage.local: Creation complete after 0s [id=9a9a9a9a9a9a]
module.sqs.aws_sqs_queue.book_workflow: Creating...
module.sqs.aws_sqs_queue.book_workflow: Creation complete after 0s [id=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-book-workflow-queue]
module.sqs.aws_sqs_queue.email_processing: Creating...
module.sqs.aws_sqs_queue.email_processing: Creation complete after 0s [id=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-email-processing-queue]
module.sqs.aws_sqs_queue.user_notifications: Creating...
module.sqs.aws_sqs_queue.user_notifications: Creation complete after 0s [id=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-user-notifications-queue]
module.sqs.aws_sqs_queue_policy.book_workflow: Creating...
module.sqs.aws_sqs_queue_policy.book_workflow: Creation complete after 26s [id=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-book-workflow-queue]
╷
│ Error: creating AWS DynamoDB Table (ebook-platform-local): operation error DynamoDB: CreateTable, https response error StatusCode: 400, RequestID: 2ccf6a31-5b5a-4a9a-aa90-7e93dd314797, ResourceInUseException: Table already exists: ebook-platform-local
│ 
│   with module.dynamodb.aws_dynamodb_table.main,
│   on modules/dynamodb/main.tf line 30, in resource "aws_dynamodb_table" "main":
│   30: resource "aws_dynamodb_table" "main" {
│ 
╵
Apply failed, but this might be expected for existing resources
Checking what was created...
module.api_gateway.data.aws_caller_identity.current
module.api_gateway.data.aws_region.current
module.api_gateway.aws_api_gateway_integration.cors_auth
module.api_gateway.aws_api_gateway_integration.cors_books
module.api_gateway.aws_api_gateway_integration.cors_notifications
module.api_gateway.aws_api_gateway_integration.cors_reviews
module.api_gateway.aws_api_gateway_integration.cors_users
module.api_gateway.aws_api_gateway_integration.cors_workflow
module.api_gateway.aws_api_gateway_integration_response.cors_auth
module.api_gateway.aws_api_gateway_integration_response.cors_books
module.api_gateway.aws_api_gateway_integration_response.cors_notifications
module.api_gateway.aws_api_gateway_integration_response.cors_reviews
module.api_gateway.aws_api_gateway_integration_response.cors_users
module.api_gateway.aws_api_gateway_integration_response.cors_workflow
module.api_gateway.aws_api_gateway_method.auth_post
module.api_gateway.aws_api_gateway_method.cors_auth
module.api_gateway.aws_api_gateway_method.cors_books
module.api_gateway.aws_api_gateway_method.cors_notifications
module.api_gateway.aws_api_gateway_method.cors_reviews
module.api_gateway.aws_api_gateway_method.cors_users
module.api_gateway.aws_api_gateway_method.cors_workflow
module.api_gateway.aws_api_gateway_method.reviews_get
module.api_gateway.aws_api_gateway_method_response.cors_auth
module.api_gateway.aws_api_gateway_method_response.cors_books
module.api_gateway.aws_api_gateway_method_response.cors_notifications
module.api_gateway.aws_api_gateway_method_response.cors_reviews
module.api_gateway.aws_api_gateway_method_response.cors_users
module.api_gateway.aws_api_gateway_method_response.cors_workflow
module.api_gateway.aws_api_gateway_resource.api
module.api_gateway.aws_api_gateway_resource.auth
module.api_gateway.aws_api_gateway_resource.books
module.api_gateway.aws_api_gateway_resource.notifications
module.api_gateway.aws_api_gateway_resource.reviews
module.api_gateway.aws_api_gateway_resource.users
module.api_gateway.aws_api_gateway_resource.workflow
module.api_gateway.aws_api_gateway_rest_api.main
module.api_gateway.aws_cloudwatch_metric_alarm.api_gateway_errors
module.api_gateway.aws_iam_role.api_gateway_authorizer
module.cloudwatch.data.aws_caller_identity.current
module.cloudwatch.data.aws_region.current
module.cloudwatch.aws_cloudwatch_metric_alarm.api_gateway_5xx_errors
module.cloudwatch.aws_cloudwatch_metric_alarm.api_gateway_latency
module.cloudwatch.aws_cloudwatch_metric_alarm.high_authentication_failures
module.deployment_permissions.aws_iam_policy.cloudfront_deployment
module.deployment_permissions.aws_iam_policy.cloudwatch_deployment
module.deployment_permissions.aws_iam_policy.iam_deployment
module.deployment_permissions.aws_iam_policy.sns_deployment
module.deployment_permissions.aws_iam_policy.sqs_deployment
module.dynamodb.data.aws_region.current
module.s3.data.aws_caller_identity.current
module.s3.data.aws_region.current
module.s3.aws_s3_bucket.assets
module.s3.aws_s3_bucket.frontend
module.s3.aws_s3_bucket_cors_configuration.assets
module.s3.aws_s3_bucket_cors_configuration.frontend
module.s3.aws_s3_bucket_policy.frontend
module.s3.aws_s3_bucket_public_access_block.assets
module.s3.aws_s3_bucket_public_access_block.frontend
module.s3.aws_s3_bucket_server_side_encryption_configuration.assets
module.s3.aws_s3_bucket_server_side_encryption_configuration.frontend
module.s3.aws_s3_bucket_versioning.assets
module.s3.aws_s3_bucket_versioning.frontend
module.s3.aws_s3_bucket_website_configuration.frontend
module.s3.random_id.bucket_suffix
module.sns.data.aws_caller_identity.current
module.sns.data.aws_region.current
module.sns.aws_cloudwatch_metric_alarm.sns_delivery_failures["book_workflow"]
module.sns.aws_cloudwatch_metric_alarm.sns_delivery_failures["user_notifications"]
module.sns.aws_iam_policy.sns_publish
module.sns.aws_sns_topic.book_workflow
module.sns.aws_sns_topic.system_alerts
module.sns.aws_sns_topic.user_notifications
module.sns.aws_sns_topic_policy.book_workflow
module.sns.aws_sns_topic_policy.user_notifications
module.sqs.data.aws_caller_identity.current
module.sqs.data.aws_region.current
module.sqs.aws_cloudwatch_metric_alarm.sqs_dlq_messages["book_workflow"]
module.sqs.aws_cloudwatch_metric_alarm.sqs_dlq_messages["email_processing"]
module.sqs.aws_sqs_queue_policy.book_workflow: Creation complete after 26s [id=http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/local-book-workflow-queue]
✅ Deployment completed!
Testing deployment...
"ebook-platform-local"
Listing tables in LocalStack:
{
    "TableNames": [
        "ebook-platform-data",
        "ebook-platform-local"
    ]
}
```

## Step 15:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis
```

**Output:**
```json
{
    "items": [
        {
            "id": "036cfq4sli",
            "name": "local-ebook-api",
            "description": "Ebook Publishing Platform REST API",
            "createdDate": "2025-08-25T19:32:11-07:00",
            "apiKeySource": "HEADER",
            "endpointConfiguration": {
                "types": [
                    "REGIONAL"
                ]
            },
            "tags": {
                "Project": "ebook-platform",
                "Type": "rest-api",
                "Component": "api-gateway"
            }
        }
    ]
}
```

## Step 16:

```bash
prasadguuduru@Prasads-MacBook-Pro book-management % curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john.author@example.com", "password": "password123"}' | jq .
```

**Output:**
```
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  1276  100  1213  100    63   2790    144 --:--:-- --:--:-- --:--:--  2933
{
  "user": {
    "lastName": "Steinberg",
    "preferences": {
      "notifications": true,
      "theme": "light",
      "language": "en"
    },
    "role": "AUTHOR",
    "entityType": "USER",
    "isActive": true,
    "userId": "author-001",
    "version": 1,
    "firstName": "John",
    "emailVerified": true,
    "createdAt": "2025-07-27T02:22:22.601Z",
    "SK": "PROFILE",
    "PK": "USER#author-001",
    "email": "john.author@example.com",
    "updatedAt": "2025-08-25T02:22:22.601Z"
  },
  "accessToken": "XXXXXX",
  "refreshToken": "XXXX",
  "timestamp": "2025-08-26T02:47:58.642Z"
}
```

