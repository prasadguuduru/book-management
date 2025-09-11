#!/usr/bin/env ts-node

/**
 * Check Lambda Event Sources
 * 
 * This script checks what event sources are configured for each Lambda function
 * to understand why the notification service is receiving DynamoDB events instead of SQS events.
 */

import { LambdaClient, ListEventSourceMappingsCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

async function checkLambdaEventSources() {
  console.log('🔍 Checking Lambda event source mappings...');
  
  const functionsToCheck = [
    'qa-notification-service',
    'qa-workflow-service',
    'qa-book-service'
  ];
  
  for (const functionName of functionsToCheck) {
    console.log(`\n📋 Checking ${functionName}...`);
    
    try {
      // Get function configuration
      const functionConfig = await lambdaClient.send(new GetFunctionCommand({
        FunctionName: functionName
      }));
      
      console.log(`  Function ARN: ${functionConfig.Configuration?.FunctionArn}`);
      console.log(`  Runtime: ${functionConfig.Configuration?.Runtime}`);
      console.log(`  Last Modified: ${functionConfig.Configuration?.LastModified}`);
      
      // Get event source mappings
      const eventSources = await lambdaClient.send(new ListEventSourceMappingsCommand({
        FunctionName: functionName
      }));
      
      if (eventSources.EventSourceMappings && eventSources.EventSourceMappings.length > 0) {
        console.log(`  📡 Event Sources (${eventSources.EventSourceMappings.length}):`);
        
        eventSources.EventSourceMappings.forEach((mapping, index) => {
          console.log(`    ${index + 1}. ${mapping.EventSourceArn}`);
          console.log(`       State: ${mapping.State}`);
          console.log(`       Batch Size: ${mapping.BatchSize}`);
          console.log(`       Starting Position: ${mapping.StartingPosition || 'N/A'}`);
          console.log(`       UUID: ${mapping.UUID}`);
          
          // Determine source type
          if (mapping.EventSourceArn?.includes('dynamodb')) {
            console.log(`       🗄️  Type: DynamoDB Stream`);
          } else if (mapping.EventSourceArn?.includes('sqs')) {
            console.log(`       📨 Type: SQS Queue`);
          } else if (mapping.EventSourceArn?.includes('kinesis')) {
            console.log(`       🌊 Type: Kinesis Stream`);
          } else {
            console.log(`       ❓ Type: Unknown`);
          }
          console.log('');
        });
      } else {
        console.log(`  ❌ No event source mappings found`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error checking ${functionName}:`, error);
    }
  }
}

async function main() {
  await checkLambdaEventSources();
}

if (require.main === module) {
  main();
}

export { checkLambdaEventSources };