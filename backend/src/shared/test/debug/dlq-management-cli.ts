#!/usr/bin/env ts-node

/**
 * DLQ Management CLI
 * 
 * Command-line interface for managing Dead Letter Queue operations:
 * - Analyze DLQ messages
 * - Reprocess messages selectively
 * - Monitor DLQ health
 * - Generate reports
 */

import { Command } from 'commander';
import { DLQAnalyzer } from './dlq-analysis-comprehensive';
import { DLQMessageReprocessor } from './dlq-message-reprocessor';
import { createDLQMonitor } from '../../monitoring/dlq-monitoring';
import { SQSClient, PurgeQueueCommand } from '@aws-sdk/client-sqs';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
    .name('dlq-management')
    .description('CLI for managing Dead Letter Queue operations')
    .version('1.0.0');

// Analyze command
program
    .command('analyze')
    .description('Analyze DLQ messages and generate report')
    .option('-o, --output <path>', 'Output directory for reports', './reports')
    .option('-v, --verbose', 'Verbose output')
    .action(async (options) => {
        try {
            console.log('🔍 Starting DLQ analysis...');

            const analyzer = new DLQAnalyzer();
            const report = await analyzer.analyzeDLQ();

            // Ensure output directory exists
            if (!fs.existsSync(options.output)) {
                fs.mkdirSync(options.output, { recursive: true });
            }

            // Save reports
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(options.output, `dlq-analysis-${timestamp}.json`);
            const summaryPath = path.join(options.output, `dlq-analysis-summary-${timestamp}.md`);

            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

            const summary = generateAnalysisSummary(report);
            fs.writeFileSync(summaryPath, summary);

            console.log('\n🎉 Analysis complete!');
            console.log(`📊 Total messages: ${report.totalMessages}`);
            console.log(`✅ Reprocessable: ${report.reprocessableCount}`);
            console.log(`❌ Non-reprocessable: ${report.nonReprocessableCount}`);
            console.log(`📄 Detailed report: ${reportPath}`);
            console.log(`📋 Summary report: ${summaryPath}`);

            if (options.verbose) {
                console.log('\n📋 Top recommendations:');
                report.recommendations.slice(0, 5).forEach(rec => console.log(`  - ${rec}`));
            }

        } catch (error) {
            console.error('❌ Analysis failed:', error);
            process.exit(1);
        }
    });

// Reprocess command
program
    .command('reprocess')
    .description('Reprocess DLQ messages')
    .option('--dry-run', 'Perform dry run without actual reprocessing', false)
    .option('--max <number>', 'Maximum number of messages to reprocess', '10')
    .option('--ids <ids>', 'Comma-separated list of message IDs to reprocess')
    .option('--batch-size <number>', 'Batch size for reprocessing', '5')
    .option('-o, --output <path>', 'Output directory for reports', './reports')
    .action(async (options) => {
        try {
            console.log('🔄 Starting DLQ message reprocessing...');

            if (options.dryRun) {
                console.log('🧪 DRY RUN MODE - No actual reprocessing will occur');
            }

            const reprocessor = new DLQMessageReprocessor();
            const maxMessages = parseInt(options.max);
            const batchSize = parseInt(options.batchSize);
            const messageIds = options.ids ? options.ids.split(',') : undefined;

            let result;
            if (messageIds) {
                console.log(`🎯 Reprocessing specific messages: ${messageIds.join(', ')}`);
                result = await reprocessor.reprocessByMessageIds(messageIds, options.dryRun);
            } else {
                console.log(`🔄 Reprocessing up to ${maxMessages} messages`);
                result = await reprocessor.reprocessAll(maxMessages, options.dryRun);
            }

            // Ensure output directory exists
            if (!fs.existsSync(options.output)) {
                fs.mkdirSync(options.output, { recursive: true });
            }

            // Save results
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(options.output, `dlq-reprocessing-${timestamp}.json`);
            const summaryPath = path.join(options.output, `dlq-reprocessing-summary-${timestamp}.md`);

            fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));

            const summary = generateReprocessingSummary(result);
            fs.writeFileSync(summaryPath, summary);

            console.log('\n🎉 Reprocessing complete!');
            console.log(`📊 Total processed: ${result.totalProcessed}`);
            console.log(`✅ Successful: ${result.successful}`);
            console.log(`❌ Failed: ${result.failed}`);
            console.log(`⏭️  Skipped: ${result.skipped}`);
            console.log(`📈 Success rate: ${result.summary.successRate.toFixed(1)}%`);
            console.log(`⏱️  Duration: ${(result.summary.duration / 1000).toFixed(2)}s`);
            console.log(`📄 Detailed report: ${reportPath}`);
            console.log(`📋 Summary report: ${summaryPath}`);

        } catch (error) {
            console.error('❌ Reprocessing failed:', error);
            process.exit(1);
        }
    });

