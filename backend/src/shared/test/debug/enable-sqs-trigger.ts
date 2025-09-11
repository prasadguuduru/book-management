#!/usr/bin/env npx ts-node

/**
 * Enable SQS trigger for notification service
 */

import { LambdaClient, UpdateEventSourceMappingCommand, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

async function enableSQSTrigger() {
  console.log('🔧 Re-enabling SQS trigger for qa-notification-service...');
  
  try {
    // List event source mappings
    const listResponse = await lambdaClient.send(new ListEventSourceMappingsCommand({
      FunctionName: 'qa-notification-service'
    }));
    
    const sqsMapping = listResponse.EventSourceMappings?.find(mapping => 
      mapping.EventSourceArn?.includes('qa-user-notifications-queue')
    );
    
    if (!sqsMapping) {
      console.error('❌ SQS event source mapping not found');
      return;
    }
    
    console.log(`📡 Found SQS mapping: ${sqsMapping.UUID}`);
    console.log(`   Current state: ${sqsMapping.State}`);
    
    if (sqsMapping.State === 'Enabled') {
      console.log('✅ SQS trigger is already enabled');
      return;
    }
    
    // Enable the mapping
    await lambdaClient.send(new UpdateEventSourceMappingCommand({
      UUID: sqsMapping.UUID,
      Enabled: true
    }));
    
    console.log('✅ SQS trigger enabled successfully');
    console.log('📋 Lambda will now process messages from SQS queue');
    
  } catch (error) {
    console.error('❌ Error enabling SQS trigger:', error);
  }
}

enableSQSTrigger().catch(console.error);