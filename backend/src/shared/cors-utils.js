// CORS utility functions for Lambda functions
// Provides consistent CORS handling across all services

/**
 * Get CORS headers based on environment
 * @param {string} environment - The deployment environment (local, qa, staging, prod)
 * @returns {Object} CORS headers object
 */
function getCorsHeaders(environment = 'local') {
  const baseHeaders = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'
  };

  switch (environment) {
    case 'local':
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': '*'  // Permissive for LocalStack testing
      };
    case 'qa':
    case 'staging':
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': '*'  // Permissive for testing environments
      };
    case 'prod':
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*'  // Configurable for production
      };
    default:
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': '*'
      };
  }
}

/**
 * Create a standardized API response with CORS headers
 * @param {number} statusCode - HTTP status code
 * @param {Object|string} body - Response body (will be JSON stringified if object)
 * @param {Object} additionalHeaders - Additional headers to include
 * @param {string} environment - Deployment environment
 * @returns {Object} Lambda response object with CORS headers
 */
function createCorsResponse(statusCode, body, additionalHeaders = {}, environment = null) {
  // Get environment from Lambda environment variable if not provided
  const env = environment || process.env.NODE_ENV || process.env.ENVIRONMENT || 'local';
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(env),
      ...additionalHeaders
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

/**
 * Handle OPTIONS preflight requests
 * @param {string} environment - Deployment environment
 * @returns {Object} Lambda response for OPTIONS request
 */
function handleOptionsRequest(environment = null) {
  const env = environment || process.env.NODE_ENV || process.env.ENVIRONMENT || 'local';
  
  return createCorsResponse(200, '', {}, env);
}

/**
 * Create a standardized error response with CORS headers
 * @param {number} statusCode - HTTP error status code
 * @param {string} errorCode - Application error code
 * @param {string} message - Error message
 * @param {Array} details - Additional error details (optional)
 * @param {string} environment - Deployment environment
 * @returns {Object} Lambda error response with CORS headers
 */
function createErrorResponse(statusCode, errorCode, message, details = [], environment = null) {
  const env = environment || process.env.NODE_ENV || process.env.ENVIRONMENT || 'local';
  
  const errorBody = {
    error: {
      code: errorCode,
      message: message,
      details: details,
      timestamp: new Date().toISOString()
    }
  };

  return createCorsResponse(statusCode, errorBody, {}, env);
}

/**
 * Create a success response with CORS headers
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} environment - Deployment environment
 * @returns {Object} Lambda success response with CORS headers
 */
function createSuccessResponse(data, statusCode = 200, environment = null) {
  const env = environment || process.env.NODE_ENV || process.env.ENVIRONMENT || 'local';
  
  return createCorsResponse(statusCode, data, {}, env);
}

/**
 * Validate if the request is a preflight OPTIONS request
 * @param {Object} event - Lambda event object
 * @returns {boolean} True if it's an OPTIONS request
 */
function isOptionsRequest(event) {
  const httpMethod = event.httpMethod || event.requestContext?.http?.method || '';
  return httpMethod.toUpperCase() === 'OPTIONS';
}

/**
 * Extract origin from the request headers
 * @param {Object} event - Lambda event object
 * @returns {string|null} Origin header value or null
 */
function getRequestOrigin(event) {
  const headers = event.headers || {};
  return headers.Origin || headers.origin || null;
}

/**
 * Log CORS-related information for debugging
 * @param {Object} event - Lambda event object
 * @param {string} service - Service name for logging
 */
function logCorsInfo(event, service = 'unknown') {
  const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'UNKNOWN';
  const origin = getRequestOrigin(event);
  const path = event.path || event.requestContext?.http?.path || '/';
  
  console.log(`[${service}] CORS Info:`, {
    method: httpMethod,
    path: path,
    origin: origin,
    isOptions: isOptionsRequest(event),
    environment: process.env.NODE_ENV || process.env.ENVIRONMENT || 'local'
  });
}

module.exports = {
  getCorsHeaders,
  createCorsResponse,
  handleOptionsRequest,
  createErrorResponse,
  createSuccessResponse,
  isOptionsRequest,
  getRequestOrigin,
  logCorsInfo
};