// Monitor command
program
    .command('monitor')
    .description('Monitor DLQ health and metrics')
    .option('-e, --environment <env>', 'Environment (local, qa, prod)', 'qa')
    .option('-w, --watch', 'Continuous monitoring mode')
    .option('-i, --interval <seconds>', 'Monitoring interval in seconds', '60')
    .action(async (options) => {
        try {
            console.log(`🔍 Starting DLQ monitoring for ${options.environment} environment...`);

            const monitor = createDLQMonitor(options.environment as 'local' | 'qa' | 'prod');

            if (options.watch) {
                console.log(`👀 Continuous monitoring mode (interval: ${options.interval}s)`);
                console.log('Press Ctrl+C to stop monitoring\n');

                const interval = parseInt(options.interval) * 1000;

                const monitoringLoop = async () => {
                    try {
                        const healthStatus = await monitor.getHealthStatus();
                        const timestamp = new Date().toISOString();

                        console.log(`[${timestamp}] Status: ${healthStatus.status}`);
                        console.log(`  Messages: ${healthStatus.metrics.messageCount}`);
                        console.log(`  Oldest message age: ${healthStatus.metrics.oldestMessageAge}s`);
                        console.log(`  Message rate: ${healthStatus.metrics.messageRate.toFixed(2)}/s`);

                        if (healthStatus.alerts.length > 0) {
                            console.log(`  🚨 Alerts: ${healthStatus.alerts.length}`);
                            healthStatus.alerts.forEach(alert => {
                                console.log(`    - ${alert.severity}: ${alert.message}`);
                            });
                        }

                        console.log('');
                    } catch (error) {
                        console.error('❌ Monitoring error:', error);
                    }
                };

                // Initial check
                await monitoringLoop();

                // Set up interval
                const intervalId = setInterval(monitoringLoop, interval);

                // Handle graceful shutdown
                process.on('SIGINT', () => {
                    console.log('\n🛑 Stopping monitoring...');
                    clearInterval(intervalId);
                    process.exit(0);
                });

            } else {
                // Single check
                const healthStatus = await monitor.getHealthStatus();
                const dashboardData = await monitor.getDashboardData();

                console.log('\n📊 DLQ Health Status:');
                console.log(`Status: ${healthStatus.status}`);
                console.log(`Messages: ${healthStatus.metrics.messageCount}`);
                console.log(`Oldest message age: ${healthStatus.metrics.oldestMessageAge}s`);
                console.log(`Message rate: ${healthStatus.metrics.messageRate.toFixed(2)}/s`);

                if (healthStatus.alerts.length > 0) {
                    console.log('\n🚨 Active Alerts:');
                    healthStatus.alerts.forEach(alert => {
                        console.log(`  - ${alert.severity}: ${alert.message}`);
                    });
                }

                if (dashboardData.recommendations.length > 0) {
                    console.log('\n💡 Recommendations:');
                    dashboardData.recommendations.forEach(rec => {
                        console.log(`  - ${rec}`);
                    });
                }
            }

        } catch (error) {
            console.error('❌ Monitoring failed:', error);
            process.exit(1);
        }
    });

