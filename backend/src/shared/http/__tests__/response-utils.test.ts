/**
 * Tests for shared response utilities
 */

import { sharedResponseHandler, createResponse, createErrorResponse } from '../response-utils';

describe('Shared Response Utilities', () => {
  const mockRequestId = 'test-request-123';
  const mockOrigin = 'https://d2xg2iv1qaydac.cloudfront.net';

  describe('sharedResponseHandler.success', () => {
    it('should create successful response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = sharedResponseHandler.success(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');

      const body = JSON.parse(response.body);
      expect(body.data).toEqual(data);
      expect(body.timestamp).toBeDefined();
      expect(body.requestId).toBeUndefined();
    });

    it('should include request ID when provided', () => {
      const data = { test: true };
      const response = sharedResponseHandler.success(data, 200, { requestId: mockRequestId });

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(mockRequestId);
    });

    it('should use custom status code', () => {
      const data = { created: true };
      const response = sharedResponseHandler.success(data, 201);

      expect(response.statusCode).toBe(201);
    });

    it('should include additional headers', () => {
      const data = { test: true };
      const additionalHeaders = { 'X-Custom-Header': 'custom-value' };
      const response = sharedResponseHandler.success(data, 200, { additionalHeaders });

      expect(response.headers).toHaveProperty('X-Custom-Header', 'custom-value');
    });

    it('should handle origin for CORS', () => {
      const data = { test: true };
      const response = sharedResponseHandler.success(data, 200, { origin: mockOrigin });

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', mockOrigin);
    });

    it('should optionally exclude timestamp', () => {
      const data = { test: true };
      const response = sharedResponseHandler.success(data, 200, { includeTimestamp: false });

      const body = JSON.parse(response.body);
      expect(body.timestamp).toBeUndefined();
    });
  });

  describe('sharedResponseHandler.successWithMessage', () => {
    it('should create successful response with message', () => {
      const message = 'Operation completed successfully';
      const response = sharedResponseHandler.successWithMessage(message);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe(message);
      expect(body.data).toBeUndefined();
    });

    it('should include both message and data', () => {
      const message = 'User created';
      const data = { userId: 123 };
      const response = sharedResponseHandler.successWithMessage(message, data, 201);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toBe(message);
      expect(body.data).toEqual(data);
    });
  });

  describe('sharedResponseHandler.error', () => {
    it('should create error response', () => {
      const code = 'INVALID_INPUT';
      const message = 'Missing required field';
      const response = sharedResponseHandler.error(code, message);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(code);
      expect(body.error.message).toBe(message);
      expect(body.error.timestamp).toBeDefined();
    });

    it('should use custom status code', () => {
      const response = sharedResponseHandler.error('NOT_FOUND', 'Resource not found', 404);

      expect(response.statusCode).toBe(404);
    });

    it('should include error details', () => {
      const details = ['Field "email" is required', 'Field "password" is too short'];
      const response = sharedResponseHandler.error(
        'VALIDATION_FAILED',
        'Validation failed',
        400,
        { details }
      );

      const body = JSON.parse(response.body);
      expect(body.error.details).toEqual(details);
    });

    it('should include request ID', () => {
      const response = sharedResponseHandler.error(
        'ERROR',
        'Something went wrong',
        500,
        { requestId: mockRequestId }
      );

      const body = JSON.parse(response.body);
      expect(body.error.requestId).toBe(mockRequestId);
    });

    it('should include CORS headers', () => {
      const response = sharedResponseHandler.error('ERROR', 'Test error');

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  describe('sharedResponseHandler.validationError', () => {
    it('should create validation error response', () => {
      const errors = ['Email is required', 'Password must be at least 8 characters'];
      const response = sharedResponseHandler.validationError(errors);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.message).toBe('Request validation failed');
      expect(body.error.details).toEqual(errors);
    });
  });

  describe('sharedResponseHandler.notFound', () => {
    it('should create not found response with default message', () => {
      const response = sharedResponseHandler.notFound();

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Resource not found');
    });

    it('should create not found response with custom resource', () => {
      const response = sharedResponseHandler.notFound('User');

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.message).toBe('User not found');
    });
  });

  describe('sharedResponseHandler.unauthorized', () => {
    it('should create unauthorized response with default message', () => {
      const response = sharedResponseHandler.unauthorized();

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
    });

    it('should create unauthorized response with custom message', () => {
      const customMessage = 'Invalid token';
      const response = sharedResponseHandler.unauthorized(customMessage);

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe(customMessage);
    });
  });

  describe('sharedResponseHandler.forbidden', () => {
    it('should create forbidden response', () => {
      const response = sharedResponseHandler.forbidden();

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Access denied');
    });

    it('should create forbidden response with custom message', () => {
      const customMessage = 'Insufficient permissions';
      const response = sharedResponseHandler.forbidden(customMessage);

      const body = JSON.parse(response.body);
      expect(body.error.message).toBe(customMessage);
    });
  });

  describe('sharedResponseHandler.internalError', () => {
    it('should create internal error response', () => {
      const response = sharedResponseHandler.internalError();

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Internal server error');
    });
  });

  describe('Backward compatibility functions', () => {
    describe('createResponse', () => {
      it('should work like existing success response function', () => {
        const data = { id: 1, name: 'Test' };
        const response = createResponse(200, data, mockRequestId);

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.data).toEqual(data);
        expect(body.requestId).toBe(mockRequestId);
      });

      it('should handle error responses', () => {
        const errorData = {
          error: {
            code: 'TEST_ERROR',
            message: 'Test error message'
          }
        };
        const response = createResponse(400, errorData, mockRequestId);

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('TEST_ERROR');
        expect(body.error.message).toBe('Test error message');
        expect(body.error.requestId).toBe(mockRequestId);
      });

      it('should handle created responses', () => {
        const data = { id: 1, created: true };
        const response = createResponse(201, data);

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.data).toEqual(data);
      });
    });

    describe('createErrorResponse', () => {
      it('should work like existing error response function', () => {
        const response = createErrorResponse(
          404,
          'NOT_FOUND',
          'Resource not found',
          mockRequestId,
          { resourceId: 123 }
        );

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error.code).toBe('NOT_FOUND');
        expect(body.error.message).toBe('Resource not found');
        expect(body.error.requestId).toBe(mockRequestId);
        expect(body.error.details).toEqual({ resourceId: 123 });
      });
    });
  });

  describe('Response structure consistency', () => {
    it('should have consistent success response structure', () => {
      const response = sharedResponseHandler.success({ test: true }, 200, { requestId: mockRequestId });
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('requestId');
      expect(body).not.toHaveProperty('error');
    });

    it('should have consistent error response structure', () => {
      const response = sharedResponseHandler.error('TEST', 'Test error', 400, { requestId: mockRequestId });
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body.error).toHaveProperty('timestamp');
      expect(body.error).toHaveProperty('requestId');
      expect(body).not.toHaveProperty('data');
    });

    it('should always include CORS headers', () => {
      const successResponse = sharedResponseHandler.success({ test: true });
      const errorResponse = sharedResponseHandler.error('TEST', 'Test error');

      expect(successResponse.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(successResponse.headers).toHaveProperty('Content-Type', 'application/json');
      expect(errorResponse.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(errorResponse.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  describe('Edge cases', () => {
    it('should handle null data', () => {
      const response = sharedResponseHandler.success(null);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should handle undefined data', () => {
      const response = sharedResponseHandler.success(undefined);
      const body = JSON.parse(response.body);
      expect(body.data).toBeUndefined();
    });

    it('should handle empty string data', () => {
      const response = sharedResponseHandler.success('');
      const body = JSON.parse(response.body);
      expect(body.data).toBe('');
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        user: { id: 1, profile: { name: 'Test', settings: { theme: 'dark' } } },
        metadata: { created: new Date().toISOString() }
      };
      const response = sharedResponseHandler.success(complexData);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual(complexData);
    });
  });
});