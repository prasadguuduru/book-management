#!/usr/bin/env ts-node

/**
 * Monitor all Lambda activity to see which services are being called
 */

import { CloudWatchLogs } from 'aws-sdk';

const cloudWatchLogs = new CloudWatchLogs({ region: 'us-east-1' });

async function monitorAllLambdaActivity() {
    console.log('🔍 Monitoring all Lambda activity in the last 30 minutes...');
    console.log('📅 Please approve a book through the UI now, then check the results below');
    console.log('⏳ Waiting 10 seconds for you to trigger an approval...\n');

    await new Promise(resolve => setTimeout(resolve, 10000));

    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    const now = Date.now();

    const lambdaServices = [
        '/aws/lambda/qa-auth-service',
        '/aws/lambda/qa-book-service',
        '/aws/lambda/qa-workflow-service',
        '/aws/lambda/qa-user-service',
        '/aws/lambda/qa-review-service',
        '/aws/lambda/qa-notification-service'
    ];

    console.log('📊 LAMBDA ACTIVITY SUMMARY');
    console.log('==========================');

    for (const logGroup of lambdaServices) {
        try {
            const serviceName = logGroup.split('/').pop()?.replace('qa-', '') || 'unknown';

            // Check for any activity
            const activityLogs = await cloudWatchLogs.filterLogEvents({
                logGroupName: logGroup,
                startTime: thirtyMinutesAgo,
                endTime: now,
                filterPattern: 'START RequestId'
            }).promise();

            if (activityLogs.events && activityLogs.events.length > 0) {
                console.log(`\n✅ ${serviceName.toUpperCase()}: ${activityLogs.events.length} invocations`);

                // Show recent invocations
                const recentInvocations = activityLogs.events.slice(-5);
                recentInvocations.forEach((event, index) => {
                    const timestamp = new Date(event.timestamp!).toISOString();
                    console.log(`   ${index + 1}. ${timestamp}`);
                });

                // Check for approve-related activity
                const approveLogs = await cloudWatchLogs.filterLogEvents({
                    logGroupName: logGroup,
                    startTime: thirtyMinutesAgo,
                    endTime: now,
                    filterPattern: 'approve OR APPROVE OR transition OR status'
                }).promise();

                if (approveLogs.events && approveLogs.events.length > 0) {
                    console.log(`   📋 Found ${approveLogs.events.length} approve-related events:`);
                    approveLogs.events.slice(-3).forEach((event, index) => {
                        const timestamp = new Date(event.timestamp!).toISOString();
                        const message = event.message?.substring(0, 150);
                        console.log(`      ${index + 1}. ${timestamp}: ${message}...`);
                    });
                }
            } else {
                console.log(`\n❌ ${serviceName.toUpperCase()}: No activity`);
            }
        } catch (error) {
            console.error(`❌ Error checking ${logGroup}:`, error);
        }
    }

    // Check API Gateway logs if available
    console.log('\n📊 API GATEWAY ACTIVITY');
    console.log('=======================');

    try {
        const apiGatewayLogs = await cloudWatchLogs.filterLogEvents({
            logGroupName: 'API-Gateway-Execution-Logs_7tmom26ucc/qa',
            startTime: thirtyMinutesAgo,
            endTime: now
        }).promise();

        if (apiGatewayLogs.events && apiGatewayLogs.events.length > 0) {
            console.log(`✅ Found ${apiGatewayLogs.events.length} API Gateway events`);
            apiGatewayLogs.events.slice(-5).forEach((event, index) => {
                const timestamp = new Date(event.timestamp!).toISOString();
                const message = event.message?.substring(0, 200);
                console.log(`${index + 1}. ${timestamp}: ${message}...`);
            });
        } else {
            console.log('❌ No API Gateway activity found');
        }
    } catch (error) {
        console.log('ℹ️ API Gateway logs not available or not configured');
    }

    console.log('\n💡 ANALYSIS');
    console.log('===========');
    console.log('If you see activity in:');
    console.log('  - book-service: UI is calling book service directly (wrong)');
    console.log('  - workflow-service: UI is calling workflow service (correct)');
    console.log('  - No activity: UI might not be making any API calls');
    console.log('');
    console.log('Expected flow: UI → API Gateway → Workflow Service → Book Service → SNS → SQS → Notification Service');

    console.log('\n🎉 Lambda activity monitoring completed');
}

monitorAllLambdaActivity().catch(console.error);