// Status command
program
    .command('status')
    .description('Get quick DLQ status overview')
    .option('-e, --environment <env>', 'Environment (local, qa, prod)', 'qa')
    .action(async (options) => {
        try {
            const monitor = createDLQMonitor(options.environment as 'local' | 'qa' | 'prod');
            const healthStatus = await monitor.getHealthStatus();

            console.log(`\n📊 DLQ Status (${options.environment.toUpperCase()})`);
            console.log('═'.repeat(40));
            console.log(`Status: ${getStatusEmoji(healthStatus.status)} ${healthStatus.status}`);
            console.log(`Messages: ${healthStatus.metrics.messageCount}`);
            console.log(`Queue: ${healthStatus.metrics.queueName}`);
            console.log(`Oldest message: ${formatAge(healthStatus.metrics.oldestMessageAge)}`);
            console.log(`Message rate: ${healthStatus.metrics.messageRate.toFixed(2)}/s`);
            console.log(`Last check: ${healthStatus.metrics.timestamp.toISOString()}`);

            if (healthStatus.alerts.length > 0) {
                console.log(`\n🚨 Alerts (${healthStatus.alerts.length}):`);
                healthStatus.alerts.forEach(alert => {
                    console.log(`  ${getSeverityEmoji(alert.severity)} ${alert.message}`);
                });
            } else {
                console.log('\n✅ No active alerts');
            }

        } catch (error) {
            console.error('❌ Status check failed:', error);
            process.exit(1);
        }
    });

// Purge command
program
    .command('purge')
    .description('Purge all messages from DLQ (use with caution)')
    .option('-e, --environment <env>', 'Environment (local, qa, prod)', 'qa')
    .option('--confirm', 'Confirm purge operation (required for safety)')
    .option('--dry-run', 'Show what would be purged without actually purging')
    .action(async (options) => {
        try {
            if (!options.dryRun && !options.confirm) {
                console.error('❌ Purge operation requires --confirm flag for safety');
                console.log('💡 Use --dry-run to see what would be purged');
                process.exit(1);
            }

            const environment = options.environment as 'local' | 'qa' | 'prod';
            const queueUrl = getQueueUrl(environment);

            console.log(`🗑️  ${options.dryRun ? 'DRY RUN: Would purge' : 'Purging'} DLQ messages...`);
            console.log(`Environment: ${environment.toUpperCase()}`);
            console.log(`Queue: ${queueUrl}`);

            // First, check queue attributes to see total messages (visible + not visible)
            const clientConfig: any = {
                region: process.env['AWS_REGION'] || 'us-east-1'
            };

            if (environment === 'local') {
                clientConfig.endpoint = 'http://localhost:4566';
            }

            const sqsClient = new SQSClient(clientConfig);

            // Get queue attributes to check total messages
            const { GetQueueAttributesCommand } = await import('@aws-sdk/client-sqs');
            const queueAttributes = await sqsClient.send(new GetQueueAttributesCommand({
                QueueUrl: queueUrl,
                AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
            }));

            const visibleMessages = parseInt(queueAttributes.Attributes?.ApproximateNumberOfMessages || '0');
            const notVisibleMessages = parseInt(queueAttributes.Attributes?.ApproximateNumberOfMessagesNotVisible || '0');
            const totalMessages = visibleMessages + notVisibleMessages;

            if (totalMessages === 0) {
                console.log('✅ DLQ is already empty - no action needed');
                return;
            }

            // Also run analysis for detailed info
            const analyzer = new DLQAnalyzer();
            const report = await analyzer.analyzeDLQ();

            console.log(`\n📊 Current DLQ Status:`);
            console.log(`  Visible messages: ${visibleMessages}`);
            console.log(`  Not visible messages: ${notVisibleMessages}`);
            console.log(`  Total messages: ${totalMessages}`);
            console.log(`  Analyzable messages: ${report.totalMessages}`);
            console.log(`  Reprocessable: ${report.reprocessableCount}`);
            console.log(`  Non-reprocessable: ${report.nonReprocessableCount}`);

            if (options.dryRun) {
                console.log('\n🔍 DRY RUN: Would purge all messages');
                console.log(`  This would remove ${totalMessages} messages (${visibleMessages} visible + ${notVisibleMessages} not visible)`);
                console.log('💡 Use --confirm to actually purge messages');
                return;
            }

            console.log('\n🗑️  Purging DLQ...');
            console.log(`  Removing ${totalMessages} messages (${visibleMessages} visible + ${notVisibleMessages} not visible)`);
            await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));

            console.log('✅ DLQ purged successfully');
            console.log('📊 Verifying purge...');

            // Wait a moment for the purge to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify purge
            const verificationReport = await analyzer.analyzeDLQ();
            if (verificationReport.totalMessages === 0) {
                console.log('✅ Purge verified - DLQ is now empty');
            } else {
                console.log(`⚠️  Warning: ${verificationReport.totalMessages} messages still in DLQ`);
                console.log('   This may be due to AWS eventual consistency - check again in a few minutes');
            }

        } catch (error) {
            console.error('❌ Purge failed:', error);
            process.exit(1);
        }
    });

