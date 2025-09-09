#!/usr/bin/env ts-node

/**
 * Comprehensive Dead Letter Queue Analysis Script
 * 
 * This script analyzes messages in the DLQ to:
 * 1. Categorize messages by error type and root cause
 * 2. Identify patterns in failed message processing
 * 3. Provide recommendations for message reprocessing
 * 4. Generate detailed reports for operational insights
 */

import { SQSClient, ReceiveMessageCommand, GetQueueAttributesCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import * as fs from 'fs';
import * as path from 'path';

interface DLQMessage {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: Record<string, string>;
  messageAttributes: Record<string, any>;
  approximateReceiveCount: number;
  sentTimestamp: Date;
  approximateFirstReceiveTimestamp: Date;
}

interface MessageAnalysis {
  messageId: string;
  errorType: string;
  rootCause: string;
  eventType?: string | undefined;
  bookId?: string | undefined;
  userId?: string | undefined;
  isReprocessable: boolean;
  failureReason: string;
  originalTimestamp: Date;
  failureCount: number;
  logEntries: LogEntry[];
}

interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  requestId?: string | undefined;
}

interface DLQAnalysisReport {
  totalMessages: number;
  messagesByErrorType: Record<string, number>;
  messagesByRootCause: Record<string, number>;
  oldestMessage: Date;
  newestMessage: Date;
  reprocessableCount: number;
  nonReprocessableCount: number;
  recommendations: string[];
  detailedAnalysis: MessageAnalysis[];
  summary: {
    criticalIssues: string[];
    commonPatterns: string[];
    suggestedActions: string[];
  };
}

class DLQAnalyzer {
  private sqsClient: SQSClient;
  private logsClient: CloudWatchLogsClient;
  private dlqUrl: string;
  private logGroupName: string;

  constructor() {
    this.sqsClient = new SQSClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.logsClient = new CloudWatchLogsClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.dlqUrl = process.env['DLQ_URL'] || 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq';
    this.logGroupName = '/aws/lambda/qa-notification-service';
  }

  async analyzeDLQ(): Promise<DLQAnalysisReport> {
    console.log('🔍 Starting comprehensive DLQ analysis...');
    
    // Get queue attributes
    const queueAttributes = await this.getQueueAttributes();
    console.log(`📊 Queue attributes:`, queueAttributes);

    // Receive all messages from DLQ
    const messages = await this.receiveAllMessages();
    console.log(`📨 Retrieved ${messages.length} messages from DLQ`);

    // Analyze each message
    const analyses: MessageAnalysis[] = [];
    for (const message of messages) {
      console.log(`🔬 Analyzing message ${message.messageId}...`);
      const analysis = await this.analyzeMessage(message);
      analyses.push(analysis);
    }

    // Generate comprehensive report
    const report = this.generateReport(analyses);
    
    // Save report to file
    await this.saveReport(report);
    
    return report;
  }

  private async getQueueAttributes(): Promise<Record<string, string>> {
    const command = new GetQueueAttributesCommand({
      QueueUrl: this.dlqUrl,
      AttributeNames: ['All']
    });

    const response = await this.sqsClient.send(command);
    return response.Attributes || {};
  }

  private async receiveAllMessages(): Promise<DLQMessage[]> {
    const messages: DLQMessage[] = [];
    let hasMoreMessages = true;

    while (hasMoreMessages) {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.dlqUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All']
      });

      const response = await this.sqsClient.send(command);
      
