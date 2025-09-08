/**
 * Tests for Performance Monitor
 */

import { PerformanceMonitor } from '../performance-monitor';
import { EventProcessingLogger } from '../structured-logger';
import { cloudWatchMetrics } from '../../../notification-service/services/cloudwatch-metrics';

// Mock dependencies
jest.mock('../structured-logger');
jest.mock('../../../notification-service/services/cloudwatch-metrics', () => ({
  cloudWatchMetrics: {
    recordNotificationSuccess: jest.fn(),
    recordNotificationFailure: jest.fn(),
    recordEmailDeliveryMetrics: jest.fn(),
    recordBatchProcessingMetrics: jest.fn()
  }
}));

const mockEventProcessingLogger = EventProcessingLogger as jest.Mocked<typeof EventProcessingLogger>;
const mockCloudWatchMetrics = {
  recordNotificationSuccess: jest.fn(),
  recordNotificationFailure: jest.fn(),
  recordEmailDeliveryMetrics: jest.fn(),
  recordBatchProcessingMetrics: jest.fn()
};

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock timer
    mockEventProcessingLogger.createTimer.mockReturnValue({
      start: Date.now(),
      stop: jest.fn().mockReturnValue(1500),
      elapsed: jest.fn().mockReturnValue(1500)
    });

    performanceMonitor = new PerformanceMonitor();
  });

  const mockContext = {
    requestId: 'test-request-123',
    eventId: 'event-456',
    bookId: 'book-abc',
    notificationType: 'submitted_to_approved'
  };

  describe('monitorEventProcessing', () => {
    it('should monitor successful event processing', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await performanceMonitor.monitorEventProcessing(mockOperation, mockContext);

      expect(result).toBe('success');
      expect(mockEventProcessingLogger.logEventProcessingStart).toHaveBeenCalledWith(mockContext);
      expect(mockEventProcessingLogger.logEventProcessingSuccess).toHaveBeenCalledWith({
        ...mockContext,
        processingTimeMs: 1500
      });
      expect(mockCloudWatchMetrics.recordNotificationSuccess).toHaveBeenCalledWith('submitted_to_approved', 1500);
    });

    it('should monitor failed event processing', async () => {
      const error = new Error('Processing failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(performanceMonitor.monitorEventProcessing(mockOperation, mockContext))
        .rejects.toThrow('Processing failed');

      expect(mockEventProcessingLogger.logEventProcessingFailure).toHaveBeenCalledWith(error, {
        ...mockContext,
        processingTimeMs: 1500
      });
      expect(mockCloudWatchMetrics.recordNotificationFailure).toHaveBeenCalledWith('submitted_to_approved', 'Error', 1500);
    });

    it('should check performance thresholds for slow processing', async () => {
      // Mock slow processing time
      mockEventProcessingLogger.createTimer.mockReturnValue({
        start: Date.now(),
        stop: jest.fn().mockReturnValue(8000), // 8 seconds - slow
        elapsed: jest.fn().mockReturnValue(8000)
      });

      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await performanceMonitor.monitorEventProcessing(mockOperation, mockContext);

      expect(mockEventProcessingLogger.logPerformanceWarning).toHaveBeenCalledWith({
        ...mockContext,
        operation: 'EVENT_PROCESSING',
        processingTimeMs: 8000,
        threshold: 'WARNING',
        thresholdValue: 5000,
        severity: 'WARNING'
      });
    });

    it('should check performance thresholds for critical processing', async () => {
      // Mock critical processing time
      mockEventProcessingLogger.createTimer.mockReturnValue({
        start: Date.now(),
        stop: jest.fn().mockReturnValue(35000), // 35 seconds - critical
        elapsed: jest.fn().mockReturnValue(35000)
      });

      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await performanceMonitor.monitorEventProcessing(mockOperation, mockContext);

      expect(mockEventProcessingLogger.logPerformanceWarning).toHaveBeenCalledWith({
        ...mockContext,
        operation: 'EVENT_PROCESSING',
        processingTimeMs: 35000,
        threshold: 'CRITICAL',
        thresholdValue: 30000,
        severity: 'CRITICAL'
      });
    });
  });

  describe('monitorEmailDelivery', () => {
    it('should monitor successful email delivery', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ messageId: 'ses-123' });
      
      const result = await performanceMonitor.monitorEmailDelivery(mockOperation, mockContext);

      expect(result).toEqual({ messageId: 'ses-123' });
      expect(mockEventProcessingLogger.logEmailDeliveryAttempt).toHaveBeenCalledWith(mockContext);
      expect(mockEventProcessingLogger.logEmailDeliverySuccess).toHaveBeenCalledWith({
        ...mockContext,
        emailDeliveryTimeMs: 1500
      });
      expect(mockCloudWatchMetrics.recordEmailDeliveryMetrics).toHaveBeenCalledWith('submitted_to_approved', 'sent', 1500);
    });

    it('should monitor failed email delivery', async () => {
      const error = new Error('SES delivery failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(performanceMonitor.monitorEmailDelivery(mockOperation, mockContext))
        .rejects.toThrow('SES delivery failed');

      expect(mockEventProcessingLogger.logEmailDeliveryFailure).toHaveBeenCalledWith(error, {
        ...mockContext,
        emailDeliveryTimeMs: 1500
      });
      expect(mockCloudWatchMetrics.recordEmailDeliveryMetrics).toHaveBeenCalledWith('submitted_to_approved', 'failed', 1500, 'Error');
    });
  });

  describe('monitorBatchProcessing', () => {
    it('should monitor successful batch processing', async () => {
      const batchContext = {
        ...mockContext,
        batchSize: 10,
        successCount: 8,
        failureCount: 2
      };
      
      const mockOperation = jest.fn().mockResolvedValue('batch complete');
      
      const result = await performanceMonitor.monitorBatchProcessing(mockOperation, batchContext);

      expect(result).toBe('batch complete');
      expect(mockEventProcessingLogger.logBatchProcessingMetrics).toHaveBeenCalledWith({
        ...batchContext,
        processingTimeMs: 1500
      });
      expect(mockCloudWatchMetrics.recordBatchProcessingMetrics).toHaveBeenCalledWith(10, 8, 2, 1500);
    });

    it('should monitor failed batch processing', async () => {
      const error = new Error('Batch processing failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(performanceMonitor.monitorBatchProcessing(mockOperation, mockContext))
        .rejects.toThrow('Batch processing failed');
    });
  });

  describe('monitorSNSPublishing', () => {
    it('should monitor successful SNS publishing', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ MessageId: 'sns-123' });
      
      const result = await performanceMonitor.monitorSNSPublishing(mockOperation, mockContext);

      expect(result).toEqual({ MessageId: 'sns-123' });
      expect(mockEventProcessingLogger.logSNSPublishAttempt).toHaveBeenCalledWith(mockContext);
      expect(mockEventProcessingLogger.logSNSPublishSuccess).toHaveBeenCalledWith({
        ...mockContext,
        snsPublishingTimeMs: 1500
      });
    });

    it('should monitor failed SNS publishing', async () => {
      const error = new Error('SNS publish failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(performanceMonitor.monitorSNSPublishing(mockOperation, mockContext))
        .rejects.toThrow('SNS publish failed');

      expect(mockEventProcessingLogger.logSNSPublishFailure).toHaveBeenCalledWith(error, {
        ...mockContext,
        snsPublishingTimeMs: 1500
      });
    });
  });

  describe('monitorSystemHealth', () => {
    it('should monitor system health and log metrics', async () => {
      // Mock process methods
      const originalMemoryUsage = process.memoryUsage;
      const originalUptime = process.uptime;
      const originalCpuUsage = process.cpuUsage;

      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50000000,
        heapTotal: 100000000,
        rss: 80000000,
        external: 5000000
      });
      (process as any).uptime = jest.fn().mockReturnValue(3600);
      (process as any).cpuUsage = jest.fn().mockReturnValue({
        user: 1000000,
        system: 500000
      });

      await performanceMonitor.monitorSystemHealth();

      expect(mockEventProcessingLogger.logSystemHealthMetrics).toHaveBeenCalledWith({
        operation: 'SYSTEM_HEALTH_CHECK',
        memoryUsageHeapUsed: 50000000,
        memoryUsageHeapTotal: 100000000,
        memoryUsageRSS: 80000000,
        memoryUsageExternal: 5000000,
        uptimeSeconds: 3600,
        cpuUserTime: 1000000,
        cpuSystemTime: 500000
      });

      // Restore original methods
      process.memoryUsage = originalMemoryUsage;
      process.uptime = originalUptime;
      process.cpuUsage = originalCpuUsage;
    });

    it('should log high memory usage warning', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 95000000,  // 95% of heap
        heapTotal: 100000000,
        rss: 120000000,
        external: 5000000
      });

      await performanceMonitor.monitorSystemHealth();

      // Should log high memory usage warning
      expect(mockEventProcessingLogger.logSystemHealthMetrics).toHaveBeenCalled();

      // Restore original method
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('threshold management', () => {
    it('should return current thresholds', () => {
      const thresholds = performanceMonitor.getThresholds();
      
      expect(thresholds).toHaveProperty('eventProcessing');
      expect(thresholds).toHaveProperty('emailDelivery');
      expect(thresholds).toHaveProperty('batchProcessing');
      expect(thresholds).toHaveProperty('snsPublishing');
    });

    it('should update thresholds', () => {
      const newThresholds = {
        eventProcessing: {
          warning: 3000,
          critical: 15000
        }
      };

      performanceMonitor.updateThresholds(newThresholds);
      
      const updatedThresholds = performanceMonitor.getThresholds();
      expect(updatedThresholds.eventProcessing.warning).toBe(3000);
      expect(updatedThresholds.eventProcessing.critical).toBe(15000);
    });
  });

  describe('custom thresholds', () => {
    it('should initialize with custom thresholds', () => {
      const customThresholds = {
        eventProcessing: {
          warning: 2000,
          critical: 10000
        }
      };

      const customMonitor = new PerformanceMonitor(customThresholds);
      const thresholds = customMonitor.getThresholds();
      
      expect(thresholds.eventProcessing.warning).toBe(2000);
      expect(thresholds.eventProcessing.critical).toBe(10000);
    });
  });
});