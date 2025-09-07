/**
 * Notification Service Lambda Function
 * Handles email notification delivery using AWS SES
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../utils/logger';
import { getCorsHeaders, createOptionsResponse } from '../utils/cors';
import { UserRole } from '../types';
import { UserContext, HandlerResponse } from './types/notification';
import { sendEmailHandler } from './handlers/send-email';
import { healthCheckHandler } from './handlers/health';

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  logger.info('🔔 NOTIFICATION SERVICE HANDLER STARTED', {
    requestId,
    timestamp: new Date().toISOString(),
    path: event.path,
    method: event.httpMethod,
    resource: event.resource,
    stage: event.requestContext?.stage
  });

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createOptionsResponse(event.headers?.['origin'] || event.headers?.['Origin']);
    }

    // Handle health check (no auth required)
    if (event.path === '/health' || event.path.endsWith('/health')) {
      const healthResponse = await healthCheckHandler(requestId);
      return {
        statusCode: healthResponse.statusCode,
        headers: getCorsHeaders(event.headers?.['origin'] || event.headers?.['Origin']),
        body: JSON.stringify(healthResponse.body)
      };
    }

    // Extract user context from authorizer for authenticated endpoints
    const userContext = extractUserContext(event);
    if (!userContext) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'Authentication required', requestId);
    }

    // Route to appropriate handler
    const result = await routeRequest(event, userContext, requestId);

    return {
      statusCode: result.statusCode,
      headers: getCorsHeaders(event.headers?.['origin'] || event.headers?.['Origin']),
      body: JSON.stringify(result.body)
    };

  } catch (error) {
    logger.error('❌ UNHANDLED ERROR IN NOTIFICATION SERVICE', error instanceof Error ? error : new Error(String(error)), {
      requestId: requestId,
      eventPath: event.path,
      eventMethod: event.httpMethod,
      eventResource: event.resource
    });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

/**
 * Extract user context from API Gateway authorizer
 */
function extractUserContext(event: APIGatewayProxyEvent): UserContext | null {
  try {
    const authContext = event.requestContext?.authorizer;

    logger.info('🔐 USER CONTEXT EXTRACTION', {
      authContext: authContext ? {
        userId: authContext['userId'] || 'missing',
        role: authContext['role'] || 'missing', 
        email: authContext['email'] || 'missing',
        claims: authContext['claims'] ? 'present' : 'missing',
        allKeys: Object.keys(authContext)
      } : 'missing-entirely'
    });

    if (authContext?.['userId'] && authContext?.['role']) {
      const userContext: UserContext = {
        userId: authContext['userId'],
        role: authContext['role'] as UserRole,
        email: authContext['email'] || ''
      };
      
      logger.info('✅ USER CONTEXT EXTRACTED SUCCESSFULLY', {
        extractedContext: userContext
      });
      
      return userContext;
    }

    // Fallback: try to extract from JWT claims
    const claims = authContext?.['claims'];
    if (claims?.sub && claims?.role) {
      const userContext: UserContext = {
        userId: claims.sub,
        role: claims.role as UserRole,
        email: claims.email || ''
      };
      
      logger.info('✅ USER CONTEXT EXTRACTED FROM CLAIMS', {
        extractedContext: userContext
      });
      
      return userContext;
    }

    logger.warn('❌ USER CONTEXT EXTRACTION FAILED', {
      authContext: authContext ? 'present-but-incomplete' : 'missing',
      availableKeys: authContext ? Object.keys(authContext) : []
    });

    return null;
  } catch (error) {
    logger.error('❌ ERROR EXTRACTING USER CONTEXT', error instanceof Error ? error : new Error(String(error)), {
      authContext: event.requestContext?.authorizer ? 'present' : 'missing'
    });
    return null;
  }
}

/**
 * Route requests to appropriate handlers
 */
async function routeRequest(
  event: APIGatewayProxyEvent,
  userContext: UserContext,
  requestId: string
): Promise<HandlerResponse> {
  const { httpMethod, path, pathParameters, resource } = event;
  
  // Parse path segments and proxy path
  const pathSegments = path.split('/').filter(Boolean);
  const proxyPath = pathParameters?.['proxy'] as string | undefined;
  const proxySegments = proxyPath ? proxyPath.split('/').filter(Boolean) : [];

  logger.info('🛣️ NOTIFICATION SERVICE ROUTING', {
    requestId,
    routingDetails: {
      httpMethod,
      originalPath: path,
      resource,
      pathParameters,
      pathSegments,
      proxyPath,
      proxySegments,
      userRole: userContext.role,
      userId: userContext.userId
    }
  });

  try {
    // Handle proxy-based routing
    if (proxyPath) {
      // POST /api/notifications/send (via proxy)
      if (httpMethod === 'POST' && proxySegments.length === 1 && proxySegments[0] === 'send') {
        logger.info('✅ MATCHED: POST send via proxy', {
          requestId,
          matchedRoute: 'sendEmail'
        });
        return await sendEmailHandler(event, userContext, requestId);
      }

      logger.warn('❌ NO PROXY ROUTE MATCH', {
        requestId,
        proxyPath,
        proxySegments,
        httpMethod,
        availableProxyRoutes: [
          'POST send'
        ]
      });
    }

    // Fallback to legacy path-segments routing
    logger.info('🔄 FALLBACK TO PATH-SEGMENTS ROUTING', {
      requestId,
      pathSegments,
      pathSegmentsLength: pathSegments.length
    });

    // POST /notifications/send (legacy path-segments)
    if (httpMethod === 'POST' && pathSegments.length === 2 &&
        pathSegments[0] === 'notifications' && pathSegments[1] === 'send') {
      logger.info('✅ MATCHED: POST notifications/send via path-segments', {
        requestId,
        matchedRoute: 'sendEmail'
      });
      return await sendEmailHandler(event, userContext, requestId);
    }

    // Handle base notifications endpoint
    if (httpMethod === 'GET' && (pathSegments.length === 1 && pathSegments[0] === 'notifications' || 
        pathSegments.length === 2 && pathSegments[0] === 'api' && pathSegments[1] === 'notifications')) {
      logger.info('✅ MATCHED: GET base notifications endpoint', {
        requestId,
        matchedRoute: 'baseNotificationsEndpoint'
      });
      return {
        statusCode: 200,
        body: {
          message: 'Notification service is running',
          service: 'notification-service',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          availableEndpoints: [
            'POST /api/notifications/send',
            'GET /api/notifications/health'
          ]
        }
      };
    }

    // Route not found
    logger.error('❌ ROUTE NOT FOUND', new Error(`Route not found: ${httpMethod} ${path}`), {
      requestId: requestId,
      routeNotFound: {
        httpMethod,
        path,
        resource,
        pathParameters,
        pathSegments,
        proxyPath,
        proxySegments,
        availableRoutes: {
          proxy: [
            'POST send'
          ],
          pathSegments: [
            'POST notifications/send',
            'GET notifications (base)'
          ]
        }
      }
    });

    return {
      statusCode: 404,
      body: {
        error: {
          code: 'NOT_FOUND',
          message: `Route not found: ${httpMethod} ${path}`,
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };

  } catch (error) {
    logger.error('Error routing request:', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: getCorsHeaders(),
    body: JSON.stringify({
      error: {
        code: errorCode,
        message,
        timestamp: new Date().toISOString(),
        requestId
      }
    })
  };
}