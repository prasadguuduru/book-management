/**
 * Tests for logging utilities
 */

import { SharedLogger } from '../logger';
import {
  createLambdaLogger,
  extractRequestMeta,
  logApiGatewayRequest,
  logApiGatewayResponse,
  withPerformanceLogging,
  logError,
  logSecurityEvent,
  logAuditEvent,
  logDatabaseOperation,
  monitorLambdaTimeout,
  logStructuredError,
  logBusinessOperation,
  logExternalServiceCall
} from '../logging-utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Helper function to get log entry from mock call
const getLogEntry = (mockCall: any) => {
  const logCall = mockCall.mock.calls[0]?.[0];
  expect(logCall).toBeDefined();
  return JSON.parse(logCall as string);
};

describe('Logging Utils', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('createLambdaLogger', () => {
    it('should create logger with service name', () => {
      const logger = createLambdaLogger('test-service');
      
      expect(logger).toBeInstanceOf(SharedLogger);
    });

    it('should create logger with Lambda context', () => {
      const mockContext: Partial<Context> = {
        functionName: 'test-function',
        functionVersion: '1.0',
        memoryLimitInMB: '128',
        awsRequestId: 'aws-request-123',
        logGroupName: '/aws/lambda/test-function',
        logStreamName: '2023/01/01/[$LATEST]abc123',
        getRemainingTimeInMillis: () => 30000
      };

      const logger = createLambdaLogger('test-service', mockContext as Context);
      
      expect(logger).toBeInstanceOf(SharedLogger);
      expect(logger.getCorrelationId()).toBe('aws-request-123');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractRequestMeta', () => {
    it('should extract metadata from API Gateway event', () => {
      const mockEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/books',
        resource: '/api/books',
        headers: {
          'User-Agent': 'test-agent'
        },
        requestContext: {
          requestId: 'request-123',
          stage: 'dev',
          identity: {
            sourceIp: '192.168.1.1'
          }
        } as any
      };

      const meta = extractRequestMeta(mockEvent as APIGatewayProxyEvent);

      expect(meta.requestId).toBe('request-123');
      expect(meta.method).toBe('POST');
      expect(meta.url).toBe('/api/books');
      expect(meta.userAgent).toBe('test-agent');
      expect(meta.ip).toBe('192.168.1.1');
      expect((meta as any).stage).toBe('dev');
      expect((meta as any).resourcePath).toBe('/api/books');
    });
  });

  describe('logApiGatewayRequest', () => {
    it('should log API Gateway request', () => {
      const logger = new SharedLogger('test-service');
      const mockEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/books',
        headers: { 'Content-Type': 'application/json' },
        body: '{"test": "data"}',
        requestContext: {
          requestId: 'request-123'
        } as any
      };

      logApiGatewayRequest(logger, mockEvent as APIGatewayProxyEvent);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('📥 HTTP_REQUEST: GET /api/books');
    });
  });

  describe('logApiGatewayResponse', () => {
    it('should log API Gateway response', () => {
      const logger = new SharedLogger('test-service');
      const mockResponse: APIGatewayProxyResult = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: '{"success": true}'
      };

      logApiGatewayResponse(logger, mockResponse);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('📤 HTTP_RESPONSE: 200');
    });
  });

  describe('withPerformanceLogging', () => {
    it('should log performance for successful operations', async () => {
      const logger = new SharedLogger('test-service');
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const wrappedFn = withPerformanceLogging(logger, 'testOperation', mockFn);
      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockConsoleLog).toHaveBeenCalledTimes(2); // Start and completion logs
    });

    it('should log performance for failed operations', async () => {
      const logger = new SharedLogger('test-service');
      const testError = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(testError);
      
      const wrappedFn = withPerformanceLogging(logger, 'testOperation', mockFn);

      await expect(wrappedFn('arg1')).rejects.toThrow('Test error');
      expect(mockConsoleLog).toHaveBeenCalledTimes(1); // Start log
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // Error log
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const logger = new SharedLogger('test-service');
      const error = new Error('Test error');
      
      logError(logger, error, 'user authentication', { userId: 'user123' });

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleError);
      
      expect(logEntry.message).toBe('Error in user authentication');
      expect(logEntry.meta?.context).toBe('user authentication');
      expect(logEntry.meta?.userId).toBe('user123');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event with default severity', () => {
      const logger = new SharedLogger('test-service');
      
      logSecurityEvent(logger, 'UNAUTHORIZED_ACCESS', 'Invalid token provided');

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleError);
      
      expect(logEntry.message).toBe('🚨 SECURITY_EVENT: UNAUTHORIZED_ACCESS - Invalid token provided');
      expect(logEntry.meta?.eventType).toBe('UNAUTHORIZED_ACCESS');
      expect(logEntry.meta?.severity).toBe('MEDIUM');
    });

    it('should log security event with custom severity', () => {
      const logger = new SharedLogger('test-service');
      
      logSecurityEvent(logger, 'DATA_BREACH', 'Sensitive data exposed', 'CRITICAL');

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleError);
      
      expect(logEntry.meta?.severity).toBe('CRITICAL');
    });
  });

  describe('logAuditEvent', () => {
    it('should log audit event', () => {
      const logger = new SharedLogger('test-service');
      
      logAuditEvent(logger, 'USER_LOGIN', 'user-profile', 'user123');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('📋 AUDIT: USER_LOGIN on user-profile');
      expect(logEntry.meta?.action).toBe('USER_LOGIN');
      expect(logEntry.meta?.resource).toBe('user-profile');
      expect(logEntry.meta?.userId).toBe('user123');
    });
  });

  describe('logDatabaseOperation', () => {
    it('should log database operation', () => {
      const logger = new SharedLogger('test-service');
      const key = { PK: 'USER#123', SK: 'PROFILE' };
      
      logDatabaseOperation(logger, 'CREATE', 'users-table', key, { userId: 'user123' });

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('💾 DB_CREATE');
      expect(logEntry.meta?.operation).toBe('DB_CREATE');
      expect(logEntry.meta?.table).toBe('users-table');
      expect(logEntry.meta?.key).toEqual(key);
    });
  });

  describe('monitorLambdaTimeout', () => {
    it('should set up timeout monitoring', () => {
      const logger = new SharedLogger('test-service');
      const mockContext: Partial<Context> = {
        functionName: 'test-function',
        getRemainingTimeInMillis: () => 30000
      };

      const timeout = monitorLambdaTimeout(logger, mockContext as Context, 5000);

      expect(timeout).toBeDefined();
      clearTimeout(timeout);
    });
  });

  describe('logStructuredError', () => {
    it('should log structured error', () => {
      const logger = new SharedLogger('test-service');
      const error = new Error('Validation failed');
      
      logStructuredError(logger, error, 400, 'Invalid input provided', { requestId: 'req123' });

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleError);
      
      expect(logEntry.message).toBe('Structured error response');
      expect(logEntry.meta?.statusCode).toBe(400);
      expect(logEntry.meta?.userMessage).toBe('Invalid input provided');
      expect(logEntry.meta?.errorType).toBe('Error');
    });
  });

  describe('logBusinessOperation', () => {
    it('should log successful business operation', () => {
      const logger = new SharedLogger('test-service');
      
      logBusinessOperation(logger, 'CREATE', 'Book', 'book123', true, { userId: 'user123' });

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('🏢 BUSINESS_OP: CREATE Book - SUCCESS');
      expect(logEntry.meta?.operation).toBe('CREATE');
      expect(logEntry.meta?.entity).toBe('Book');
      expect(logEntry.meta?.entityId).toBe('book123');
      expect(logEntry.meta?.success).toBe(true);
    });

    it('should log failed business operation', () => {
      const logger = new SharedLogger('test-service');
      
      logBusinessOperation(logger, 'DELETE', 'Book', 'book123', false, { userId: 'user123' });

      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleWarn);
      
      expect(logEntry.message).toBe('🏢 BUSINESS_OP: DELETE Book - FAILED');
      expect(logEntry.meta?.success).toBe(false);
    });
  });

  describe('logExternalServiceCall', () => {
    it('should log external service call', () => {
      const logger = new SharedLogger('test-service');
      
      logExternalServiceCall(logger, 'AWS-SNS', 'PUBLISH_MESSAGE', 'https://sns.amazonaws.com');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('🌐 EXTERNAL_SERVICE: AWS-SNS - PUBLISH_MESSAGE');
      expect(logEntry.meta?.serviceName).toBe('AWS-SNS');
      expect(logEntry.meta?.operation).toBe('PUBLISH_MESSAGE');
      expect(logEntry.meta?.url).toBe('https://sns.amazonaws.com');
    });
  });
});