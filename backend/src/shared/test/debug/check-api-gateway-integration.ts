#!/usr/bin/env ts-node

/**
 * Check API Gateway Integration
 * 
 * This script checks if API Gateway is properly integrated with Lambda functions
 * and investigates why the book publish request didn't trigger Lambda invocations.
 */

import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function checkApiGatewayIntegration() {
  console.log('🔍 Checking API Gateway integration...');
  
  // Check the exact time around your request (last 10 minutes)
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);
  
  console.log(`📅 Checking logs from ${startTime.toISOString()} to ${endTime.toISOString()}`);
  console.log(`🎯 Looking for book ID: e5144599-ad33-44fc-a724-4f1e559f8cbd`);
  
  // Check API Gateway logs
  try {
    console.log(`\n📋 Checking API Gateway logs...`);
    
    const apiGatewayLogs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/apigateway/qa-ebook-platform-api',
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: '"e5144599-ad33-44fc-a724-4f1e559f8cbd" OR "publish" OR "POST" OR "workflow"'
    }));
    
    if (apiGatewayLogs.events && apiGatewayLogs.events.length > 0) {
      console.log(`  Found ${apiGatewayLogs.events.length} API Gateway events:`);
      apiGatewayLogs.events.forEach(event => {
        const timestamp = new Date(event.timestamp!).toISOString();
        console.log(`    [${timestamp}] ${event.message}`);
      });
    } else {
      console.log(`  No API Gateway events found`);
    }
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      console.log(`  API Gateway log group does not exist`);
    } else {
      console.error(`  Error checking API Gateway logs:`, error);
    }
  }
  
  // Check all possible Lambda function names
  const possibleLambdaNames = [
    '/aws/lambda/qa-workflow-service',
    '/aws/lambda/qa-book-service', 
    '/aws/lambda/qa-ebook-platform-api',
    '/aws/lambda/qa-api-handler',
    '/aws/lambda/ebook-platform-qa-api',
    '/aws/lambda/ebook-platform-api-qa'
  ];
  
  console.log(`\n🔍 Checking all possible Lambda functions...`);
  
  for (const logGroup of possibleLambdaNames) {
    try {
      const logs = await logsClient.send(new FilterLogEventsCommand({
        logGroupName: logGroup,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        filterPattern: '"e5144599-ad33-44fc-a724-4f1e559f8cbd" OR "publish" OR "START RequestId"'
      }));
      
      if (logs.events && logs.events.length > 0) {
        console.log(`  ✅ ${logGroup}: Found ${logs.events.length} events`);
        logs.events.forEach(event => {
          const timestamp = new Date(event.timestamp!).toISOString();
          console.log(`    [${timestamp}] ${event.message}`);
        });
      } else {
        console.log(`  ❌ ${logGroup}: No events found`);
      }
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.log(`  ❌ ${logGroup}: Log group does not exist`);
      } else {
        console.error(`  ❌ ${logGroup}: Error - ${error}`);
      }
    }
  }
  
  // Check for any Lambda invocations at all in the timeframe
  console.log(`\n🔍 Checking for ANY Lambda invocations in the timeframe...`);
  
  try {
    // Use a broader search to find any Lambda activity
    const allLambdaLogs = await logsClient.send(new FilterLogEventsCommand({
      logGroupName: '/aws/lambda',
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      filterPattern: '"START RequestId"'
    }));
    
    if (allLambdaLogs.events && allLambdaLogs.events.length > 0) {
      console.log(`  Found ${allLambdaLogs.events.length} Lambda invocations across all functions`);
      // Group by log stream to see which functions were active
      const functionActivity = new Map<string, number>();
      allLambdaLogs.events.forEach(event => {
        const logStream = event.logStreamName || 'unknown';
        const functionName = logStream.split('/')[0] || 'unknown';
        functionActivity.set(functionName, (functionActivity.get(functionName) || 0) + 1);
      });
      
      console.log(`  Active functions:`);
      functionActivity.forEach((count, functionName) => {
        console.log(`    ${functionName}: ${count} invocations`);
      });
    } else {
      console.log(`  No Lambda invocations found at all`);
    }
    
  } catch (error) {
    console.log(`  Could not check all Lambda logs: ${error}`);
  }
}

async function main() {
  await checkApiGatewayIntegration();
}

if (require.main === module) {
  main();
}

export { checkApiGatewayIntegration };