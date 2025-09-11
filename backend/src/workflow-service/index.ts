/**
 * Workflow Service Lambda Function
 * Handles book status transitions, workflow validation, and state machine management
 * 
 * Updated to use shared utilities for consistency and maintainability
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SharedLogger } from '../shared/logging/logger';
import { sharedResponseHandler } from '../shared/http/response-utils';
import { sharedCorsHandler } from '../shared/http/cors-utils';
import { Router, routerUtils } from '../shared/http/router';
import { extractUserContext } from '../shared/auth/auth-middleware';
import {
  UserRole,
  WorkflowAction
} from '../shared/types';

// Import route handlers
import { getBookStatus, getBookHistory } from './handlers/book-status';
import { executeTransition, validateTransition, executeWorkflowAction } from './handlers/workflow-transitions';
import { getTasks, getStatistics } from './handlers/workflow-tasks';

// Initialize shared logger for workflow service
const logger = new SharedLogger('workflow-service');

// Initialize router with shared utilities
const router = new Router({
  corsEnabled: true,
  authMiddleware: routerUtils.createAuthMiddleware()
});

// Configure routes with authentication
router
  .get('/books/{bookId}/status', getBookStatus, { requireAuth: true })
  .get('/books/{bookId}/history', getBookHistory, { requireAuth: true })
  .post('/books/{bookId}/transition', executeTransition, { requireAuth: true })
  .post('/books/{bookId}/validate-transition', validateTransition, { requireAuth: true })
  .get('/tasks', getTasks, { requireAuth: true })
  .get('/statistics', getStatistics, { requireAuth: true });

/**
 * Main Lambda handler - using legacy routing for backward compatibility
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  
  logger.setCorrelationId(requestId);
  logger.functionEntry('workflow-service-handler', {
    path: event.path,
    method: event.httpMethod,
    hasAuth: !!event.requestContext?.authorizer
  }, { requestId });

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return sharedCorsHandler.createOptionsResponse(
        event.headers?.['origin'] || event.headers?.['Origin']
      );
    }

    // Handle health check (no auth required)
    if (event.path === '/health' || event.path.endsWith('/health')) {
      return sharedResponseHandler.success({
        status: 'healthy',
        service: 'workflow-service',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }, 200, { requestId });
    }

    // Extract user context from authorizer
    const authResult = await extractUserContext(event, requestId);
    if (!authResult) {
      return sharedResponseHandler.unauthorized('Authentication required', { requestId });
    }

    // Route to appropriate handler using legacy routing
    const result = await legacyRouteRequest(event, authResult, requestId);

    return {
      statusCode: result.statusCode,
      headers: sharedCorsHandler.getHeaders(event.headers?.['origin'] || event.headers?.['Origin']),
      body: JSON.stringify(result.body)
    };

  } catch (error) {
    logger.error('Unhandled error in workflow service', error as Error, { requestId });
    return sharedResponseHandler.internalError('Internal server error', { requestId });
  }
};

/**
 * Modern router-based handler (for future use)
 */
export const routerHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  
  logger.setCorrelationId(requestId);
  logger.info('Using modern router handler', {
    path: event.path,
    method: event.httpMethod
  });

  try {
    // Handle health check (no auth required)
    if (event.path === '/health' || event.path.endsWith('/health')) {
      return sharedResponseHandler.success({
        status: 'healthy',
        service: 'workflow-service',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }, 200, { requestId });
    }

    // Use shared router for all other requests
    const result = await router.route(event, context);
    
    logger.functionExit('workflow-service-handler', { statusCode: result.statusCode }, { requestId });
    return result;

  } catch (error) {
    logger.error('Unhandled error in workflow service', error as Error, { requestId });
    return sharedResponseHandler.internalError('Internal server error', { requestId });
  }
};

