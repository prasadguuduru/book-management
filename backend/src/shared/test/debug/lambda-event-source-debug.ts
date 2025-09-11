/**
 * Lambda Event Source Debug Script
 * Checks if the notification service Lambda has SQS event source mappings
 */

import { Lambda } from 'aws-sdk';

const lambda = new Lambda({ region: 'us-east-1' });

async function debugLambdaEventSources() {
  console.log('🔍 Starting Lambda Event Source Debug...');
  
  const functionName = 'qa-notification-service';
  
  try {
    // 1. List event source mappings for the function
    console.log('📋 Checking event source mappings...');
    const eventSourceMappings = await lambda.listEventSourceMappings({
      FunctionName: functionName
    }).promise();
    
    if (eventSourceMappings.EventSourceMappings && eventSourceMappings.EventSourceMappings.length > 0) {
      console.log('✅ Found event source mappings:', eventSourceMappings.EventSourceMappings.length);
      
      eventSourceMappings.EventSourceMappings.forEach((mapping, index) => {
        console.log(`Mapping ${index + 1}:`, {
          uuid: mapping.UUID,
          eventSourceArn: mapping.EventSourceArn,
          state: mapping.State,
          stateTransitionReason: mapping.StateTransitionReason,
          batchSize: mapping.BatchSize,
          maximumBatchingWindowInSeconds: mapping.MaximumBatchingWindowInSeconds,
          lastModified: mapping.LastModified,
          lastProcessingResult: mapping.LastProcessingResult
        });
      });
    } else {
      console.log('❌ No event source mappings found!');
      console.log('🔧 This means the Lambda is not configured to trigger on SQS messages');
    }
    
    // 2. Check function configuration
    console.log('📋 Checking function configuration...');
    const functionConfig = await lambda.getFunctionConfiguration({
      FunctionName: functionName
    }).promise();
    
    console.log('✅ Function configuration:', {
      functionName: functionConfig.FunctionName,
      runtime: functionConfig.Runtime,
      handler: functionConfig.Handler,
      timeout: functionConfig.Timeout,
      memorySize: functionConfig.MemorySize,
      environment: functionConfig.Environment?.Variables ? Object.keys(functionConfig.Environment.Variables) : 'none',
      role: functionConfig.Role
    });
    
    // 3. Check function permissions
    console.log('📋 Checking function policy...');
    try {
      const policy = await lambda.getPolicy({
        FunctionName: functionName
      }).promise();
      
      console.log('✅ Function policy exists:', {
        policyLength: policy.Policy?.length || 0
      });
      
      if (policy.Policy) {
        const policyDoc = JSON.parse(policy.Policy);
        console.log('Policy statements:', policyDoc.Statement?.length || 0);
        policyDoc.Statement?.forEach((statement: any, index: number) => {
          console.log(`Statement ${index + 1}:`, {
            effect: statement.Effect,
            principal: statement.Principal,
            action: statement.Action,
            condition: statement.Condition
          });
        });
      }
    } catch (error: any) {
      if (error.code === 'ResourceNotFoundException') {
        console.log('⚠️ No resource-based policy found (this is normal for SQS-triggered functions)');
      } else {
        console.log('❌ Error checking policy:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug if this file is executed directly
if (require.main === module) {
  debugLambdaEventSources().then(() => {
    console.log('🎉 Lambda event source debug completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  });
}

export { debugLambdaEventSources };