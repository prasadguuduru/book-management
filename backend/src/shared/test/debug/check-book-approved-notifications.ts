#!/usr/bin/env npx ts-node

/**
 * Check for book_approved notification events specifically
 */

import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

async function checkBookApprovedNotifications() {
    console.log('🔍 Checking for book_approved notification events...');
    console.log('='.repeat(60));

    const logGroupName = '/aws/lambda/qa-notification-service';

    try {
        // Get recent log streams
        console.log('\\n📋 Getting recent log streams...');
        const streamsResponse = await logsClient.send(new DescribeLogStreamsCommand({
            logGroupName,
            orderBy: 'LastEventTime',
            descending: true,
            limit: 3
        }));

        if (!streamsResponse.logStreams || streamsResponse.logStreams.length === 0) {
            console.log('❌ No log streams found');
            return;
        }

        console.log(`✅ Found ${streamsResponse.logStreams.length} recent log streams`);

        // Check the most recent log streams for book_approved events
        for (const stream of streamsResponse.logStreams) {
            console.log(`\\n🔍 Checking stream: ${stream.logStreamName}`);

            try {
                const eventsResponse = await logsClient.send(new GetLogEventsCommand({
                    logGroupName,
                    logStreamName: stream.logStreamName,
                    startTime: Date.now() - (60 * 60 * 1000), // Last 60 minutes
                    limit: 200
                }));

                if (!eventsResponse.events || eventsResponse.events.length === 0) {
                    console.log('   📝 No recent events in this stream');
                    continue;
                }

                // Look for book_approved events
                const bookApprovedEvents = eventsResponse.events.filter(event =>
                    event.message && (
                        event.message.includes('book_approved') ||
                        event.message.includes('BOOK_APPROVED') ||
                        event.message.includes('READY_FOR_PUBLICATION')
                    )
                );

                if (bookApprovedEvents.length > 0) {
                    console.log(`   ✅ Found ${bookApprovedEvents.length} book_approved events:`);

                    bookApprovedEvents.forEach((event, index) => {
                        const timestamp = new Date(event.timestamp || 0).toISOString();
                        console.log(`   ${index + 1}. [${timestamp}]`);
                        console.log(`      ${event.message?.substring(0, 300)}...`);
                        console.log('');
                    });
                } else {
                    console.log('   📝 No book_approved events found in this stream');
                }

                // Also look for any email sending events
                const emailEvents = eventsResponse.events.filter(event =>
                    event.message && (
                        event.message.includes('EMAIL SENT SUCCESSFULLY') ||
                        event.message.includes('Sending email') ||
                        event.message.includes('email sent')
                    )
                );

                if (emailEvents.length > 0) {
                    console.log(`   📧 Found ${emailEvents.length} email events:`);

                    emailEvents.slice(-3).forEach((event, index) => {
                        const timestamp = new Date(event.timestamp || 0).toISOString();
                        console.log(`   ${index + 1}. [${timestamp}] ${event.message?.substring(0, 200)}...`);
                    });
                }

            } catch (streamError) {
                console.log(`   ❌ Error reading stream: ${streamError}`);
            }
        }

        console.log('\\n🎯 Summary:');
        console.log('If you see book_approved events but no emails, there might be an issue with email sending for that notification type.');
        console.log('If you see no book_approved events at all, the notification service is not receiving those events from SQS.');

    } catch (error) {
        console.error('❌ Error checking logs:', error);
    }
}

checkBookApprovedNotifications().catch(console.error);