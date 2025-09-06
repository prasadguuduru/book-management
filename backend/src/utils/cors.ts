/**
 * CORS utility for Lambda functions
 * Handles CORS headers based on environment configuration
 */

import { config } from '../config/environment';

export interface CorsHeaders {
  'Content-Type': string;
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Max-Age'?: string;
  'Access-Control-Allow-Credentials'?: string;
  [key: string]: string | number | boolean;
}

/**
 * Get CORS headers for Lambda response
 * @param origin - The origin from the request headers
 * @returns CORS headers object
 */
export function getCorsHeaders(origin?: string): CorsHeaders {
  const allowedOrigins = Array.isArray(config.cors.origin) 
    ? config.cors.origin 
    : [config.cors.origin];

  // Check if the origin is allowed
  let allowOrigin = '*';
  
  // If wildcard is configured, use it
  if (allowedOrigins.includes('*')) {
    allowOrigin = '*';
  } else if (origin && allowedOrigins.includes(origin)) {
    // If specific origin is in allowed list, use it
    allowOrigin = origin;
  } else if (allowedOrigins.length === 1 && allowedOrigins[0] !== '*') {
    // If only one specific origin is configured, use it
    allowOrigin = allowedOrigins[0] || '*';
  } else if (allowedOrigins.length > 1) {
    // Multiple origins configured, check if request origin is allowed
    allowOrigin = allowedOrigins.includes(origin || '') ? (origin || allowedOrigins[0] || '*') : (allowedOrigins[0] || '*');
  }

  const headers: CorsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
    'Access-Control-Max-Age': '86400'
  };

  if (allowOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Create a preflight OPTIONS response
 * @param origin - The origin from the request headers
 * @returns Lambda response for OPTIONS request
 */
export function createOptionsResponse(origin?: string) {
  return {
    statusCode: 200,
    headers: getCorsHeaders(origin),
    body: ''
  };
}