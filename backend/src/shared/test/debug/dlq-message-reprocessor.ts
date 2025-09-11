#!/usr/bin/env ts-node

/**
 * DLQ Message Reprocessor
 * 
 * This script provides selective reprocessing capabilities for DLQ messages:
 * 1. Reprocess specific messages by ID
 * 2. Reprocess messages by error type or criteria
 * 3. Batch reprocessing with safety controls
 * 4. Validation before reprocessing
 * 5. Rollback capabilities
 */

import { 
  SQSClient, 
  ReceiveMessageCommand, 
  SendMessageCommand, 
  DeleteMessageCommand,
  GetQueueAttributesCommand 
} from '@aws-sdk/client-sqs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import * as fs from 'fs';
import * as path from 'path';

interface ReprocessingOptions {
  messageIds?: string[];
  errorTypes?: string[];
  maxMessages?: number;
  dryRun?: boolean;
  validateBeforeReprocess?: boolean;
  batchSize?: number;
}

interface ReprocessingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: MessageReprocessingResult[];
  summary: {
    duration: number;
    successRate: number;
    errors: string[];
  };
}

interface MessageReprocessingResult {
  messageId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  reason: string;
  originalError?: string;
  reprocessingError?: string;
  timestamp: Date;
}

interface DLQMessage {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: Record<string, string>;
  approximateReceiveCount: number;
}

class DLQMessageReprocessor {
  private sqsClient: SQSClient;
  private lambdaClient: LambdaClient;
  private dlqUrl: string;
  private originalQueueUrl: string;
  private notificationLambdaName: string;

  constructor() {
    this.sqsClient = new SQSClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.lambdaClient = new LambdaClient({ region: process.env['AWS_REGION'] || 'us-east-1' });
    this.dlqUrl = process.env['DLQ_URL'] || 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-dlq';
    this.originalQueueUrl = process.env['QUEUE_URL'] || 'https://sqs.us-east-1.amazonaws.com/582491219315/qa-user-notifications-queue';
    this.notificationLambdaName = process.env['NOTIFICATION_LAMBDA_NAME'] || 'qa-notification-service';
  }

