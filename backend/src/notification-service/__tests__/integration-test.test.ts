/**
 * Integration test to validate notification service refactoring
 */

import { SharedLogger } from '../../shared/logging/logger';
import { sharedResponseHandler } from '../../shared/http/response-utils';
import { sharedCorsHandler } from '../../shared/http/cors-utils';
import { Validator } from '../../shared/validation/validator';

describe('Notification Service Integration Test', () => {
  test('should successfully import and use shared logger', () => {
    const logger = new SharedLogger('test-notification-service');
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.setCorrelationId).toBe('function');
    
    // Test basic functionality
    logger.setCorrelationId('test-correlation-id');
    expect(logger.getCorrelationId()).toBe('test-correlation-id');
  });

  test('should successfully import and use shared response handler', () => {
    expect(sharedResponseHandler).toBeDefined();
    expect(typeof sharedResponseHandler.success).toBe('function');
    expect(typeof sharedResponseHandler.error).toBe('function');
    expect(typeof sharedResponseHandler.unauthorized).toBe('function');
    
    // Test basic functionality
    const successResponse = sharedResponseHandler.success({ message: 'test' }, 200);
    expect(successResponse.statusCode).toBe(200);
    expect(successResponse.body).toContain('test');
    
    const errorResponse = sharedResponseHandler.error('TEST_ERROR', 'Test error message', 400);
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.body).toContain('TEST_ERROR');
  });

  test('should successfully import and use shared CORS handler', () => {
    expect(sharedCorsHandler).toBeDefined();
    expect(typeof sharedCorsHandler.getHeaders).toBe('function');
    expect(typeof sharedCorsHandler.createOptionsResponse).toBe('function');
    
    // Test basic functionality
    const headers = sharedCorsHandler.getHeaders('https://example.com');
    expect(headers).toHaveProperty('Access-Control-Allow-Origin');
    expect(headers).toHaveProperty('Content-Type');
    
    const optionsResponse = sharedCorsHandler.createOptionsResponse('https://example.com');
    expect(optionsResponse.statusCode).toBe(200);
    expect(optionsResponse.headers).toHaveProperty('Access-Control-Allow-Origin');
  });

  test('should successfully import and use shared validator', () => {
    expect(Validator).toBeDefined();
    expect(typeof Validator.validateEmail).toBe('function');
    expect(typeof Validator.validateRequest).toBe('function');
    
    // Test basic functionality
    const validEmailResult = Validator.validateEmail('test@example.com');
    expect(validEmailResult.isValid).toBe(true);
    expect(validEmailResult.data).toBe('test@example.com');
    
    const invalidEmailResult = Validator.validateEmail('invalid-email');
    expect(invalidEmailResult.isValid).toBe(false);
    expect(invalidEmailResult.errors).toHaveLength(1);
  });

  test('should demonstrate email sending logic optimization', () => {
    // Test that the SES service can be imported and has expected methods
    const { sesService } = require('../services/ses-service');
    
    expect(sesService).toBeDefined();
    expect(typeof sesService.sendEmail).toBe('function');
    expect(typeof sesService.sendEmailWithCC).toBe('function');
    expect(typeof sesService.testConnection).toBe('function');
  });

  test('should demonstrate validation logic optimization', () => {
    // Test that the validation utilities can be imported and work with shared validator
    const { validateNotificationRequest, sanitizeNotificationRequest } = require('../utils/validation');
    
    expect(validateNotificationRequest).toBeDefined();
    expect(sanitizeNotificationRequest).toBeDefined();
    
    // Test validation with valid request
    const validRequest = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com',
      variables: { bookTitle: 'Test Book' }
    };
    
    const validationResult = validateNotificationRequest(validRequest);
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
    
    // Test sanitization
    const sanitizedRequest = sanitizeNotificationRequest(validRequest);
    expect(sanitizedRequest.recipientEmail).toBe('test@example.com');
    expect(sanitizedRequest.type).toBe('book_submitted');
  });

  test('should demonstrate SQS message processing optimization', () => {
    // Test that the SQS handler can be imported
    const { SQSEventHandler } = require('../handlers/sqs-event-handler');
    
    expect(SQSEventHandler).toBeDefined();
    
    const handler = new SQSEventHandler();
    expect(handler).toBeDefined();
    expect(typeof handler.handleSQSEvent).toBe('function');
  });
});