      if (response.Messages && response.Messages.length > 0) {
        for (const msg of response.Messages) {
          messages.push({
            messageId: msg.MessageId!,
            receiptHandle: msg.ReceiptHandle!,
            body: msg.Body!,
            attributes: msg.Attributes || {},
            messageAttributes: msg.MessageAttributes || {},
            approximateReceiveCount: parseInt(msg.Attributes?.ApproximateReceiveCount || '0'),
            sentTimestamp: new Date(parseInt(msg.Attributes?.SentTimestamp || '0')),
            approximateFirstReceiveTimestamp: new Date(parseInt(msg.Attributes?.ApproximateFirstReceiveTimestamp || '0'))
          });
        }
      } else {
        hasMoreMessages = false;
      }
    }

    return messages;
  }

  private async analyzeMessage(message: DLQMessage): Promise<MessageAnalysis> {
    let parsedBody: any = {};
    let eventType: string | undefined;
    let bookId: string | undefined;
    let userId: string | undefined;

    try {
      parsedBody = JSON.parse(message.body);
      
      // Extract event information from SNS message
      if (parsedBody.Message) {
        const snsMessage = JSON.parse(parsedBody.Message);
        eventType = snsMessage.eventType;
        bookId = snsMessage.bookId;
        userId = snsMessage.userId;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to parse message body for ${message.messageId}:`, error);
    }

    // Get related log entries
    const logEntries = await this.getRelatedLogEntries(message.messageId, message.sentTimestamp);

    // Determine error type and root cause
    const { errorType, rootCause, isReprocessable, failureReason } = this.categorizeError(message, parsedBody, logEntries);

    return {
      messageId: message.messageId,
      errorType,
      rootCause,
      eventType,
      bookId,
      userId,
      isReprocessable,
      failureReason,
      originalTimestamp: message.sentTimestamp,
      failureCount: message.approximateReceiveCount,
      logEntries
    };
  }

  private async getRelatedLogEntries(messageId: string, timestamp: Date): Promise<LogEntry[]> {
    const startTime = new Date(timestamp.getTime() - 5 * 60 * 1000); // 5 minutes before
    const endTime = new Date(timestamp.getTime() + 5 * 60 * 1000);   // 5 minutes after

    try {
      const command = new FilterLogEventsCommand({
        logGroupName: this.logGroupName,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        filterPattern: `"${messageId}" OR "Cannot read properties of undefined" OR "TypeError" OR "Error processing"`
      });

      const response = await this.logsClient.send(command);
      
      return (response.events || []).map(event => ({
        timestamp: new Date(event.timestamp!),
        level: this.extractLogLevel(event.message!),
        message: event.message!,
        requestId: this.extractRequestId(event.message!)
      }));
    } catch (error) {
      console.warn(`⚠️  Failed to get log entries for message ${messageId}:`, error);
      return [];
    }
  }

  private extractLogLevel(message: string): string {
    if (message.includes('ERROR')) return 'ERROR';
    if (message.includes('WARN')) return 'WARN';
    if (message.includes('INFO')) return 'INFO';
    return 'DEBUG';
  }

  private extractRequestId(message: string): string | undefined {
    const match = message.match(/RequestId: ([a-f0-9-]+)/);
    return match ? match[1] : undefined;
  }

  private categorizeError(message: DLQMessage, parsedBody: any, logEntries: LogEntry[]): {
    errorType: string;
    rootCause: string;
    isReprocessable: boolean;
    failureReason: string;
  } {
    // Check for specific error patterns in logs
    const hasTypeError = logEntries.some(log => log.message.includes('Cannot read properties of undefined'));
    const hasEventDetectionError = logEntries.some(log => log.message.includes('endsWith'));
    const hasValidationError = logEntries.some(log => log.message.includes('validation'));
    const hasTimeoutError = logEntries.some(log => log.message.includes('timeout'));

    // Analyze message structure
    const hasValidSNSStructure = parsedBody.Type === 'Notification' && parsedBody.Message;
    const hasValidEventData = hasValidSNSStructure && this.isValidEventData(parsedBody.Message);

    if (hasTypeError && hasEventDetectionError) {
      return {
        errorType: 'EVENT_DETECTION_ERROR',
        rootCause: 'Undefined property access in event detection logic',
        isReprocessable: true,
        failureReason: 'Event detection bug - accessing undefined properties'
      };
    }

    if (!hasValidSNSStructure) {
      return {
        errorType: 'INVALID_MESSAGE_FORMAT',
        rootCause: 'Message does not have valid SNS structure',
        isReprocessable: false,
        failureReason: 'Malformed SNS message structure'
      };
    }

    if (!hasValidEventData) {
      return {
        errorType: 'INVALID_EVENT_DATA',
        rootCause: 'Event data missing required fields',
        isReprocessable: false,
        failureReason: 'Invalid or incomplete event data'
      };
    }

    if (hasValidationError) {
      return {
        errorType: 'VALIDATION_ERROR',
        rootCause: 'Event data failed validation checks',
        isReprocessable: true,
        failureReason: 'Event validation failure'
      };
    }

    if (hasTimeoutError) {
      return {
        errorType: 'PROCESSING_TIMEOUT',
        rootCause: 'Lambda function timeout during processing',
        isReprocessable: true,
        failureReason: 'Lambda timeout during event processing'
      };
    }

    if (message.approximateReceiveCount > 3) {
      return {
        errorType: 'REPEATED_FAILURE',
        rootCause: 'Message failed processing multiple times',
        isReprocessable: false,
        failureReason: 'Exceeded maximum retry attempts'
      };
    }

    return {
      errorType: 'UNKNOWN_ERROR',
      rootCause: 'Unable to determine specific cause',
      isReprocessable: true,
      failureReason: 'Unknown processing error'
    };
  }

  private isValidEventData(messageString: string): boolean {
    try {
      const eventData = JSON.parse(messageString);
      return !!(eventData.eventType && eventData.bookId && eventData.userId);
    } catch {
      return false;
    }
  }

  private generateReport(analyses: MessageAnalysis[]): DLQAnalysisReport {
    const messagesByErrorType: Record<string, number> = {};
    const messagesByRootCause: Record<string, number> = {};
    let oldestMessage = new Date();
    let newestMessage = new Date(0);
    let reprocessableCount = 0;

    analyses.forEach(analysis => {
      // Count by error type
      messagesByErrorType[analysis.errorType] = (messagesByErrorType[analysis.errorType] || 0) + 1;
      
      // Count by root cause
      messagesByRootCause[analysis.rootCause] = (messagesByRootCause[analysis.rootCause] || 0) + 1;
      
      // Track oldest/newest
      if (analysis.originalTimestamp < oldestMessage) {
        oldestMessage = analysis.originalTimestamp;
      }
      if (analysis.originalTimestamp > newestMessage) {
        newestMessage = analysis.originalTimestamp;
      }
      
      // Count reprocessable
      if (analysis.isReprocessable) {
        reprocessableCount++;
      }
    });

    const recommendations = this.generateRecommendations(analyses);
    const summary = this.generateSummary(analyses);

    return {
      totalMessages: analyses.length,
      messagesByErrorType,
      messagesByRootCause,
      oldestMessage,
      newestMessage,
      reprocessableCount,
      nonReprocessableCount: analyses.length - reprocessableCount,
      recommendations,
      detailedAnalysis: analyses,
      summary
    };
  }

  private generateRecommendations(analyses: MessageAnalysis[]): string[] {
    const recommendations: string[] = [];
    const errorTypes = new Set(analyses.map(a => a.errorType));

    if (errorTypes.has('EVENT_DETECTION_ERROR')) {
      recommendations.push('Fix event detection logic in notification service to handle undefined properties');
      recommendations.push('Add null safety checks in event processing code');
    }

    if (errorTypes.has('INVALID_MESSAGE_FORMAT')) {
      recommendations.push('Investigate SNS message publishing to ensure proper format');
      recommendations.push('Add message format validation before processing');
    }

    if (errorTypes.has('PROCESSING_TIMEOUT')) {
      recommendations.push('Optimize Lambda function performance to reduce processing time');
      recommendations.push('Consider increasing Lambda timeout configuration');
    }

    const reprocessableCount = analyses.filter(a => a.isReprocessable).length;
    if (reprocessableCount > 0) {
      recommendations.push(`${reprocessableCount} messages can be reprocessed after fixes are deployed`);
    }

    const nonReprocessableCount = analyses.filter(a => !a.isReprocessable).length;
    if (nonReprocessableCount > 0) {
      recommendations.push(`${nonReprocessableCount} messages should be purged as they cannot be reprocessed`);
    }

    return recommendations;
  }

  private generateSummary(analyses: MessageAnalysis[]): {
    criticalIssues: string[];
    commonPatterns: string[];
    suggestedActions: string[];
  } {
    const errorTypeCounts = analyses.reduce((acc, a) => {
      acc[a.errorType] = (acc[a.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const criticalIssues: string[] = [];
    const commonPatterns: string[] = [];
    const suggestedActions: string[] = [];

    // Identify critical issues
    if ((errorTypeCounts['EVENT_DETECTION_ERROR'] || 0) > 0) {
      criticalIssues.push(`Event detection errors affecting ${errorTypeCounts['EVENT_DETECTION_ERROR']} messages`);
    }

    if ((errorTypeCounts['PROCESSING_TIMEOUT'] || 0) > 0) {
      criticalIssues.push(`Lambda timeout issues affecting ${errorTypeCounts['PROCESSING_TIMEOUT']} messages`);
    }

    // Identify common patterns
    const mostCommonError = Object.entries(errorTypeCounts).sort(([,a], [,b]) => b - a)[0];
    if (mostCommonError) {
      commonPatterns.push(`Most common error: ${mostCommonError[0]} (${mostCommonError[1]} occurrences)`);
    }

    const avgFailureCount = analyses.reduce((sum, a) => sum + a.failureCount, 0) / analyses.length;
    commonPatterns.push(`Average failure count per message: ${avgFailureCount.toFixed(1)}`);

    // Suggest actions
    suggestedActions.push('Deploy fixes for event detection logic');
    suggestedActions.push('Reprocess reprocessable messages after fixes');
    suggestedActions.push('Purge non-reprocessable messages');
    suggestedActions.push('Implement enhanced monitoring to prevent future accumulation');

    return {
      criticalIssues,
      commonPatterns,
      suggestedActions
    };
  }

  private async saveReport(report: DLQAnalysisReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `dlq-analysis-report-${timestamp}.json`);
    const summaryPath = path.join(__dirname, `dlq-analysis-summary-${timestamp}.md`);

    // Save detailed JSON report
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    // Save human-readable summary
    const summary = this.generateMarkdownSummary(report);
    fs.writeFileSync(summaryPath, summary);
    console.log(`📋 Summary report saved to: ${summaryPath}`);
  }

  private generateMarkdownSummary(report: DLQAnalysisReport): string {
    return `# DLQ Analysis Report

Generated: ${new Date().toISOString()}

## Summary

- **Total Messages**: ${report.totalMessages}
- **Reprocessable**: ${report.reprocessableCount}
- **Non-reprocessable**: ${report.nonReprocessableCount}
- **Date Range**: ${report.oldestMessage.toISOString()} to ${report.newestMessage.toISOString()}

## Messages by Error Type

${Object.entries(report.messagesByErrorType)
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\n')}

## Messages by Root Cause

${Object.entries(report.messagesByRootCause)
  .map(([cause, count]) => `- **${cause}**: ${count}`)
  .join('\n')}

## Critical Issues

${report.summary.criticalIssues.map(issue => `- ${issue}`).join('\n')}

## Common Patterns

${report.summary.commonPatterns.map(pattern => `- ${pattern}`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Suggested Actions

${report.summary.suggestedActions.map(action => `- ${action}`).join('\n')}

## Detailed Analysis

${report.detailedAnalysis.map(analysis => `
### Message ${analysis.messageId}

- **Error Type**: ${analysis.errorType}
- **Root Cause**: ${analysis.rootCause}
- **Reprocessable**: ${analysis.isReprocessable ? 'Yes' : 'No'}
- **Failure Reason**: ${analysis.failureReason}
- **Event Type**: ${analysis.eventType || 'Unknown'}
- **Book ID**: ${analysis.bookId || 'Unknown'}
- **User ID**: ${analysis.userId || 'Unknown'}
- **Failure Count**: ${analysis.failureCount}
- **Original Timestamp**: ${analysis.originalTimestamp.toISOString()}
- **Log Entries**: ${analysis.logEntries.length}
`).join('\n')}
`;
  }
}

// CLI execution
async function main() {
  try {
    const analyzer = new DLQAnalyzer();
    const report = await analyzer.analyzeDLQ();
    
    console.log('\n🎉 Analysis complete!');
    console.log(`📊 Total messages analyzed: ${report.totalMessages}`);
    console.log(`✅ Reprocessable messages: ${report.reprocessableCount}`);
    console.log(`❌ Non-reprocessable messages: ${report.nonReprocessableCount}`);
    console.log('\n📋 Top recommendations:');
    report.recommendations.slice(0, 3).forEach(rec => console.log(`  - ${rec}`));
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DLQAnalyzer, type DLQAnalysisReport, type MessageAnalysis };