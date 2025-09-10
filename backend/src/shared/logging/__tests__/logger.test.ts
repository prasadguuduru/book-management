/**
 * Tests for the shared logging system
 */

import { SharedLogger } from '../logger';

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

describe('SharedLogger', () => {
  let logger: SharedLogger;

  beforeEach(() => {
    logger = new SharedLogger('test-service', 'test');
    mockConsoleLog.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const testLogger = new SharedLogger();
      expect(testLogger).toBeDefined();
    });

    it('should initialize with custom service name', () => {
      const testLogger = new SharedLogger('custom-service');
      expect(testLogger).toBeDefined();
    });
  });

  describe('correlation ID management', () => {
    it('should generate and set correlation ID', () => {
      const correlationId = logger.generateCorrelationId();
      
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
      expect(logger.getCorrelationId()).toBe(correlationId);
    });

    it('should set custom correlation ID', () => {
      const customId = 'custom-correlation-id';
      logger.setCorrelationId(customId);
      
      expect(logger.getCorrelationId()).toBe(customId);
    });
  });

  describe('basic logging methods', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message', { operation: 'test' });
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.level).toBe('DEBUG');
      expect(logEntry.message).toBe('Test debug message');
      expect(logEntry.service).toBe('test-service');
      expect(logEntry.environment).toBe('test');
    });

    it('should log info messages', () => {
      logger.info('Test info message', { userId: 'user123' });
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('Test info message');
      expect(logEntry.meta?.userId).toBe('user123');
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');
      
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleWarn);
      
      expect(logEntry.level).toBe('WARN');
      expect(logEntry.message).toBe('Test warning message');
    });

    it('should log error messages with error object', () => {
      const testError = new Error('Test error');
      logger.error('Test error message', testError, { operation: 'test' });
      
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleError);
      
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.message).toBe('Test error message');
      expect(logEntry.error?.name).toBe('Error');
      expect(logEntry.error?.message).toBe('Test error');
    });
  });

  describe('specialized logging methods', () => {
    it('should log security events', () => {
      logger.security('Unauthorized access attempt', { ip: '192.168.1.1' });
      
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleError);
      
      expect(logEntry.level).toBe('SECURITY');
      expect(logEntry.message).toBe('Unauthorized access attempt');
      expect(logEntry.meta?.category).toBe('SECURITY');
      expect(logEntry.meta?.severity).toBe('HIGH');
    });

    it('should log audit events', () => {
      logger.audit('User login successful', { userId: 'user123' });
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.level).toBe('AUDIT');
      expect(logEntry.message).toBe('User login successful');
      expect(logEntry.meta?.category).toBe('AUDIT');
      expect(logEntry.meta?.severity).toBe('MEDIUM');
    });

    it('should log performance events', () => {
      logger.performance('Database query completed', { duration: 150 });
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.level).toBe('PERFORMANCE');
      expect(logEntry.message).toBe('Database query completed');
      expect(logEntry.meta?.category).toBe('PERFORMANCE');
      expect(logEntry.meta?.duration).toBe(150);
    });
  });

  describe('function lifecycle logging', () => {
    it('should log function entry', () => {
      const input = { param1: 'value1', password: 'secret' };
      logger.functionEntry('testFunction', input, { requestId: 'req123' });
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('🔵 ENTER: testFunction');
      expect(logEntry.meta?.functionName).toBe('testFunction');
      expect(logEntry.meta?.operation).toBe('FUNCTION_ENTRY');
      expect(logEntry.meta?.input?.param1).toBe('value1');
      expect(logEntry.meta?.input?.password).toBeUndefined(); // Should be sanitized
    });

    it('should log function exit', () => {
      const output = { result: 'success', token: 'secret-token' };
      logger.functionExit('testFunction', output, { requestId: 'req123' });
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.message).toBe('🔴 EXIT: testFunction');
      expect(logEntry.meta?.functionName).toBe('testFunction');
      expect(logEntry.meta?.operation).toBe('FUNCTION_EXIT');
      expect(logEntry.meta?.output?.result).toBe('success');
      expect(logEntry.meta?.output?.token).toBeUndefined(); // Should be sanitized
    });
  });

  describe('correlation ID in logs', () => {
    it('should include correlation ID in log entries', () => {
      const correlationId = 'test-correlation-id';
      logger.setCorrelationId(correlationId);
      
      logger.info('Test message with correlation ID');
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.correlationId).toBe(correlationId);
    });

    it('should use correlation ID from meta if not set on logger', () => {
      const correlationId = 'meta-correlation-id';
      
      logger.info('Test message', { correlationId });
      
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      const logEntry = getLogEntry(mockConsoleLog);
      
      expect(logEntry.correlationId).toBe(correlationId);
    });
  });

  describe('log level filtering', () => {
    beforeEach(() => {
      // Set LOG_LEVEL environment variable for testing
      process.env['LOG_LEVEL'] = 'WARN';
      logger = new SharedLogger('test-service', 'test');
    });

    afterEach(() => {
      delete process.env['LOG_LEVEL'];
    });

    it('should not log debug messages when log level is WARN', () => {
      logger.debug('Debug message');
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should not log info messages when log level is WARN', () => {
      logger.info('Info message');
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should log warning messages when log level is WARN', () => {
      logger.warn('Warning message');
      
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    });

    it('should log error messages when log level is WARN', () => {
      const error = new Error('Test error');
      logger.error('Error message', error);
      
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });
  });
});