#!/usr/bin/env ts-node

/**
 * Temporarily Disable SQS Trigger
 * 
 * This script temporarily disables the SQS event source mapping
 * to test if messages are being delivered to the queue
 */

import { LambdaClient, UpdateEventSourceMappingCommand, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

async function disableSQSTrigger() {
  console.log('🔧 Temporarily disabling SQS trigger for qa-notification-service...');
  
  try {
    // Get current event source mappings
    const mappings = await lambdaClient.send(new ListEventSourceMappingsCommand({
      FunctionName: 'qa-notification-service'
    }));
    
    if (!mappings.EventSourceMappings) {
      console.log('❌ No event source mappings found');
      return;
    }
    
    for (const mapping of mappings.EventSourceMappings) {
      console.log(`\\n📡 Event Source: ${mapping.EventSourceArn}`);
      console.log(`   UUID: ${mapping.UUID}`);
      console.log(`   State: ${mapping.State}`);
      
      // Check if this is the SQS queue
      if (mapping.EventSourceArn?.includes('qa-user-notifications-queue') && mapping.State === 'Enabled') {
        console.log(`   📨 This is the SQS queue - temporarily disabling...`);
        
        try {
          const result = await lambdaClient.send(new UpdateEventSourceMappingCommand({
            UUID: mapping.UUID,
            Enabled: false
          }));
          
          console.log(`   ✅ Successfully disabled SQS trigger`);
          console.log(`   📊 New state: ${result.State}`);
        } catch (error) {
          console.error(`   ❌ Failed to disable SQS trigger:`, error);
        }
      }
    }
    
    console.log('\\n🎉 SQS trigger temporarily disabled!');
    console.log('\\n📋 Now test SNS to SQS delivery - messages should accumulate in the queue.');
    console.log('📋 Remember to re-enable the trigger after testing!');
    
  } catch (error) {
    console.error('❌ Error managing event source mappings:', error);
  }
}

async function main() {
  await disableSQSTrigger();
}

if (require.main === module) {
  main();
}

export { disableSQSTrigger };