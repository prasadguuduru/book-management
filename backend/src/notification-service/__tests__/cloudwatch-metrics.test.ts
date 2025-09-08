/**
 * Tests for CloudWatch Metrics Service
 */

import { CloudWatchMetricsService } from '../services/cloudwatch-metrics';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '../../utils/logger';

// Mock AWS SDK
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutMetricDataCommand: jest.fn().mockImplementation((params) => ({ input: params }))
}));
jest.mock('../../utils/logger');

const mockSend = jest.fn();

const MockCloudWatchClient = CloudWatchClient as jest.MockedClass<typeof CloudWatchClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('CloudWatchMetricsService', () => {
  let metricsService: CloudWatchMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the CloudWatch client constructor to return an object with send method
    MockCloudWatchClient.mockImplementation(() => ({
      send: mockSend
    } as any));
    
    mockSend.mockResolvedValue({});
    
    // Set environment variables
    process.env['AWS_REGION'] = 'us-east-1';
    process.env['ENVIRONMENT'] = 'test';
    
    metricsService = new CloudWatchMetricsService();
  });

  afterEach(() => {
    delete process.env['AWS_REGION'];
    delete process.env['ENVIRONMENT'];
  });

  describe('recordNotificationSuccess', () => {
    it('should record notification success metrics', async () => {
      await metricsService.recordNotificationSuccess('book_submitted', 1500);

      expect(mockSend).toHaveBeenCalledTimes(1);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.Namespace).toBe('EbookPlatform/Notifications/test');
      expect(call.input.MetricData).toHaveLength(2);
      
      // Check success metric
      const successMetric = call.input.MetricData[0];
      expect(successMetric.MetricName).toBe('NotificationProcessed');
      expect(successMetric.Value).toBe(1);
      expect(successMetric.Dimensions).toContainEqual({ Name: 'NotificationType', Value: 'book_submitted' });
      expect(successMetric.Dimensions).toContainEqual({ Name: 'Status', Value: 'Success' });
      
      // Check processing time metric
      const timeMetric = call.input.MetricData[1];
      expect(timeMetric.MetricName).toBe('NotificationProcessingTime');
      expect(timeMetric.Value).toBe(1500);
    });

    it('should handle CloudWatch errors gracefully', async () => {
      const error = new Error('CloudWatch error');
      mockSend.mockRejectedValue(error);

      await metricsService.recordNotificationSuccess('book_submitted', 1500);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ FAILED TO RECORD SUCCESS METRICS',
        error,
        expect.objectContaining({
          notificationType: 'book_submitted',
          processingTimeMs: 1500
        })
      );
    });
  });

  describe('recordNotificationFailure', () => {
    it('should record notification failure metrics', async () => {
      await metricsService.recordNotificationFailure('book_approved', 'ValidationError', 2500);

      expect(mockSend).toHaveBeenCalledTimes(1);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(3);
      
      // Check failure metric
      const failureMetric = call.input.MetricData[0];
      expect(failureMetric.MetricName).toBe('NotificationProcessed');
      expect(failureMetric.Dimensions).toContainEqual({ Name: 'Status', Value: 'Failed' });
      
      // Check error metric
      const errorMetric = call.input.MetricData[1];
      expect(errorMetric.MetricName).toBe('NotificationError');
      expect(errorMetric.Dimensions).toContainEqual({ Name: 'ErrorType', Value: 'ValidationError' });
    });
  });

  describe('recordBatchProcessingMetrics', () => {
    it('should record batch processing metrics with success rate', async () => {
      await metricsService.recordBatchProcessingMetrics(10, 8, 2, 5000);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(5);
      
      // Check success rate metric
      const successRateMetric = call.input.MetricData.find((m: any) => m.MetricName === 'SQSBatchSuccessRate');
      expect(successRateMetric).toBeDefined();
      expect(successRateMetric.Value).toBe(80); // 8/10 * 100
      expect(successRateMetric.Unit).toBe('Percent');
    });

    it('should handle zero total records', async () => {
      await metricsService.recordBatchProcessingMetrics(0, 0, 0, 1000);

      const call = mockSend.mock.calls[0][0];
      // Should not include success rate metric when total is 0
      const successRateMetric = call.input.MetricData.find((m: any) => m.MetricName === 'SQSBatchSuccessRate');
      expect(successRateMetric).toBeUndefined();
    });
  });

  describe('recordEmailDeliveryMetrics', () => {
    it('should record successful email delivery metrics', async () => {
      await metricsService.recordEmailDeliveryMetrics('book_published', 'sent', 800);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(2);
      
      const deliveryMetric = call.input.MetricData[0];
      expect(deliveryMetric.MetricName).toBe('EmailDelivery');
      expect(deliveryMetric.Dimensions).toContainEqual({ Name: 'DeliveryStatus', Value: 'sent' });
    });

    it('should record failed email delivery metrics with error type', async () => {
      await metricsService.recordEmailDeliveryMetrics('book_rejected', 'failed', 1200, 'SESError');

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(3);
      
      const errorMetric = call.input.MetricData[2];
      expect(errorMetric.MetricName).toBe('EmailDeliveryError');
      expect(errorMetric.Dimensions).toContainEqual({ Name: 'ErrorType', Value: 'SESError' });
    });
  });

  describe('recordDLQMessage', () => {
    it('should record DLQ message metrics', async () => {
      await metricsService.recordDLQMessage('book_submitted', 'max_retries_exceeded');

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(1);
      
      const dlqMetric = call.input.MetricData[0];
      expect(dlqMetric.MetricName).toBe('DLQMessage');
      expect(dlqMetric.Dimensions).toContainEqual({ Name: 'Reason', Value: 'max_retries_exceeded' });
    });
  });

  describe('recordPerformanceAlert', () => {
    it('should record performance alert metrics', async () => {
      await metricsService.recordPerformanceAlert('EVENT_PROCESSING', 'CRITICAL', 35000, { bookId: 'book-123' });

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(2);
      
      const alertMetric = call.input.MetricData[0];
      expect(alertMetric.MetricName).toBe('PerformanceAlert');
      expect(alertMetric.Dimensions).toContainEqual({ Name: 'Operation', Value: 'EVENT_PROCESSING' });
      expect(alertMetric.Dimensions).toContainEqual({ Name: 'Severity', Value: 'CRITICAL' });
      
      const timeMetric = call.input.MetricData[1];
      expect(timeMetric.MetricName).toBe('PerformanceAlertProcessingTime');
      expect(timeMetric.Value).toBe(35000);
    });
  });

  describe('recordSystemHealthMetrics', () => {
    it('should record system health metrics', async () => {
      await metricsService.recordSystemHealthMetrics(75.5, 3600, 45.2);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(3);
      
      const memoryMetric = call.input.MetricData[0];
      expect(memoryMetric.MetricName).toBe('MemoryUsagePercent');
      expect(memoryMetric.Value).toBe(75.5);
      expect(memoryMetric.Unit).toBe('Percent');
      
      const uptimeMetric = call.input.MetricData[1];
      expect(uptimeMetric.MetricName).toBe('UptimeSeconds');
      expect(uptimeMetric.Value).toBe(3600);
      
      const cpuMetric = call.input.MetricData[2];
      expect(cpuMetric.MetricName).toBe('CPUUsagePercent');
      expect(cpuMetric.Value).toBe(45.2);
    });

    it('should record system health metrics without CPU usage', async () => {
      await metricsService.recordSystemHealthMetrics(60.0, 1800);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(2);
      
      const cpuMetric = call.input.MetricData.find((m: any) => m.MetricName === 'CPUUsagePercent');
      expect(cpuMetric).toBeUndefined();
    });
  });

  describe('recordQueueDepthMetrics', () => {
    it('should record queue depth metrics', async () => {
      await metricsService.recordQueueDepthMetrics('test-queue', 25, 5);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(2);
      
      const depthMetric = call.input.MetricData[0];
      expect(depthMetric.MetricName).toBe('QueueDepth');
      expect(depthMetric.Value).toBe(25);
      expect(depthMetric.Dimensions).toContainEqual({ Name: 'QueueName', Value: 'test-queue' });
      
      const inFlightMetric = call.input.MetricData[1];
      expect(inFlightMetric.MetricName).toBe('QueueInFlightMessages');
      expect(inFlightMetric.Value).toBe(5);
    });
  });

  describe('recordErrorRateMetrics', () => {
    it('should record error rate metrics', async () => {
      await metricsService.recordErrorRateMetrics('EMAIL_DELIVERY', 100, 5, 10);

      const call = mockSend.mock.calls[0][0];
      expect(call.input.MetricData).toHaveLength(3);
      
      const errorRateMetric = call.input.MetricData[0];
      expect(errorRateMetric.MetricName).toBe('ErrorRate');
      expect(errorRateMetric.Value).toBe(5); // 5/100 * 100 = 5%
      expect(errorRateMetric.Unit).toBe('Percent');
      expect(errorRateMetric.Dimensions).toContainEqual({ Name: 'TimeWindow', Value: '10min' });
    });

    it('should handle zero total requests', async () => {
      await metricsService.recordErrorRateMetrics('EMAIL_DELIVERY', 0, 0);

      const call = mockSend.mock.calls[0][0];
      const errorRateMetric = call.input.MetricData[0];
      expect(errorRateMetric.Value).toBe(0);
    });
  });

  describe('createTimer', () => {
    it('should create a timer that measures elapsed time', () => {
      const timer = metricsService.createTimer();
      
      expect(timer).toHaveProperty('stop');
      expect(typeof timer.stop).toBe('function');
    });

    it('should measure time correctly', async () => {
      const timer = metricsService.createTimer();
      
      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const elapsed = timer.stop();
      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(100); // Should be much less than 100ms
    });
  });

  describe('error handling', () => {
    it('should handle CloudWatch client errors gracefully', async () => {
      const error = new Error('AWS service error');
      mockSend.mockRejectedValue(error);

      // Should not throw, but should log error
      await metricsService.recordNotificationSuccess('test', 1000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ FAILED TO RECORD SUCCESS METRICS',
        error,
        expect.any(Object)
      );
    });

    it('should handle putMetrics errors', async () => {
      const error = new Error('PutMetricData failed');
      mockSend.mockRejectedValue(error);

      await metricsService.recordBatchProcessingMetrics(10, 8, 2, 5000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ FAILED TO RECORD BATCH METRICS',
        error,
        expect.any(Object)
      );
    });
  });

  describe('initialization', () => {
    it('should initialize with correct namespace and region', () => {
      expect(MockCloudWatchClient).toHaveBeenCalledWith({ region: 'us-east-1' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        '📊 CLOUDWATCH METRICS SERVICE INITIALIZED',
        expect.objectContaining({
          region: 'us-east-1',
          namespace: 'EbookPlatform/Notifications/test',
          environment: 'test'
        })
      );
    });

    it('should use default values when environment variables are not set', () => {
      delete process.env['AWS_REGION'];
      delete process.env['ENVIRONMENT'];
      
      new CloudWatchMetricsService();
      
      expect(MockCloudWatchClient).toHaveBeenCalledWith({ region: 'us-east-1' });
    });
  });
});