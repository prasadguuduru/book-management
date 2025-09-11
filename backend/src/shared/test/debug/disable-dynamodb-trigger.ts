#!/usr/bin/env ts-node

/**
 * Disable DynamoDB Stream Trigger
 * 
 * This script disables the DynamoDB stream event source mapping
 * for the notification service so it only receives SQS events.
 */

import { LambdaClient, UpdateEventSourceMappingCommand, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

async function disableDynamoDBTrigger() {
  console.log('🔧 Disabling DynamoDB stream trigger for qa-notification-service...');
  
  try {
    // Get current event source mappings
    const mappings = await lambdaClient.send(new ListEventSourceMappingsCommand({
      FunctionName: 'qa-notification-service'
    }));
    
    if (!mappings.EventSourceMappings) {
      console.log('❌ No event source mappings found');
      return;
    }
    
    console.log(`📋 Found ${mappings.EventSourceMappings.length} event source mappings:`);
    
    for (const mapping of mappings.EventSourceMappings) {
      console.log(`\\n📡 Event Source: ${mapping.EventSourceArn}`);
      console.log(`   UUID: ${mapping.UUID}`);
      console.log(`   State: ${mapping.State}`);
      
      // Check if this is a DynamoDB stream
      if (mapping.EventSourceArn?.includes('dynamodb') && mapping.State === 'Enabled') {
        console.log(`   🗄️  This is an enabled DynamoDB stream - disabling...`);
        
        try {
          const result = await lambdaClient.send(new UpdateEventSourceMappingCommand({
            UUID: mapping.UUID,
            Enabled: false
          }));
          
          console.log(`   ✅ Successfully disabled DynamoDB trigger`);
          console.log(`   📊 New state: ${result.State}`);
        } catch (error) {
          console.error(`   ❌ Failed to disable DynamoDB trigger:`, error);
        }
      } else if (mapping.EventSourceArn?.includes('sqs')) {
        console.log(`   📨 This is an SQS queue - keeping enabled`);
      } else {
        console.log(`   ❓ Unknown event source type`);
      }
    }
    
    console.log('\\n🎉 DynamoDB trigger management complete!');
    console.log('\\n📋 The notification service should now only receive SQS events.');
    console.log('📋 Try publishing a book again to test the email notifications.');
    
  } catch (error) {
    console.error('❌ Error managing event source mappings:', error);
  }
}

async function main() {
  await disableDynamoDBTrigger();
}

if (require.main === module) {
  main();
}

export { disableDynamoDBTrigger };