/**
 * Tests for Enhanced CloudWatch Metrics Service Features
 */

import { CloudWatchMetricsService } from '../services/cloudwatch-metrics';
import { logger } from '../../utils/logger';

// Mock AWS SDK and logger
jest.mock('@aws-sdk/client-cloudwatch');
jest.mock('../../utils/logger');

const mockLogger = logger as jest.Mocked<typeof logger>;

// Create mock functions
const mockSend = jest.fn();
const mockPutMetricDataCommand = jest.fn();

// Mock the CloudWatch client
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: mockSend
  })),
  PutMetricDataCommand: mockPutMetricDataCommand
}));

describe('CloudWatchMetricsService - Enhanced Features', () => {
  let metricsService: CloudWatchMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    mockPutMetricDataCommand.mockImplementation((input) => ({ input }));
    
    // Set environment variables
    process.env['AWS_REGION'] = 'us-east-1';
    process.env['ENVIRONMENT'] = 'test';
    
    metricsService = new CloudWatchMetricsService();
  });

  afterEach(() => {
    delete process.env['AWS_REGION'];
    delete process.env['ENVIRONMENT'];
  });

  describe('recordPerformanceAlert', () => {
    it('should record performance alert metrics', async () => {
      await metricsService.recordPerformanceAlert('EVENT_PROCESSING', 'CRITICAL', 35000, { bookId: 'book-123' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Namespace: 'EbookPlatform/Notifications/test',
            MetricData: expect.arrayContaining([
              expect.objectContaining({
                MetricName: 'PerformanceAlert',
                Value: 1,
                Dimensions: expect.arrayContaining([
                  { Name: 'Operation', Value: 'EVENT_PROCESSING' },
                  { Name: 'Severity', Value: 'CRITICAL' }
                ])
              }),
              expect.objectContaining({
                MetricName: 'PerformanceAlertProcessingTime',
                Value: 35000
              })
            ])
          })
        })
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '📊 PERFORMANCE ALERT METRICS RECORDED',
        expect.objectContaining({
          operation: 'EVENT_PROCESSING',
          severity: 'CRITICAL',
          processingTimeMs: 35000
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('CloudWatch error');
      mockSend.mockRejectedValue(error);

      await metricsService.recordPerformanceAlert('EVENT_PROCESSING', 'WARNING', 8000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ FAILED TO RECORD PERFORMANCE ALERT METRICS',
        error,
        expect.objectContaining({
          operation: 'EVENT_PROCESSING',
          severity: 'WARNING',
          processingTimeMs: 8000
        })
      );
    });
  });

  describe('recordSystemHealthMetrics', () => {
    it('should record system health metrics with all parameters', async () => {
      await metricsService.recordSystemHealthMetrics(75.5, 3600, 45.2);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MetricData: expect.arrayContaining([
              expect.objectContaining({
                MetricName: 'MemoryUsagePercent',
                Value: 75.5,
                Unit: 'Percent'
              }),
              expect.objectContaining({
                MetricName: 'UptimeSeconds',
                Value: 3600,
                Unit: 'Seconds'
              }),
              expect.objectContaining({
                MetricName: 'CPUUsagePercent',
                Value: 45.2,
                Unit: 'Percent'
              })
            ])
          })
        })
      );
    });

    it('should record system health metrics without CPU usage', async () => {
      await metricsService.recordSystemHealthMetrics(60.0, 1800);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MetricData: expect.arrayContaining([
              expect.objectContaining({
                MetricName: 'MemoryUsagePercent',
                Value: 60.0
              }),
              expect.objectContaining({
                MetricName: 'UptimeSeconds',
                Value: 1800
              })
            ])
          })
        })
      );

      // Should not include CPU metric
      const call = mockSend.mock.calls[0][0];
      const cpuMetric = call.input.MetricData.find((m: any) => m.MetricName === 'CPUUsagePercent');
      expect(cpuMetric).toBeUndefined();
    });
  });

  describe('recordQueueDepthMetrics', () => {
    it('should record queue depth metrics', async () => {
      await metricsService.recordQueueDepthMetrics('test-queue', 25, 5);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MetricData: expect.arrayContaining([
              expect.objectContaining({
                MetricName: 'QueueDepth',
                Value: 25,
                Dimensions: expect.arrayContaining([
                  { Name: 'QueueName', Value: 'test-queue' }
                ])
              }),
              expect.objectContaining({
                MetricName: 'QueueInFlightMessages',
                Value: 5,
                Dimensions: expect.arrayContaining([
                  { Name: 'QueueName', Value: 'test-queue' }
                ])
              })
            ])
          })
        })
      );
    });
  });

  describe('recordErrorRateMetrics', () => {
    it('should record error rate metrics', async () => {
      await metricsService.recordErrorRateMetrics('EMAIL_DELIVERY', 100, 5, 10);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            MetricData: expect.arrayContaining([
              expect.objectContaining({
                MetricName: 'ErrorRate',
                Value: 5, // 5/100 * 100 = 5%
                Unit: 'Percent',
                Dimensions: expect.arrayContaining([
                  { Name: 'Operation', Value: 'EMAIL_DELIVERY' },
                  { Name: 'TimeWindow', Value: '10min' }
                ])
              }),
              expect.objectContaining({
                MetricName: 'TotalRequests',
                Value: 100
              }),
              expect.objectContaining({
                MetricName: 'ErrorCount',
                Value: 5
              })
            ])
          })
        })
      );
    });

    it('should handle zero total requests', async () => {
      await metricsService.recordErrorRateMetrics('EMAIL_DELIVERY', 0, 0);

      const call = mockSend.mock.calls[0][0];
      const errorRateMetric = call.input.MetricData.find((m: any) => m.MetricName === 'ErrorRate');
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
      await metricsService.recordSystemHealthMetrics(50, 1000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ FAILED TO RECORD SYSTEM HEALTH METRICS',
        error,
        expect.any(Object)
      );
    });
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        '📊 CLOUDWATCH METRICS SERVICE INITIALIZED',
        expect.objectContaining({
          region: 'us-east-1',
          namespace: 'EbookPlatform/Notifications/test',
          environment: 'test'
        })
      );
    });
  });
});