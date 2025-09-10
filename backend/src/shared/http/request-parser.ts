/**
 * Shared Request Parsing Utilities
 * Provides consistent request body parsing and validation across Lambda services
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { SharedLogger } from '../logging/logger';
import { Validator, ValidationResult } from '../validation/validator';

/**
 * Request parsing result interface
 */
export interface RequestParsingResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Shared request parser class
 */
export class RequestParser {
  private logger: SharedLogger;

  constructor(serviceName: string) {
    this.logger = new SharedLogger(`${serviceName}-request-parser`);
  }

  /**
   * Parse and validate JSON request body
   */
  parseJsonBody<T>(
    event: APIGatewayProxyEvent,
    requestId: string,
    validationSchema?: any
  ): RequestParsingResult<T> {
    this.logger.setCorrelationId(requestId);

    try {
      // Parse JSON body
      let requestBody: any;
      try {
        requestBody = event.body ? JSON.parse(event.body) : {};
      } catch (parseError) {
        this.logger.error('❌ Invalid JSON in request body', parseError instanceof Error ? parseError : new Error(String(parseError)), {
          requestId,
          body: event.body
        });
        
        return {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body'
          }
        };
      }

      // Validate against schema if provided
      if (validationSchema) {
        const validation = Validator.validateRequest(requestBody, validationSchema);
        if (!validation.isValid) {
          this.logger.validation('request-body', false, validation.errors, { requestId });
          
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: validation.errors
            }
          };
        }
        
        this.logger.validation('request-body', true, [], { requestId });
        return {
          success: true,
          data: validation.data as T
        };
      }

      // Return parsed body without validation
      return {
        success: true,
        data: requestBody as T
      };

    } catch (error) {
      this.logger.error('❌ Unexpected error parsing request', error instanceof Error ? error : new Error(String(error)), {
        requestId
      });

      return {
        success: false,
        error: {
          code: 'PARSING_ERROR',
          message: 'Failed to parse request'
        }
      };
    }
  }

  /**
   * Extract path parameters with validation
   */
  extractPathParameters(
    event: APIGatewayProxyEvent,
    requiredParams: string[] = []
  ): RequestParsingResult<Record<string, string>> {
    const pathParameters = event.pathParameters || {};
    const missing: string[] = [];

    // Check for required parameters
    for (const param of requiredParams) {
      if (!pathParameters[param]) {
        missing.push(param);
      }
    }

    if (missing.length > 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_PATH_PARAMETERS',
          message: `Missing required path parameters: ${missing.join(', ')}`,
          details: missing
        }
      };
    }

    // Filter out undefined values to match Record<string, string>
    const filteredParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(pathParameters)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
    }

    return {
      success: true,
      data: filteredParams
    };
  }

  /**
   * Extract query parameters with validation
   */
  extractQueryParameters(
    event: APIGatewayProxyEvent,
    requiredParams: string[] = []
  ): RequestParsingResult<Record<string, string>> {
    const queryParameters = event.queryStringParameters || {};
    const missing: string[] = [];

    // Check for required parameters
    for (const param of requiredParams) {
      if (!queryParameters[param]) {
        missing.push(param);
      }
    }

    if (missing.length > 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_QUERY_PARAMETERS',
          message: `Missing required query parameters: ${missing.join(', ')}`,
          details: missing
        }
      };
    }

    // Filter out undefined values to match Record<string, string>
    const filteredQuery: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParameters)) {
      if (value !== undefined) {
        filteredQuery[key] = value;
      }
    }

    return {
      success: true,
      data: filteredQuery
    };
  }

  /**
   * Extract headers with validation
   */
  extractHeaders(
    event: APIGatewayProxyEvent,
    requiredHeaders: string[] = []
  ): RequestParsingResult<Record<string, string>> {
    const headers = event.headers || {};
    const missing: string[] = [];

    // Check for required headers (case-insensitive)
    for (const header of requiredHeaders) {
      const found = Object.keys(headers).find(h => h.toLowerCase() === header.toLowerCase());
      if (!found || !headers[found]) {
        missing.push(header);
      }
    }

    if (missing.length > 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_HEADERS',
          message: `Missing required headers: ${missing.join(', ')}`,
          details: missing
        }
      };
    }

    // Filter out undefined values to match Record<string, string>
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        filteredHeaders[key] = value;
      }
    }

    return {
      success: true,
      data: filteredHeaders
    };
  }
}