// Legacy routing function for backward compatibility
async function legacyRouteRequest(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  const { httpMethod, path, pathParameters } = event;
  const pathSegments = path.split('/').filter(Boolean);
  const proxyPath = pathParameters?.['proxy'] as string | undefined;
  const proxySegments = proxyPath ? proxyPath.split('/').filter(Boolean) : [];

  logger.info('Legacy routing for backward compatibility', {
    requestId,
    httpMethod,
    path,
    proxyPath
  });

  try {
    // Handle proxy-based routing (like books service)
    if (proxyPath) {
      // GET /api/workflow/books/{bookId}/status (via proxy)
      if (httpMethod === 'GET' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'status') {
        const bookId = proxySegments[1];
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await legacyGetBookStatus(bookId, userContext, requestId);
      }

      // GET /api/workflow/books/{bookId}/history (via proxy)
      if (httpMethod === 'GET' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'history') {
        const bookId = proxySegments[1];
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await legacyGetBookHistory(bookId, event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/transition (via proxy)
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'transition') {
        const bookId = proxySegments[1];
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await legacyExecuteTransition(bookId, event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/validate-transition (via proxy)
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'validate-transition') {
        const bookId = proxySegments[1];
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await legacyValidateTransition(bookId, event, userContext, requestId);
      }

      // Legacy workflow action endpoints
      const legacyActions = ['submit', 'approve', 'reject', 'publish'];
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] && legacyActions.includes(proxySegments[2])) {
        const bookId = proxySegments[1];
        let action = proxySegments[2].toUpperCase() as WorkflowAction;
        
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }

        // Special handling: If an author calls "approve" on their own book, treat it as "submit"
        if (action === 'APPROVE' && userContext.role === 'AUTHOR') {
          logger.info('Author calling approve endpoint - treating as submit', {
            bookId,
            userId: userContext.userId,
            originalAction: action,
            mappedAction: 'SUBMIT'
          });
          action = 'SUBMIT';
        }
        
        return await executeWorkflowAction(bookId, action, event, userContext, requestId);
      }

      // Handle other proxy routes
      if (httpMethod === 'GET' && proxySegments.length === 1 && proxySegments[0] === 'tasks') {
        return await legacyGetTasks(event, userContext, requestId);
      }

      if (httpMethod === 'GET' && proxySegments.length === 1 && proxySegments[0] === 'statistics') {
        return await legacyGetStatistics(event, userContext, requestId);
      }
    }

    // Route not found
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
    logger.error('Error in legacy routing', error as Error, { requestId });
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

// Legacy wrapper functions that convert to old response format
async function legacyGetBookStatus(
  bookId: string,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    // Use shared utilities to get book status
    const mockEvent = {} as APIGatewayProxyEvent;
    const mockContext = { awsRequestId: requestId } as Context;
    const mockParams = { 
      pathParams: { bookId }, 
      queryParams: {}, 
      userContext: {
        ...userContext,
        permissions: []
      }
    } as any;
    
    const result = await getBookStatus(mockEvent, mockContext, mockParams);
    const responseBody = JSON.parse(result.body);
    
    return {
      statusCode: result.statusCode,
      body: responseBody.data || responseBody
    };
  } catch (error) {
    logger.error('Error in legacyGetBookStatus', error as Error, { requestId, bookId });
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get book status',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

async function legacyGetBookHistory(
  bookId: string,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    // Use shared utilities to get book history
    const mockParams = { 
      pathParams: { bookId }, 
      queryParams: {
        limit: event.queryStringParameters?.['limit'] || '50',
        lastEvaluatedKey: event.queryStringParameters?.['lastEvaluatedKey']
      }, 
      userContext: {
        ...userContext,
        permissions: []
      }
    } as any;
    const mockContext = { awsRequestId: requestId } as Context;
    
    const result = await getBookHistory(event, mockContext, mockParams);
    const responseBody = JSON.parse(result.body);
    
    return {
      statusCode: result.statusCode,
      body: responseBody.data || responseBody
    };
  } catch (error) {
    logger.error('Error in legacyGetBookHistory', error as Error, { requestId, bookId });
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get book history',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

async function legacyExecuteTransition(
  bookId: string,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    // Use shared utilities to execute transition
    const mockParams = { 
      pathParams: { bookId }, 
      queryParams: {}, 
      userContext: {
        ...userContext,
        permissions: []
      }
    } as any;
    const mockContext = { awsRequestId: requestId } as Context;
    
    const result = await executeTransition(event, mockContext, mockParams);
    const responseBody = JSON.parse(result.body);
    
    return {
      statusCode: result.statusCode,
      body: responseBody.data || responseBody
    };
  } catch (error) {
    logger.error('Error in legacyExecuteTransition', error as Error, { requestId, bookId });
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to execute transition',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

async function legacyValidateTransition(
  bookId: string,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    // Use shared utilities to validate transition
    const mockParams = { 
      pathParams: { bookId }, 
      queryParams: {}, 
      userContext: {
        ...userContext,
        permissions: []
      }
    } as any;
    const mockContext = { awsRequestId: requestId } as Context;
    
    const result = await validateTransition(event, mockContext, mockParams);
    const responseBody = JSON.parse(result.body);
    
    return {
      statusCode: result.statusCode,
      body: responseBody.data || responseBody
    };
  } catch (error) {
    logger.error('Error in legacyValidateTransition', error as Error, { requestId, bookId });
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate transition',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

async function legacyGetTasks(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    // Use shared utilities to get tasks
    const mockParams = { 
      pathParams: {}, 
      queryParams: {
        limit: event.queryStringParameters?.['limit'] || '20',
        status: event.queryStringParameters?.['status'],
        priority: event.queryStringParameters?.['priority']
      }, 
      userContext: {
        ...userContext,
        permissions: []
      }
    } as any;
    const mockContext = { awsRequestId: requestId } as Context;
    
    const result = await getTasks(event, mockContext, mockParams);
    const responseBody = JSON.parse(result.body);
    
    return {
      statusCode: result.statusCode,
      body: responseBody.data || responseBody
    };
  } catch (error) {
    logger.error('Error in legacyGetTasks', error as Error, { requestId });
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get tasks',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

async function legacyGetStatistics(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    // Use shared utilities to get statistics
    const mockParams = { 
      pathParams: {}, 
      queryParams: {
        timeframe: event.queryStringParameters?.['timeframe'] || '30d',
        includeDetails: event.queryStringParameters?.['includeDetails']
      }, 
      userContext: {
        ...userContext,
        permissions: []
      }
    } as any;
    const mockContext = { awsRequestId: requestId } as Context;
    
    const result = await getStatistics(event, mockContext, mockParams);
    const responseBody = JSON.parse(result.body);
    
    return {
      statusCode: result.statusCode,
      body: responseBody.data || responseBody
    };
  } catch (error) {
    logger.error('Error in legacyGetStatistics', error as Error, { requestId });
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get statistics',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}