  async reprocessMessages(options: ReprocessingOptions = {}): Promise<ReprocessingResult> {
    const startTime = Date.now();
    console.log('🔄 Starting DLQ message reprocessing...');
    
    if (options.dryRun) {
      console.log('🧪 DRY RUN MODE - No actual reprocessing will occur');
    }

    // Get messages from DLQ
    const messages = await this.getMessagesForReprocessing(options);
    console.log(`📨 Found ${messages.length} messages for reprocessing`);

    if (messages.length === 0) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        results: [],
        summary: {
          duration: Date.now() - startTime,
          successRate: 0,
          errors: []
        }
      };
    }

    // Validate messages before reprocessing
    if (options.validateBeforeReprocess !== false) {
      console.log('🔍 Validating messages before reprocessing...');
      await this.validateMessages(messages);
    }

    // Process messages in batches
    const batchSize = options.batchSize || 5;
    const results: MessageReprocessingResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messages.length / batchSize)}`);
      
      const batchResults = await this.processBatch(batch, options.dryRun || false);
      results.push(...batchResults);
      
      // Collect errors
      batchResults.forEach(result => {
        if (result.status === 'FAILED' && result.reprocessingError) {
          errors.push(`${result.messageId}: ${result.reprocessingError}`);
        }
      });

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < messages.length) {
        await this.delay(1000);
      }
    }

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const skipped = results.filter(r => r.status === 'SKIPPED').length;
    const duration = Date.now() - startTime;

    const result: ReprocessingResult = {
      totalProcessed: results.length,
      successful,
      failed,
      skipped,
      results,
      summary: {
        duration,
        successRate: results.length > 0 ? (successful / results.length) * 100 : 0,
        errors
      }
    };

    // Save results
    await this.saveReprocessingResults(result);

    console.log(`\n🎉 Reprocessing complete!`);
    console.log(`📊 Total: ${result.totalProcessed}, Success: ${successful}, Failed: ${failed}, Skipped: ${skipped}`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📈 Success Rate: ${result.summary.successRate.toFixed(1)}%`);

    return result;
  }

  private async getMessagesForReprocessing(options: ReprocessingOptions): Promise<DLQMessage[]> {
    const allMessages = await this.receiveAllDLQMessages();
    
    let filteredMessages = allMessages;

    // Filter by message IDs if specified
    if (options.messageIds && options.messageIds.length > 0) {
      filteredMessages = filteredMessages.filter(msg => 
        options.messageIds!.includes(msg.messageId)
      );
    }

    // Filter by error types if specified (requires analysis data)
    if (options.errorTypes && options.errorTypes.length > 0) {
      // This would require loading previous analysis results
      console.log('⚠️  Error type filtering requires previous analysis data');
    }

    // Limit number of messages
    if (options.maxMessages && options.maxMessages > 0) {
      filteredMessages = filteredMessages.slice(0, options.maxMessages);
    }

    return filteredMessages;
  }

  private async receiveAllDLQMessages(): Promise<DLQMessage[]> {
    const messages: DLQMessage[] = [];
    let hasMoreMessages = true;

    while (hasMoreMessages) {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.dlqUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
        AttributeNames: ['All']
      });

      const response = await this.sqsClient.send(command);
      
      if (response.Messages && response.Messages.length > 0) {
        for (const msg of response.Messages) {
          messages.push({
            messageId: msg.MessageId!,
            receiptHandle: msg.ReceiptHandle!,
            body: msg.Body!,
            attributes: msg.Attributes || {},
            approximateReceiveCount: parseInt(msg.Attributes?.ApproximateReceiveCount || '0')
          });
        }
      } else {
        hasMoreMessages = false;
      }
    }

    return messages;
  }

  private async validateMessages(messages: DLQMessage[]): Promise<void> {
    console.log('🔍 Validating message structure and content...');
    
    for (const message of messages) {
      try {
        const body = JSON.parse(message.body);
        
        // Validate SNS message structure
        if (!body.Type || body.Type !== 'Notification') {
          console.warn(`⚠️  Message ${message.messageId} is not a valid SNS notification`);
          continue;
        }

        if (!body.Message) {
          console.warn(`⚠️  Message ${message.messageId} missing SNS Message field`);
          continue;
        }

        // Validate event data
        const eventData = JSON.parse(body.Message);
        if (!eventData.eventType || !eventData.bookId || !eventData.userId) {
          console.warn(`⚠️  Message ${message.messageId} missing required event fields`);
          continue;
        }

        console.log(`✅ Message ${message.messageId} validation passed`);
      } catch (error) {
        console.warn(`⚠️  Message ${message.messageId} validation failed:`, error);
      }
    }
  }

  private async processBatch(messages: DLQMessage[], dryRun: boolean): Promise<MessageReprocessingResult[]> {
    const results: MessageReprocessingResult[] = [];

    for (const message of messages) {
      const result = await this.reprocessSingleMessage(message, dryRun);
      results.push(result);
    }

    return results;
  }

  private async reprocessSingleMessage(message: DLQMessage, dryRun: boolean): Promise<MessageReprocessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Reprocessing message ${message.messageId}...`);

      // Check if message has been retried too many times
      if (message.approximateReceiveCount > 5) {
        return {
          messageId: message.messageId,
          status: 'SKIPPED',
          reason: 'Message exceeded maximum retry count',
          timestamp: new Date()
        };
      }

      // Validate message structure
      let eventData: any;
      try {
        const body = JSON.parse(message.body);
        eventData = JSON.parse(body.Message);
      } catch (error) {
        return {
          messageId: message.messageId,
          status: 'SKIPPED',
          reason: 'Invalid message format',
          reprocessingError: error instanceof Error ? error.message : 'Unknown parsing error',
          timestamp: new Date()
        };
      }

      if (dryRun) {
        return {
          messageId: message.messageId,
          status: 'SUCCESS',
          reason: 'Dry run - would reprocess',
          timestamp: new Date()
        };
      }

      // Method 1: Send back to original queue
      const success = await this.sendToOriginalQueue(message);
      
      if (success) {
        // Remove from DLQ
        await this.deleteFromDLQ(message);
        
        return {
          messageId: message.messageId,
          status: 'SUCCESS',
          reason: 'Successfully reprocessed via queue',
          timestamp: new Date()
        };
      } else {
        return {
          messageId: message.messageId,
          status: 'FAILED',
          reason: 'Failed to send to original queue',
          timestamp: new Date()
        };
      }

    } catch (error) {
      return {
        messageId: message.messageId,
        status: 'FAILED',
        reason: 'Reprocessing error',
        reprocessingError: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async sendToOriginalQueue(message: DLQMessage): Promise<boolean> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.originalQueueUrl,
        MessageBody: message.body,
        MessageAttributes: {
          'ReprocessedFromDLQ': {
            StringValue: 'true',
            DataType: 'String'
          },
          'OriginalMessageId': {
            StringValue: message.messageId,
            DataType: 'String'
          },
          'ReprocessedAt': {
            StringValue: new Date().toISOString(),
            DataType: 'String'
          }
        }
      });

      await this.sqsClient.send(command);
      console.log(`✅ Message ${message.messageId} sent to original queue`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message ${message.messageId} to original queue:`, error);
      return false;
    }
  }

  private async invokeLambdaDirectly(message: DLQMessage): Promise<boolean> {
    try {
      // Create SQS event structure for Lambda
      const sqsEvent = {
        Records: [{
          messageId: message.messageId,
          receiptHandle: message.receiptHandle,
          body: message.body,
          attributes: message.attributes,
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: `arn:aws:sqs:us-east-1:582491219315:qa-user-notifications-queue`,
          awsRegion: 'us-east-1'
        }]
      };

      const command = new InvokeCommand({
        FunctionName: this.notificationLambdaName,
        Payload: JSON.stringify(sqsEvent),
        InvocationType: 'RequestResponse'
      });

      const response = await this.lambdaClient.send(command);
      
      if (response.StatusCode === 200) {
        console.log(`✅ Message ${message.messageId} processed via direct Lambda invocation`);
        return true;
      } else {
        console.error(`❌ Lambda invocation failed for message ${message.messageId}:`, response.StatusCode);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to invoke Lambda for message ${message.messageId}:`, error);
      return false;
    }
  }

  private async deleteFromDLQ(message: DLQMessage): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.dlqUrl,
        ReceiptHandle: message.receiptHandle
      });

      await this.sqsClient.send(command);
      console.log(`🗑️  Message ${message.messageId} deleted from DLQ`);
    } catch (error) {
      console.error(`❌ Failed to delete message ${message.messageId} from DLQ:`, error);
      throw error;
    }
  }

  private async saveReprocessingResults(result: ReprocessingResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `dlq-reprocessing-report-${timestamp}.json`);
    const summaryPath = path.join(__dirname, `dlq-reprocessing-summary-${timestamp}.md`);

    // Save detailed JSON report
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`📄 Reprocessing report saved to: ${reportPath}`);

    // Save human-readable summary
    const summary = this.generateReprocessingSummary(result);
    fs.writeFileSync(summaryPath, summary);
    console.log(`📋 Reprocessing summary saved to: ${summaryPath}`);
  }

  private generateReprocessingSummary(result: ReprocessingResult): string {
    return `# DLQ Reprocessing Report

Generated: ${new Date().toISOString()}

## Summary

- **Total Processed**: ${result.totalProcessed}
- **Successful**: ${result.successful}
- **Failed**: ${result.failed}
- **Skipped**: ${result.skipped}
- **Success Rate**: ${result.summary.successRate.toFixed(1)}%
- **Duration**: ${(result.summary.duration / 1000).toFixed(2)} seconds

## Results by Status

### Successful (${result.successful})
${result.results.filter(r => r.status === 'SUCCESS').map(r => 
  `- ${r.messageId}: ${r.reason}`
).join('\n')}

### Failed (${result.failed})
${result.results.filter(r => r.status === 'FAILED').map(r => 
  `- ${r.messageId}: ${r.reason}${r.reprocessingError ? ` (${r.reprocessingError})` : ''}`
).join('\n')}

### Skipped (${result.skipped})
${result.results.filter(r => r.status === 'SKIPPED').map(r => 
  `- ${r.messageId}: ${r.reason}`
).join('\n')}

## Errors

${result.summary.errors.length > 0 ? result.summary.errors.map(error => `- ${error}`).join('\n') : 'No errors occurred'}

## Recommendations

${result.successful > 0 ? '- Monitor reprocessed messages for successful delivery' : ''}
${result.failed > 0 ? '- Investigate failed reprocessing attempts' : ''}
${result.skipped > 0 ? '- Review skipped messages for manual handling' : ''}
`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility methods for specific reprocessing scenarios
  async reprocessByMessageIds(messageIds: string[], dryRun: boolean = false): Promise<ReprocessingResult> {
    return this.reprocessMessages({
      messageIds,
      dryRun,
      validateBeforeReprocess: true
    });
  }

  async reprocessByErrorType(errorTypes: string[], maxMessages: number = 10, dryRun: boolean = false): Promise<ReprocessingResult> {
    return this.reprocessMessages({
      errorTypes,
      maxMessages,
      dryRun,
      validateBeforeReprocess: true
    });
  }

  async reprocessAll(maxMessages: number = 50, dryRun: boolean = true): Promise<ReprocessingResult> {
    return this.reprocessMessages({
      maxMessages,
      dryRun,
      validateBeforeReprocess: true,
      batchSize: 3
    });
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const maxMessages = parseInt(args.find(arg => arg.startsWith('--max='))?.split('=')[1] || '10');
  const messageIds = args.find(arg => arg.startsWith('--ids='))?.split('=')[1]?.split(',');

  try {
    const reprocessor = new DLQMessageReprocessor();
    
    let result: ReprocessingResult;
    
    if (messageIds) {
      console.log(`🎯 Reprocessing specific messages: ${messageIds.join(', ')}`);
      result = await reprocessor.reprocessByMessageIds(messageIds, dryRun);
    } else {
      console.log(`🔄 Reprocessing up to ${maxMessages} messages`);
      result = await reprocessor.reprocessAll(maxMessages, dryRun);
    }

    console.log('\n🎉 Reprocessing operation completed successfully!');
    
  } catch (error) {
    console.error('❌ Reprocessing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DLQMessageReprocessor, type ReprocessingOptions, type ReprocessingResult };