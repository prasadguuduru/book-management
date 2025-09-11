#!/usr/bin/env ts-node

/**
 * List Lambda Functions
 * 
 * This script lists all Lambda functions in the account to see what's actually deployed.
 */

import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { CloudWatchLogsClient, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });
const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function listLambdaFunctions() {
  console.log('🔍 Listing all Lambda functions...');
  
  try {
    const response = await lambdaClient.send(new ListFunctionsCommand({}));
    
    if (response.Functions && response.Functions.length > 0) {
      console.log(`\n📋 Found ${response.Functions.length} Lambda functions:`);
      
      const qaFunctions = response.Functions.filter(fn => 
        fn.FunctionName?.includes('qa') || 
        fn.FunctionName?.includes('ebook') ||
        fn.FunctionName?.includes('book') ||
        fn.FunctionName?.includes('workflow') ||
        fn.FunctionName?.includes('notification')
      );
      
      if (qaFunctions.length > 0) {
        console.log(`\n🎯 QA/Book-related functions (${qaFunctions.length}):`);
        qaFunctions.forEach(fn => {
          console.log(`  ✅ ${fn.FunctionName}`);
          console.log(`     Runtime: ${fn.Runtime}`);
          console.log(`     Last Modified: ${fn.LastModified}`);
          console.log(`     Description: ${fn.Description || 'No description'}`);
          console.log('');
        });
      } else {
        console.log(`\n❌ No QA/book-related functions found`);
      }
      
      console.log(`\n📋 All functions:`);
      response.Functions.forEach(fn => {
        console.log(`  - ${fn.FunctionName} (${fn.Runtime})`);
      });
      
    } else {
      console.log('❌ No Lambda functions found');
    }
    
  } catch (error) {
    console.error('❌ Error listing Lambda functions:', error);
  }
}

async function listLogGroups() {
  console.log('\n🔍 Listing Lambda-related log groups...');
  
  try {
    const response = await logsClient.send(new DescribeLogGroupsCommand({
      logGroupNamePrefix: '/aws/lambda/'
    }));
    
    if (response.logGroups && response.logGroups.length > 0) {
      console.log(`\n📋 Found ${response.logGroups.length} Lambda log groups:`);
      
      const relevantGroups = response.logGroups.filter(lg => 
        lg.logGroupName?.includes('qa') || 
        lg.logGroupName?.includes('ebook') ||
        lg.logGroupName?.includes('book') ||
        lg.logGroupName?.includes('workflow') ||
        lg.logGroupName?.includes('notification')
      );
      
      if (relevantGroups.length > 0) {
        console.log(`\n🎯 Relevant log groups (${relevantGroups.length}):`);
        relevantGroups.forEach(lg => {
          console.log(`  ✅ ${lg.logGroupName}`);
          console.log(`     Created: ${new Date(lg.creationTime!).toISOString()}`);
          console.log(`     Size: ${lg.storedBytes || 0} bytes`);
          console.log('');
        });
      } else {
        console.log(`\n❌ No relevant log groups found`);
      }
      
      console.log(`\n📋 All Lambda log groups:`);
      response.logGroups.forEach(lg => {
        console.log(`  - ${lg.logGroupName}`);
      });
      
    } else {
      console.log('❌ No Lambda log groups found');
    }
    
  } catch (error) {
    console.error('❌ Error listing log groups:', error);
  }
}

async function main() {
  await listLambdaFunctions();
  await listLogGroups();
}

if (require.main === module) {
  main();
}

export { listLambdaFunctions, listLogGroups };