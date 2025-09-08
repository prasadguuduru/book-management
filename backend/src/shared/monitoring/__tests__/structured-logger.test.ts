/**
 * Tests for Structured Logger
 */

import { EventProcessingLogger, EventProcessingContext } from '../structured-logger';
import { logger } from '../../../utils/logger';

// Mock the logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('EventProcessingLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockContext: EventProcessingContext = {
    requestId: 'test-request-123',
    eventId: 'event-456',
    messageId: 'msg-789',
    bookId: 'book-abc',
    notificationType: 'submitted_to_approved',
    statusTransition: 'submitted -> approved',
    receiveCount: 1
  };

  describe('logEventProcessingStart', () => {
    it('should log event processing start with correct structure', () => {
      EventProcessingLogger.logEventProcessingStart(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('🔄 EVENT PROCESSING STARTED', {
        ...mockContext,
        operation: 'EVENT_PROCESSING_START',
        category: 'EVENT_PROCESSING',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logEventProcessingSuccess', () => {
    it('should log event processing success with correct structure', () => {
      const contextWithTiming = { ...mockContext, processingTimeMs: 1500 };
      
      EventProcessingLogger.logEventProcessingSuccess(contextWithTiming);

      expect(mockLogger.info).toHaveBeenCalledWith('✅ EVENT PROCESSING SUCCESS', {
        ...contextWithTiming,
        operation: 'EVENT_PROCESSING_SUCCESS',
        category: 'EVENT_PROCESSING',
        status: 'SUCCESS',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logEventProcessingFailure', () => {
    it('should log event processing failure with error details', () => {
      const error = new Error('Test processing error');
      const contextWithTiming = { ...mockContext, processingTimeMs: 2500 };
      
      EventProcessingLogger.logEventProcessingFailure(error, contextWithTiming);

      expect(mockLogger.error).toHaveBeenCalledWith('❌ EVENT PROCESSING FAILURE', error, {
        ...contextWithTiming,
        operation: 'EVENT_PROCESSING_FAILURE',
        category: 'EVENT_PROCESSING',
        status: 'FAILURE',
        errorName: 'Error',
        errorMessage: 'Test processing error',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logBatchProcessingMetrics', () => {
    it('should log batch processing metrics with success rate calculation', () => {
      const batchContext = {
        ...mockContext,
        batchSize: 10,
        successCount: 8,
        failureCount: 2,
        processingTimeMs: 5000
      };
      
      EventProcessingLogger.logBatchProcessingMetrics(batchContext);

      expect(mockLogger.info).toHaveBeenCalledWith('📊 BATCH PROCESSING METRICS', {
        ...batchContext,
        operation: 'BATCH_PROCESSING_METRICS',
        category: 'METRICS',
        successRate: '80.00%',
        timestamp: expect.any(String)
      });
    });

    it('should handle zero batch size gracefully', () => {
      const batchContext = {
        ...mockContext,
        batchSize: 0,
        successCount: 0,
        failureCount: 0
      };
      
      EventProcessingLogger.logBatchProcessingMetrics(batchContext);

      expect(mockLogger.info).toHaveBeenCalledWith('📊 BATCH PROCESSING METRICS', {
        ...batchContext,
        operation: 'BATCH_PROCESSING_METRICS',
        category: 'METRICS',
        successRate: '0%',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logEmailDeliveryAttempt', () => {
    it('should log email delivery attempt', () => {
      const emailContext = {
        ...mockContext,
        recipientEmail: 'test@example.com',
        emailSubject: 'Book Status Update'
      };
      
      EventProcessingLogger.logEmailDeliveryAttempt(emailContext);

      expect(mockLogger.info).toHaveBeenCalledWith('📧 EMAIL DELIVERY ATTEMPT', {
        ...emailContext,
        operation: 'EMAIL_DELIVERY_ATTEMPT',
        category: 'EMAIL_DELIVERY',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logEmailDeliverySuccess', () => {
    it('should log email delivery success', () => {
      const emailContext = {
        ...mockContext,
        emailDeliveryTimeMs: 800,
        messageId: 'ses-msg-123'
      };
      
      EventProcessingLogger.logEmailDeliverySuccess(emailContext);

      expect(mockLogger.info).toHaveBeenCalledWith('✅ EMAIL DELIVERY SUCCESS', {
        ...emailContext,
        operation: 'EMAIL_DELIVERY_SUCCESS',
        category: 'EMAIL_DELIVERY',
        status: 'SUCCESS',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logEmailDeliveryFailure', () => {
    it('should log email delivery failure with error details', () => {
      const error = new Error('SES delivery failed');
      const emailContext = {
        ...mockContext,
        emailDeliveryTimeMs: 1200
      };
      
      EventProcessingLogger.logEmailDeliveryFailure(error, emailContext);

      expect(mockLogger.error).toHaveBeenCalledWith('❌ EMAIL DELIVERY FAILURE', error, {
        ...emailContext,
        operation: 'EMAIL_DELIVERY_FAILURE',
        category: 'EMAIL_DELIVERY',
        status: 'FAILURE',
        errorName: 'Error',
        errorMessage: 'SES delivery failed',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logRetryAttempt', () => {
    it('should log retry attempt with attempt number', () => {
      const retryContext = {
        ...mockContext,
        retryAttempt: 2,
        errorType: 'TransientError'
      };
      
      EventProcessingLogger.logRetryAttempt(retryContext);

      expect(mockLogger.warn).toHaveBeenCalledWith('🔄 RETRY ATTEMPT', {
        ...retryContext,
        operation: 'RETRY_ATTEMPT',
        category: 'RETRY',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logDLQMessage', () => {
    it('should log DLQ message with high severity', () => {
      const dlqContext = {
        ...mockContext,
        dlqReason: 'Max retries exceeded',
        receiveCount: 3
      };
      
      EventProcessingLogger.logDLQMessage(dlqContext);

      expect(mockLogger.error).toHaveBeenCalledWith('💀 MESSAGE SENT TO DLQ', expect.any(Error), {
        ...dlqContext,
        operation: 'DLQ_MESSAGE',
        category: 'DLQ',
        severity: 'HIGH',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logPerformanceWarning', () => {
    it('should log performance warning', () => {
      const perfContext = {
        ...mockContext,
        processingTimeMs: 35000,
        threshold: 'CRITICAL' as const,
        thresholdValue: 30000
      };
      
      EventProcessingLogger.logPerformanceWarning(perfContext);

      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ PERFORMANCE WARNING', {
        ...perfContext,
        operation: 'PERFORMANCE_WARNING',
        category: 'PERFORMANCE',
        severity: 'MEDIUM',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logEventValidationFailure', () => {
    it('should log validation failure with error list', () => {
      const validationErrors = ['Missing bookId', 'Invalid status transition'];
      
      EventProcessingLogger.logEventValidationFailure(validationErrors, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ EVENT VALIDATION FAILURE',
        expect.any(Error),
        {
          ...mockContext,
          operation: 'EVENT_VALIDATION_FAILURE',
          category: 'VALIDATION',
          validationErrors,
          timestamp: expect.any(String)
        }
      );
    });
  });

  describe('logPerformanceMetrics', () => {
    it('should log performance metrics with appropriate level for normal performance', () => {
      EventProcessingLogger.logPerformanceMetrics('TEST_OPERATION', 2000, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith('⏱️ PERFORMANCE METRICS: TEST_OPERATION', {
        ...mockContext,
        operation: 'PERFORMANCE_METRICS',
        category: 'PERFORMANCE',
        performanceLevel: 'NORMAL',
        processingTimeMs: 2000,
        timestamp: expect.any(String)
      });
    });

    it('should log performance metrics with warning level for slow performance', () => {
      EventProcessingLogger.logPerformanceMetrics('TEST_OPERATION', 8000, mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith('⏱️ PERFORMANCE METRICS: TEST_OPERATION', {
        ...mockContext,
        operation: 'PERFORMANCE_METRICS',
        category: 'PERFORMANCE',
        performanceLevel: 'SLOW',
        processingTimeMs: 8000,
        timestamp: expect.any(String)
      });
    });

    it('should log performance metrics with error level for critical performance', () => {
      EventProcessingLogger.logPerformanceMetrics('TEST_OPERATION', 35000, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith('⏱️ PERFORMANCE METRICS: TEST_OPERATION', expect.any(Error), {
        ...mockContext,
        operation: 'PERFORMANCE_METRICS',
        category: 'PERFORMANCE',
        performanceLevel: 'CRITICAL',
        processingTimeMs: 35000,
        timestamp: expect.any(String)
      });
    });
  });

  describe('createTimer', () => {
    it('should create a timer that measures elapsed time', () => {
      const timer = EventProcessingLogger.createTimer();
      
      expect(timer).toHaveProperty('start');
      expect(timer).toHaveProperty('stop');
      expect(timer).toHaveProperty('elapsed');
      expect(typeof timer.stop).toBe('function');
      expect(typeof timer.elapsed).toBe('function');
    });

    it('should measure time correctly', async () => {
      const timer = EventProcessingLogger.createTimer();
      
      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const elapsed = timer.stop();
      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(100); // Should be much less than 100ms
    });
  });

  describe('logSystemHealthMetrics', () => {
    it('should log system health metrics with memory and uptime info', () => {
      const healthContext = {
        ...mockContext,
        memoryUsageHeapUsed: 50000000,
        memoryUsageHeapTotal: 100000000,
        uptimeSeconds: 3600
      };
      
      EventProcessingLogger.logSystemHealthMetrics(healthContext);

      expect(mockLogger.info).toHaveBeenCalledWith('💚 SYSTEM HEALTH METRICS', {
        ...healthContext,
        operation: 'SYSTEM_HEALTH_METRICS',
        category: 'HEALTH',
        timestamp: expect.any(String),
        memoryUsage: expect.any(Object),
        uptime: expect.any(Number)
      });
    });
  });
});