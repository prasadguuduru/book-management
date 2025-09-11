#!/usr/bin/env ts-node

/**
 * Check workflow service configuration and recent activity
 */

import { CloudWatchLogs, Lambda } from 'aws-sdk';

const cloudWatchLogs = new CloudWatchLogs({ region: 'us-east-1' });
const lambda = new Lambda({ region: 'us-east-1' });

async function checkWorkflowServiceConfig() {
  console.log('🔍 Checking workflow service configuration...');

  // 1. Check Lambda environment variables
  console.log('\n📋 1. CHECKING LAMBDA ENVIRONMENT VARIABLES');
  console.log('===========================================');
  
  try {
    const lambdaConfig = await lambda.getFunctionConfiguration({
      FunctionName: 'qa-workflow-service'
    }).promise();

    console.log('📊 Lambda Configuration:');
    console.log(`   Runtime: ${lambdaConfig.Runtime}`);
    console.log(`   Memory: ${lambdaConfig.MemorySize}MB`);
    console.log(`   Timeout: ${lambdaConfig.Timeout}s`);
    console.log(`   Last Modified: ${lambdaConfig.LastModified}`);
    
    if (lambdaConfig.Environment?.Variables) {
      console.log('\n🔧 Environment Variables:');
      const envVars = lambdaConfig.Environment.Variables;
      
      // Check critical environment variables
      const criticalVars = [
        'BOOK_WORKFLOW_EVENTS_TOPIC_ARN',
        'AWS_REGION',
        'NODE_ENV',
        'DYNAMODB_TABLE_NAME'
      ];
      
      criticalVars.forEach(varName => {
        const value = envVars[varName];
        if (value) {
          console.log(`   ✅ ${varName}: ${value}`);
        } else {
          console.log(`   ❌ ${varName}: NOT SET`);
        }
      });
      
      // Show all environment variables
      console.log('\n📋 All Environment Variables:');
      Object.entries(envVars).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    } else {
      console.log('❌ No environment variables found');
    }
  } catch (error) {
    console.error('❌ Error checking Lambda configuration:', error);
  }

  // 2. Check recent workflow service logs for event publishing
  console.log('\n📋 2. CHECKING RECENT WORKFLOW SERVICE LOGS');
  console.log('===========================================');
  
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  
  try {
    const workflowLogs = await cloudWatchLogs.filterLogEvents({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime: thirtyMinutesAgo,
      filterPattern: 'PUBLISH OR EVENT OR SNS OR APPROVE'
    }).promise();

    if (workflowLogs.events && workflowLogs.events.length > 0) {
      console.log(`✅ Found ${workflowLogs.events.length} workflow service events`);
      console.log('\n📋 Recent Events:');
      workflowLogs.events.slice(-10).forEach((event, index) => {
        const timestamp = new Date(event.timestamp!).toISOString();
        const message = event.message?.substring(0, 300);
        console.log(`${index + 1}. ${timestamp}`);
        console.log(`   ${message}...`);
        console.log('');
      });
    } else {
      console.log('❌ No workflow service events found in the last 30 minutes');
    }
  } catch (error) {
    console.error('❌ Error checking workflow service logs:', error);
  }

  // 3. Check for initialization logs
  console.log('\n📋 3. CHECKING WORKFLOW SERVICE INITIALIZATION');
  console.log('==============================================');
  
  try {
    const initLogs = await cloudWatchLogs.filterLogEvents({
      logGroupName: '/aws/lambda/qa-workflow-service',
      startTime: thirtyMinutesAgo,
      filterPattern: 'INIT OR PUBLISHER OR TOPIC_ARN'
    }).promise();

    if (initLogs.events && initLogs.events.length > 0) {
      console.log(`✅ Found ${initLogs.events.length} initialization events`);
      initLogs.events.forEach((event, index) => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`${index + 1}. ${timestamp}: ${event.message}`);
      });
    } else {
      console.log('❌ No initialization events found');
    }
  } catch (error) {
    console.error('❌ Error checking initialization logs:', error);
  }

  // 4. Test direct invocation
  console.log('\n📋 4. TESTING WORKFLOW SERVICE HEALTH');
  console.log('=====================================');
  
  try {
    const healthEvent = {
      httpMethod: 'GET',
      path: '/health',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
      requestContext: {
        requestId: 'test-health-check',
        stage: 'qa',
        httpMethod: 'GET',
        path: '/health',
        accountId: '582491219315',
        resourceId: 'test',
        resourcePath: '/health',
        apiId: 'test'
      }
    };

    const result = await lambda.invoke({
      FunctionName: 'qa-workflow-service',
      Payload: JSON.stringify(healthEvent),
      InvocationType: 'RequestResponse'
    }).promise();

    if (result.Payload) {
      const response = JSON.parse(result.Payload.toString());
      console.log('✅ Health check response:', JSON.stringify(response, null, 2));
    }
  } catch (error) {
    console.error('❌ Error testing workflow service health:', error);
  }

  console.log('\n🎉 Workflow service configuration check completed');
}

checkWorkflowServiceConfig().catch(console.error);