// Helper functions
function getQueueUrl(environment: 'local' | 'qa' | 'prod'): string {
    switch (environment) {
        case 'local':
            return 'http://localhost:4566/000000000000/local-user-notifications-dlq';
        case 'qa':
            return process.env['DLQ_URL'] || 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq';
        case 'prod':
            return process.env['DLQ_URL'] || 'https://sqs.us-east-1.amazonaws.com/582491219315/prod-user-notifications-dlq';
        default:
            throw new Error(`Unknown environment: ${environment}`);
    }
}
function generateAnalysisSummary(report: any): string {
    return `# DLQ Analysis Summary

Generated: ${new Date().toISOString()}

## Overview
- **Total Messages**: ${report.totalMessages}
- **Reprocessable**: ${report.reprocessableCount}
- **Non-reprocessable**: ${report.nonReprocessableCount}
- **Date Range**: ${report.oldestMessage} to ${report.newestMessage}

## Error Types
${Object.entries(report.messagesByErrorType)
            .map(([type, count]) => `- **${type}**: ${count}`)
            .join('\n')}

## Recommendations
${report.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

## Critical Issues
${report.summary.criticalIssues.map((issue: string) => `- ${issue}`).join('\n')}

## Suggested Actions
${report.summary.suggestedActions.map((action: string) => `- ${action}`).join('\n')}
`;
}

function generateReprocessingSummary(result: any): string {
    return `# DLQ Reprocessing Summary

Generated: ${new Date().toISOString()}

## Results
- **Total Processed**: ${result.totalProcessed}
- **Successful**: ${result.successful}
- **Failed**: ${result.failed}
- **Skipped**: ${result.skipped}
- **Success Rate**: ${result.summary.successRate.toFixed(1)}%
- **Duration**: ${(result.summary.duration / 1000).toFixed(2)} seconds

## Status Breakdown
### Successful (${result.successful})
${result.results.filter((r: any) => r.status === 'SUCCESS').map((r: any) =>
        `- ${r.messageId}: ${r.reason}`
    ).join('\n')}

### Failed (${result.failed})
${result.results.filter((r: any) => r.status === 'FAILED').map((r: any) =>
        `- ${r.messageId}: ${r.reason}${r.reprocessingError ? ` (${r.reprocessingError})` : ''}`
    ).join('\n')}

### Skipped (${result.skipped})
${result.results.filter((r: any) => r.status === 'SKIPPED').map((r: any) =>
        `- ${r.messageId}: ${r.reason}`
    ).join('\n')}
`;
}

function getStatusEmoji(status: string): string {
    switch (status) {
        case 'HEALTHY': return '✅';
        case 'WARNING': return '⚠️';
        case 'CRITICAL': return '🚨';
        default: return '❓';
    }
}

function getSeverityEmoji(severity: string): string {
    switch (severity) {
        case 'LOW': return '🟡';
        case 'MEDIUM': return '🟠';
        case 'HIGH': return '🔴';
        case 'CRITICAL': return '🚨';
        default: return '❓';
    }
}

function formatAge(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

// Parse and execute
program.parse();

export { program };