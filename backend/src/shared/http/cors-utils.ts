/**
 * Shared CORS Utilities
 * 
 * This module provides consistent CORS handling across all Lambda services.
 * It's designed to be used alongside existing CORS code without breaking changes.
 * 
 * Usage:
 * import { sharedCorsHandler } from '../shared/http/cors-utils';
 * 
 * // Replace existing getCorsHeaders() calls gradually
 * headers: sharedCorsHandler.getHeaders(event.headers?.origin)
 */

import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * Environment-specific CORS configuration
 */
interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
  allowCredentials: boolean;
}

/**
 * Get CORS configuration based on environment
 */
const getCorsConfig = (): CorsConfig => {
  const environment = process.env['NODE_ENV'] || 'development';
  
  // Default configuration
  const defaultConfig: CorsConfig = {
    allowedOrigins: [
      'https://d2xg2iv1qaydac.cloudfront.net',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Amz-User-Agent',
      'X-Requested-With'
    ],
    maxAge: 86400, // 24 hours
    allowCredentials: true
  };

  // Environment-specific overrides
  switch (environment) {
    case 'production':
      return {
        ...defaultConfig,
        allowedOrigins: [
          'https://d2xg2iv1qaydac.cloudfront.net'
        ]
      };
    
    case 'qa':
      return {
        ...defaultConfig,
        allowedOrigins: [
          'https://d2xg2iv1qaydac.cloudfront.net',
          'http://qa-ebook-frontend-96c175f3.s3-website-us-east-1.amazonaws.com'
        ]
      };
    
    default:
      return defaultConfig;
  }
};

/**
 * Determine if origin is allowed
 */
const isOriginAllowed = (origin: string | undefined, config: CorsConfig): boolean => {
  if (!origin) return true; // Allow requests without origin (e.g., Postman)
  
  return config.allowedOrigins.some(allowedOrigin => {
    // Exact match
    if (allowedOrigin === origin) return true;
    
    // Wildcard support (e.g., *.example.com)
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    
    return false;
  });
};

/**
 * Shared CORS handler with consistent configuration
 */
export const sharedCorsHandler = {
  /**
   * Get CORS headers for API responses
   * 
   * @param origin - Request origin from headers
   * @returns CORS headers object
   */
  getHeaders: (origin?: string): Record<string, string> => {
    const config = getCorsConfig();
    const allowedOrigin = isOriginAllowed(origin, config) ? origin : config.allowedOrigins[0];
    
    return {
      'Access-Control-Allow-Origin': allowedOrigin || '*',
      'Access-Control-Allow-Methods': config.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': config.allowedHeaders.join(', '),
      'Access-Control-Max-Age': config.maxAge.toString(),
      'Access-Control-Allow-Credentials': config.allowCredentials.toString(),
      'Content-Type': 'application/json'
    };
  },

  /**
   * Create OPTIONS preflight response
   * 
   * @param origin - Request origin from headers
   * @returns Complete API Gateway response for OPTIONS requests
   */
  createOptionsResponse: (origin?: string): APIGatewayProxyResult => {
    return {
      statusCode: 200,
      headers: sharedCorsHandler.getHeaders(origin),
      body: JSON.stringify({
        message: 'CORS preflight successful',
        timestamp: new Date().toISOString()
      })
    };
  },

  /**
   * Validate CORS configuration
   * 
   * @returns Configuration validation result
   */
  validateConfig: (): { isValid: boolean; errors: string[] } => {
    const config = getCorsConfig();
    const errors: string[] = [];

    if (!config.allowedOrigins.length) {
      errors.push('No allowed origins configured');
    }

    if (!config.allowedMethods.length) {
      errors.push('No allowed methods configured');
    }

    if (!config.allowedHeaders.length) {
      errors.push('No allowed headers configured');
    }

    if (config.maxAge < 0) {
      errors.push('Invalid max age value');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Get current CORS configuration (for debugging)
   */
  getConfig: (): CorsConfig => getCorsConfig()
};

/**
 * Backward compatibility - matches existing getCorsHeaders signature
 * This allows for drop-in replacement of existing functions
 */
export const getCorsHeaders = (origin?: string): Record<string, string> => {
  return sharedCorsHandler.getHeaders(origin);
};

/**
 * Backward compatibility - matches existing createOptionsResponse signature
 */
export const createOptionsResponse = (origin?: string): APIGatewayProxyResult => {
  return sharedCorsHandler.createOptionsResponse(origin);
};

/**
 * Export types for TypeScript support
 */
export type { CorsConfig };