/**
 * Shared Response Utilities
 * 
 * This module provides consistent response handling across all Lambda services.
 * It's designed to be used alongside existing response code without breaking changes.
 * 
 * Usage:
 * import { sharedResponseHandler } from '../shared/http/response-utils';
 * 
 * // Replace existing createResponse() calls gradually
 * return sharedResponseHandler.success(data, 200);
 * return sharedResponseHandler.error('INVALID_INPUT', 'Missing required field', 400);
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { sharedCorsHandler } from './cors-utils';

/**
 * Standard error response structure
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Standard success response structure
 */
interface SuccessResponse<T = any> {
  data?: T;
  message?: string;
  timestamp?: string;
  requestId?: string;
}

/**
 * Response configuration options
 */
interface ResponseOptions {
  requestId?: string | undefined;
  origin?: string | undefined;
  additionalHeaders?: Record<string, string>;
  includeTimestamp?: boolean;
}

/**
 * Shared response handler with consistent formatting
 */
export const sharedResponseHandler = {
  /**
   * Create successful response
   * 
   * @param data - Response data
   * @param statusCode - HTTP status code (default: 200)
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  success: <T>(
    data: T, 
    statusCode: number = 200, 
    options: ResponseOptions = {}
  ): APIGatewayProxyResult => {
    const { requestId, origin, additionalHeaders = {}, includeTimestamp = true } = options;
    
    const responseBody: SuccessResponse<T> = {
      data,
      ...(includeTimestamp && { timestamp: new Date().toISOString() }),
      ...(requestId && { requestId })
    };

    return {
      statusCode,
      headers: {
        ...sharedCorsHandler.getHeaders(origin),
        ...additionalHeaders
      },
      body: JSON.stringify(responseBody)
    };
  },

  /**
   * Create successful response with custom message
   * 
   * @param message - Success message
   * @param data - Optional response data
   * @param statusCode - HTTP status code (default: 200)
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  successWithMessage: <T>(
    message: string,
    data?: T,
    statusCode: number = 200,
    options: ResponseOptions = {}
  ): APIGatewayProxyResult => {
    const { requestId, origin, additionalHeaders = {}, includeTimestamp = true } = options;
    
    const responseBody: SuccessResponse<T> = {
      message,
      ...(data !== undefined && { data }),
      ...(includeTimestamp && { timestamp: new Date().toISOString() }),
      ...(requestId && { requestId })
    };

    return {
      statusCode,
      headers: {
        ...sharedCorsHandler.getHeaders(origin),
        ...additionalHeaders
      },
      body: JSON.stringify(responseBody)
    };
  },

  /**
   * Create error response
   * 
   * @param code - Error code (e.g., 'INVALID_INPUT', 'NOT_FOUND')
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code (default: 400)
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  error: (
    code: string,
    message: string,
    statusCode: number = 400,
    options: ResponseOptions & { details?: any } = {}
  ): APIGatewayProxyResult => {
    const { requestId, origin, additionalHeaders = {}, details, includeTimestamp = true } = options;
    
    const responseBody: ErrorResponse = {
      error: {
        code,
        message,
        ...(details && { details }),
        ...(includeTimestamp && { timestamp: new Date().toISOString() }),
        ...(requestId && { requestId })
      }
    };

    return {
      statusCode,
      headers: {
        ...sharedCorsHandler.getHeaders(origin),
        ...additionalHeaders
      },
      body: JSON.stringify(responseBody)
    };
  },

  /**
   * Create validation error response
   * 
   * @param validationErrors - Array of validation error messages
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  validationError: (
    validationErrors: string[],
    options: ResponseOptions = {}
  ): APIGatewayProxyResult => {
    return sharedResponseHandler.error(
      'VALIDATION_FAILED',
      'Request validation failed',
      400,
      {
        ...options,
        details: validationErrors
      }
    );
  },

  /**
   * Create not found error response
   * 
   * @param resource - Resource that was not found
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  notFound: (
    resource: string = 'Resource',
    options: ResponseOptions = {}
  ): APIGatewayProxyResult => {
    return sharedResponseHandler.error(
      'NOT_FOUND',
      `${resource} not found`,
      404,
      options
    );
  },

  /**
   * Create unauthorized error response
   * 
   * @param message - Optional custom message
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  unauthorized: (
    message: string = 'Authentication required',
    options: ResponseOptions = {}
  ): APIGatewayProxyResult => {
    return sharedResponseHandler.error(
      'UNAUTHORIZED',
      message,
      401,
      options
    );
  },

  /**
   * Create forbidden error response
   * 
   * @param message - Optional custom message
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  forbidden: (
    message: string = 'Access denied',
    options: ResponseOptions = {}
  ): APIGatewayProxyResult => {
    return sharedResponseHandler.error(
      'FORBIDDEN',
      message,
      403,
      options
    );
  },

  /**
   * Create internal server error response
   * 
   * @param message - Optional custom message
   * @param options - Additional response options
   * @returns Complete API Gateway response
   */
  internalError: (
    message: string = 'Internal server error',
    options: ResponseOptions = {}
  ): APIGatewayProxyResult => {
    return sharedResponseHandler.error(
      'INTERNAL_ERROR',
      message,
      500,
      options
    );
  }
};

/**
 * Backward compatibility functions - match existing signatures
 */

/**
 * Backward compatibility - matches existing createResponse signature
 * This allows for drop-in replacement of existing functions
 */
export const createResponse = <T>(
  statusCode: number, 
  body: T, 
  requestId?: string
): APIGatewayProxyResult => {
  const options: ResponseOptions = requestId ? { requestId } : {};
  
  if (statusCode >= 400) {
    // Handle error responses
    const errorBody = body as any;
    return sharedResponseHandler.error(
      errorBody.error?.code || 'ERROR',
      errorBody.error?.message || 'An error occurred',
      statusCode,
      options
    );
  } else {
    // Handle success responses
    return sharedResponseHandler.success(body, statusCode, options);
  }
};

/**
 * Backward compatibility - matches existing createErrorResponse signature
 */
export const createErrorResponse = (
  statusCode: number,
  code: string,
  message: string,
  requestId?: string,
  details?: any
): APIGatewayProxyResult => {
  const options: ResponseOptions & { details?: any } = {};
  if (requestId) options.requestId = requestId;
  if (details) options.details = details;
  
  return sharedResponseHandler.error(code, message, statusCode, options);
};

/**
 * Export types for TypeScript support
 */
export type { ErrorResponse, SuccessResponse, ResponseOptions };