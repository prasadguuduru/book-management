/**
 * Integration Tests for DLQ Message Handling and Reprocessing
 * 
 * These tests verify the complete DLQ workflow:
 * 1. Message analysis and categorization
 * 2. Selective reprocessing capabilities
 * 3. Monitoring and alerting functionality
 * 4. End-to-end error recovery scenarios
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, PurgeQueueCommand } from '@aws-sdk/client-sqs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DLQAnalyzer } from '../debug/dlq-analysis-comprehensive';
import { DLQMessageReprocessor } from '../debug/dlq-message-reprocessor';
import { DLQMonitor, createDLQMonitor } from '../../shared/monitoring/dlq-monitoring';

// Test configuration
const TEST_CONFIG = {
  region: process.env['AWS_REGION'] || 'us-east-1',
  dlqUrl: process.env['TEST_DLQ_URL'] || 'http://localhost:4566/000000000000/test-dlq',
  originalQueueUrl: process.env['TEST_QUEUE_URL'] || 'http://localhost:4566/000000000000/test-queue',
  lambdaName: process.env['TEST_LAMBDA_NAME'] || 'test-notification-service'
};

describe('DLQ Message Handling Integration Tests', () => {
  let sqsClient: SQSClient;
  let lambdaClient: LambdaClient;
  let dlqAnalyzer: DLQAnalyzer;
  let dlqReprocessor: DLQMessageReprocessor;
  let dlqMonitor: DLQMonitor;

  beforeAll(async () => {
    sqsClient = new SQSClient({ 
      region: TEST_CONFIG.region,
      endpoint: process.env['LOCALSTACK_ENDPOINT'] || undefined
    });
    
    lambdaClient = new LambdaClient({ 
      region: TEST_CONFIG.region,
      endpoint: process.env['LOCALSTACK_ENDPOINT'] || undefined
    });

    // Initialize test components
    dlqAnalyzer = new DLQAnalyzer();
    dlqReprocessor = new DLQMessageReprocessor();
    dlqMonitor = createDLQMonitor('local');
  });

  beforeEach(async () => {
    // Clean up DLQ before each test
    try {
      await sqsClient.send(new PurgeQueueCommand({ QueueUrl: TEST_CONFIG.dlqUrl }));
    } catch (error) {
      console.warn('Could not purge DLQ (may not exist):', error);
    }
  });

  afterAll(async () => {
    // Clean up after all tests
    try {
      await sqsClient.send(new PurgeQueueCommand({ QueueUrl: TEST_CONFIG.dlqUrl }));
    } catch (error) {
      console.warn('Could not purge DLQ during cleanup:', error);
    }
  });

  describe('DLQ Analysis', () => {
    test('should analyze empty DLQ correctly', async () => {
      const report = await dlqAnalyzer.analyzeDLQ();
      
      expect(report.totalMessages).toBe(0);
      expect(report.reprocessableCount).toBe(0);
      expect(report.nonReprocessableCount).toBe(0);
      expect(report.messagesByErrorType).toEqual({});
      expect(report.recommendations).toContain('DLQ is empty - no action needed');
    });

    test('should categorize messages with event detection errors', async () => {
      // Send a malformed message to DLQ
      const malformedMessage = {
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: 'test-book-123',
          // Missing userId - should cause validation error
          timestamp: new Date().toISOString()
        })
      };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: TEST_CONFIG.dlqUrl,
        MessageBody: JSON.stringify(malformedMessage)
      }));

      const report = await dlqAnalyzer.analyzeDLQ();
      
      expect(report.totalMessages).toBe(1);
      expect(report.messagesByErrorType['INVALID_EVENT_DATA']).toBe(1);
      expect(report.nonReprocessableCount).toBe(1);
      expect(report.recommendations).toContain('Investigate SNS message publishing to ensure proper format');
    });

    test('should identify reprocessable messages', async () => {
      // Send a valid message that should be reprocessable
      const validMessage = {
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: 'test-book-123',
          userId: 'test-user-456',
          timestamp: new Date().toISOString(),
          metadata: {
            bookTitle: 'Test Book',
            authorName: 'Test Author',
            newStatus: 'published'
          }
        })
      };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: TEST_CONFIG.dlqUrl,
        MessageBody: JSON.stringify(validMessage)
      }));

      const report = await dlqAnalyzer.analyzeDLQ();
      
      expect(report.totalMessages).toBe(1);
      expect(report.reprocessableCount).toBe(1);
      expect(report.recommendations).toContain('1 messages can be reprocessed after fixes are deployed');
    });

    test('should generate comprehensive analysis report', async () => {
      // Send multiple different types of messages
      const messages = [
        {
          Type: 'Notification',
          Message: JSON.stringify({
            eventType: 'BOOK_PUBLISHED',
            bookId: 'book-1',
            userId: 'user-1',
            timestamp: new Date().toISOString()
          })
        },
        {
          Type: 'Invalid',
          Message: 'not-json'
        },
        {
          Type: 'Notification',
          Message: JSON.stringify({
            eventType: 'BOOK_APPROVED',
            // Missing required fields
            timestamp: new Date().toISOString()
          })
        }
      ];

      for (const message of messages) {
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: TEST_CONFIG.dlqUrl,
          MessageBody: JSON.stringify(message)
        }));
      }

      const report = await dlqAnalyzer.analyzeDLQ();
      
      expect(report.totalMessages).toBe(3);
      expect(report.detailedAnalysis).toHaveLength(3);
      expect(report.summary.criticalIssues.length).toBeGreaterThan(0);
      expect(report.summary.suggestedActions).toContain('Deploy fixes for event detection logic');
    });
  });

  describe('Message Reprocessing', () => {
    test('should reprocess valid messages successfully', async () => {
      // Send a valid message to DLQ
      const validMessage = {
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: 'test-book-123',
          userId: 'test-user-456',
          timestamp: new Date().toISOString(),
          metadata: {
            bookTitle: 'Test Book',
            authorName: 'Test Author',
            newStatus: 'published'
          }
        })
      };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: TEST_CONFIG.dlqUrl,
        MessageBody: JSON.stringify(validMessage)
      }));

      // Reprocess messages (dry run first)
      const dryRunResult = await dlqReprocessor.reprocessAll(10, true);
      
      expect(dryRunResult.totalProcessed).toBe(1);
      expect(dryRunResult.successful).toBe(1);
      expect(dryRunResult.failed).toBe(0);
      expect(dryRunResult.results[0].status).toBe('SUCCESS');
      expect(dryRunResult.results[0].reason).toBe('Dry run - would reprocess');
    });

    test('should skip messages that exceed retry count', async () => {
      // Send a message with high receive count
      const messageWithHighRetryCount = {
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: 'test-book-123',
          userId: 'test-user-456',
          timestamp: new Date().toISOString()
        })
      };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: TEST_CONFIG.dlqUrl,
        MessageBody: JSON.stringify(messageWithHighRetryCount),
        MessageAttributes: {
          'ApproximateReceiveCount': {
            StringValue: '10',
            DataType: 'String'
          }
        }
      }));

      const result = await dlqReprocessor.reprocessAll(10, true);
      
      expect(result.totalProcessed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.results[0].status).toBe('SKIPPED');
      expect(result.results[0].reason).toContain('exceeded maximum retry count');
    });

    test('should handle reprocessing errors gracefully', async () => {
      // Send an invalid message
      const invalidMessage = {
        Type: 'Invalid',
        Message: 'not-valid-json'
      };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: TEST_CONFIG.dlqUrl,
        MessageBody: JSON.stringify(invalidMessage)
      }));

      const result = await dlqReprocessor.reprocessAll(10, true);
      
      expect(result.totalProcessed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.results[0].status).toBe('SKIPPED');
      expect(result.results[0].reason).toBe('Invalid message format');
    });

    test('should reprocess specific messages by ID', async () => {
      // Send multiple messages
      const messages = [
        {
          Type: 'Notification',
          Message: JSON.stringify({
            eventType: 'BOOK_PUBLISHED',
            bookId: 'book-1',
            userId: 'user-1',
            timestamp: new Date().toISOString()
          })
        },
        {
          Type: 'Notification',
          Message: JSON.stringify({
            eventType: 'BOOK_APPROVED',
            bookId: 'book-2',
            userId: 'user-2',
            timestamp: new Date().toISOString()
          })
        }
      ];

      const messageIds: string[] = [];
      for (const message of messages) {
        const response = await sqsClient.send(new SendMessageCommand({
          QueueUrl: TEST_CONFIG.dlqUrl,
          MessageBody: JSON.stringify(message)
        }));
        if (response.MessageId) {
          messageIds.push(response.MessageId);
        }
      }

      // Reprocess only the first message
      const result = await dlqReprocessor.reprocessByMessageIds([messageIds[0]], true);
      
      expect(result.totalProcessed).toBe(1);
      expect(result.successful).toBe(1);
    });

    test('should generate detailed reprocessing reports', async () => {
      // Send a valid message
      const validMessage = {
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: 'test-book-123',
          userId: 'test-user-456',
          timestamp: new Date().toISOString()
        })
      };

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: TEST_CONFIG.dlqUrl,
        MessageBody: JSON.stringify(validMessage)
      }));

      const result = await dlqReprocessor.reprocessAll(10, true);
      
      expect(result.summary).toBeDefined();
      expect(result.summary.duration).toBeGreaterThan(0);
      expect(result.summary.successRate).toBe(100);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('DLQ Monitoring', () => {
    test('should collect DLQ metrics correctly', async () => {
      // Send some messages to DLQ
      const messages = [
        { Type: 'Notification', Message: JSON.stringify({ eventType: 'BOOK_PUBLISHED', bookId: 'book-1', userId: 'user-1' }) },
        { Type: 'Notification', Message: JSON.stringify({ eventType: 'BOOK_APPROVED', bookId: 'book-2', userId: 'user-2' }) }
      ];

      for (const message of messages) {
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: TEST_CONFIG.dlqUrl,
          MessageBody: JSON.stringify(message)
        }));
      }

      const metrics = await dlqMonitor.collectAndPublishMetrics();
      
      expect(metrics.messageCount).toBe(2);
      expect(metrics.queueName).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.oldestMessageAge).toBeGreaterThanOrEqual(0);
    });

    test('should generate health status correctly', async () => {
      const healthStatus = await dlqMonitor.getHealthStatus();
      
      expect(healthStatus.status).toMatch(/^(HEALTHY|WARNING|CRITICAL)$/);
      expect(healthStatus.metrics).toBeDefined();
      expect(healthStatus.alerts).toBeInstanceOf(Array);
    });

    test('should provide dashboard data', async () => {
      const dashboardData = await dlqMonitor.getDashboardData();
      
      expect(dashboardData.currentMetrics).toBeDefined();
      expect(dashboardData.historicalData).toBeInstanceOf(Array);
      expect(dashboardData.alerts).toBeInstanceOf(Array);
      expect(dashboardData.recommendations).toBeInstanceOf(Array);
    });

    test('should detect message accumulation alerts', async () => {
      // Send many messages to trigger alert
      const messages = Array(15).fill(null).map((_, i) => ({
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: `book-${i}`,
          userId: `user-${i}`,
          timestamp: new Date().toISOString()
        })
      }));

      for (const message of messages) {
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: TEST_CONFIG.dlqUrl,
          MessageBody: JSON.stringify(message)
        }));
      }

      const healthStatus = await dlqMonitor.getHealthStatus();
      
      expect(healthStatus.status).toMatch(/^(WARNING|CRITICAL)$/);
      expect(healthStatus.alerts.length).toBeGreaterThan(0);
      expect(healthStatus.alerts.some(alert => alert.alertType === 'MESSAGE_ACCUMULATION')).toBe(true);
    });
  });

  describe('End-to-End Error Recovery', () => {
    test('should handle complete error recovery workflow', async () => {
      // 1. Send problematic messages to DLQ
      const problematicMessages = [
        {
          Type: 'Notification',
          Message: JSON.stringify({
            eventType: 'BOOK_PUBLISHED',
            bookId: 'book-1',
            userId: 'user-1',
            timestamp: new Date().toISOString()
          })
        },
        {
          Type: 'Invalid',
          Message: 'malformed-data'
        }
      ];

      for (const message of problematicMessages) {
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: TEST_CONFIG.dlqUrl,
          MessageBody: JSON.stringify(message)
        }));
      }

      // 2. Analyze DLQ
      const analysisReport = await dlqAnalyzer.analyzeDLQ();
      expect(analysisReport.totalMessages).toBe(2);
      expect(analysisReport.reprocessableCount).toBe(1);
      expect(analysisReport.nonReprocessableCount).toBe(1);

      // 3. Monitor DLQ health
      const healthStatus = await dlqMonitor.getHealthStatus();
      expect(healthStatus.status).toMatch(/^(WARNING|CRITICAL)$/);

      // 4. Reprocess reprocessable messages
      const reprocessingResult = await dlqReprocessor.reprocessAll(10, true);
      expect(reprocessingResult.totalProcessed).toBe(2);
      expect(reprocessingResult.successful).toBe(1); // Only valid message in dry run
      expect(reprocessingResult.skipped).toBe(1);    // Invalid message skipped

      // 5. Verify recommendations
      expect(analysisReport.recommendations).toContain('1 messages can be reprocessed after fixes are deployed');
      expect(analysisReport.recommendations).toContain('1 messages should be purged as they cannot be reprocessed');
    });

    test('should handle batch reprocessing with mixed results', async () => {
      // Send a mix of valid and invalid messages
      const mixedMessages = [
        // Valid messages
        ...Array(3).fill(null).map((_, i) => ({
          Type: 'Notification',
          Message: JSON.stringify({
            eventType: 'BOOK_PUBLISHED',
            bookId: `book-${i}`,
            userId: `user-${i}`,
            timestamp: new Date().toISOString()
          })
        })),
        // Invalid messages
        { Type: 'Invalid', Message: 'bad-data-1' },
        { Type: 'Invalid', Message: 'bad-data-2' }
      ];

      for (const message of mixedMessages) {
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: TEST_CONFIG.dlqUrl,
          MessageBody: JSON.stringify(message)
        }));
      }

      // Analyze and reprocess
      const analysisReport = await dlqAnalyzer.analyzeDLQ();
      expect(analysisReport.totalMessages).toBe(5);
      expect(analysisReport.reprocessableCount).toBe(3);
      expect(analysisReport.nonReprocessableCount).toBe(2);

      const reprocessingResult = await dlqReprocessor.reprocessAll(10, true);
      expect(reprocessingResult.totalProcessed).toBe(5);
      expect(reprocessingResult.successful).toBe(3);
      expect(reprocessingResult.skipped).toBe(2);
      expect(reprocessingResult.summary.successRate).toBe(60); // 3/5 = 60%
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle large number of messages efficiently', async () => {
      const messageCount = 50;
      const messages = Array(messageCount).fill(null).map((_, i) => ({
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: `book-${i}`,
          userId: `user-${i}`,
          timestamp: new Date().toISOString()
        })
      }));

      const startTime = Date.now();

      // Send messages in batches
      const batchSize = 10;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        await Promise.all(batch.map(message =>
          sqsClient.send(new SendMessageCommand({
            QueueUrl: TEST_CONFIG.dlqUrl,
            MessageBody: JSON.stringify(message)
          }))
        ));
      }

      const sendDuration = Date.now() - startTime;
      console.log(`Sent ${messageCount} messages in ${sendDuration}ms`);

      // Analyze performance
      const analysisStartTime = Date.now();
      const analysisReport = await dlqAnalyzer.analyzeDLQ();
      const analysisDuration = Date.now() - analysisStartTime;

      expect(analysisReport.totalMessages).toBe(messageCount);
      expect(analysisDuration).toBeLessThan(30000); // Should complete within 30 seconds
      console.log(`Analyzed ${messageCount} messages in ${analysisDuration}ms`);

      // Reprocessing performance (dry run)
      const reprocessingStartTime = Date.now();
      const reprocessingResult = await dlqReprocessor.reprocessAll(messageCount, true);
      const reprocessingDuration = Date.now() - reprocessingStartTime;

      expect(reprocessingResult.totalProcessed).toBe(messageCount);
      expect(reprocessingDuration).toBeLessThan(60000); // Should complete within 60 seconds
      console.log(`Reprocessed ${messageCount} messages in ${reprocessingDuration}ms`);
    });

    test('should handle concurrent operations safely', async () => {
      // Send some messages
      const messages = Array(10).fill(null).map((_, i) => ({
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: 'BOOK_PUBLISHED',
          bookId: `book-${i}`,
          userId: `user-${i}`,
          timestamp: new Date().toISOString()
        })
      }));

      for (const message of messages) {
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: TEST_CONFIG.dlqUrl,
          MessageBody: JSON.stringify(message)
        }));
      }

      // Run analysis and monitoring concurrently
      const [analysisReport, healthStatus, dashboardData] = await Promise.all([
        dlqAnalyzer.analyzeDLQ(),
        dlqMonitor.getHealthStatus(),
        dlqMonitor.getDashboardData()
      ]);

      expect(analysisReport.totalMessages).toBe(10);
      expect(healthStatus.metrics.messageCount).toBe(10);
      expect(dashboardData.currentMetrics.messageCount).toBe(10);
    });
  });
});

// Helper function to wait for async operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}