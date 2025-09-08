/**
 * Workflow Service Lambda Function
 * Handles book status transitions, workflow validation, and state machine management
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { workflowDAO } from '../data/dao/workflow-dao';
import { bookDAO } from '../data/dao/book-dao';
import { logger } from '../utils/logger';
import { getCorsHeaders, createOptionsResponse } from '../utils/cors';
import { getWorkflowEventService } from './events/workflow-event-integration';
import {
  Book,
  BookStatus,
  UserRole,
  WorkflowAction,
  WorkflowEntry
} from '../types';

// Enhanced types for workflow service
interface BookAction {
  type: 'submit' | 'edit' | 'delete' | 'view' | 'approve' | 'reject' | 'publish';
  label: string;
  enabled: boolean;
  tooltip?: string | undefined;
}

interface WorkflowStage {
  current: BookStatus;
  displayName: string;
  description: string;
  isUserAction: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errorCode?: string;
  userMessage?: string;
  availableActions: BookAction[];
  suggestedAction?: string | undefined;
}

interface TransitionRequest {
  action: WorkflowAction;
  comments?: string;
  metadata?: Record<string, any>;
}

interface ValidationRequest {
  action: WorkflowAction;
  fromStatus?: BookStatus;
}

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;

  // COMPREHENSIVE DEBUG LOGGING - Event Structure Analysis
  logger.info('🔄 WORKFLOW SERVICE HANDLER STARTED - COMPREHENSIVE DEBUG MODE', {
    requestId,
    timestamp: new Date().toISOString(),
    path: event.path,
    method: event.httpMethod,
    resource: event.resource,
    stage: event.requestContext?.stage,
    apiId: event.requestContext?.apiId
  });

  // Log complete event structure for debugging
  logger.info('📋 COMPLETE EVENT STRUCTURE', {
    requestId,
    event: {
      httpMethod: event.httpMethod,
      path: event.path,
      resource: event.resource,
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      headers: event.headers,
      multiValueHeaders: event.multiValueHeaders,
      body: event.body ? 'present' : 'missing',
      isBase64Encoded: event.isBase64Encoded,
      requestContext: {
        requestId: event.requestContext?.requestId,
        stage: event.requestContext?.stage,
        resourcePath: event.requestContext?.resourcePath,
        httpMethod: event.requestContext?.httpMethod,
        path: event.requestContext?.path,
        apiId: event.requestContext?.apiId,
        authorizer: event.requestContext?.authorizer ? {
          userId: event.requestContext.authorizer['userId'],
          role: event.requestContext.authorizer['role'],
          email: event.requestContext.authorizer['email']
        } : 'missing'
      }
    }
  });

  // Compare with expected books service event structure
  logger.info('🔍 PATH ANALYSIS COMPARISON', {
    requestId,
    pathAnalysis: {
      receivedPath: event.path,
      receivedResource: event.resource,
      pathParameters: event.pathParameters,
      expectedProxyPattern: '/api/workflow/{proxy+}',
      expectedBasePattern: '/api/workflow',
      isProxyRequest: event.resource?.includes('{proxy+}') || false,
      isBaseRequest: event.path === '/api/workflow' || event.path.endsWith('/api/workflow'),
      proxyValue: event.pathParameters?.['proxy'] || 'not-present'
    }
  });

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createOptionsResponse(event.headers?.['origin'] || event.headers?.['Origin']);
    }

    // Handle health check (no auth required)
    if (event.path === '/health' || event.path.endsWith('/health')) {
      return {
        statusCode: 200,
        headers: getCorsHeaders(event.headers?.['origin'] || event.headers?.['Origin']),
        body: JSON.stringify({
          status: 'healthy',
          service: 'workflow-service',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        })
      };
    }

    // Extract user context from authorizer
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
    logger.error('❌ UNHANDLED ERROR IN WORKFLOW SERVICE', error instanceof Error ? error : new Error(String(error)), {
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
function extractUserContext(event: APIGatewayProxyEvent): { userId: string; role: UserRole; email: string; } | null {
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
      const userContext = {
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
      const userContext = {
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
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  const { httpMethod, path, pathParameters, resource } = event;
  
  // ENHANCED PATH PARSING DEBUG LOGGING
  const pathSegments = path.split('/').filter(Boolean);
  const proxyPath = pathParameters?.['proxy'] as string | undefined;
  const proxySegments = proxyPath ? proxyPath.split('/').filter(Boolean) : [];

  logger.info('🛣️ DETAILED ROUTING ANALYSIS', {
    requestId,
    routingDetails: {
      httpMethod,
      originalPath: path,
      resource,
      pathParameters,
      pathSegments,
      pathSegmentsCount: pathSegments.length,
      proxyPath,
      proxySegments,
      proxySegmentsCount: proxySegments.length,
      userRole: userContext.role,
      userId: userContext.userId
    }
  });

  // Compare with books service pattern
  logger.info('📊 BOOKS SERVICE COMPARISON', {
    requestId,
    comparison: {
      workflowPath: path,
      workflowResource: resource,
      workflowProxy: proxyPath,
      expectedBooksPattern: '/api/books/{proxy+}',
      expectedWorkflowPattern: '/api/workflow/{proxy+}',
      isProxyResource: resource?.includes('{proxy+}'),
      hasProxyParameter: !!proxyPath,
      pathMatchesProxy: path.startsWith('/api/workflow/') && path !== '/api/workflow'
    }
  });

  // Log path parsing steps
  logger.info('🔧 PATH PARSING STEPS', {
    requestId,
    parsingSteps: {
      step1_originalPath: path,
      step2_splitBySlash: path.split('/'),
      step3_filterEmpty: pathSegments,
      step4_identifySegments: {
        segment0: pathSegments[0] || 'missing',
        segment1: pathSegments[1] || 'missing', 
        segment2: pathSegments[2] || 'missing',
        segment3: pathSegments[3] || 'missing',
        segment4: pathSegments[4] || 'missing'
      },
      step5_proxyExtraction: {
        proxyFromParameters: proxyPath,
        proxySegments: proxySegments,
        expectedBookId: proxySegments[1] || 'not-found',
        expectedAction: proxySegments[2] || 'not-found'
      }
    }
  });

  try {
    // ENHANCED ROUTING LOGIC WITH PROXY SUPPORT
    logger.info('🎯 ROUTING DECISION ANALYSIS', {
      requestId,
      routingDecision: {
        httpMethod,
        pathSegmentsLength: pathSegments.length,
        hasProxyPath: !!proxyPath,
        routingStrategy: proxyPath ? 'proxy-based' : 'path-segments-based'
      }
    });

    // Handle proxy-based routing (like books service)
    if (proxyPath) {
      logger.info('🔀 PROXY ROUTING MODE', {
        requestId,
        proxyRouting: {
          proxyPath,
          proxySegments,
          expectedPattern: 'books/{bookId}/status|history|transition|validate-transition'
        }
      });

      // GET /api/workflow/books/{bookId}/status (via proxy)
      if (httpMethod === 'GET' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'status') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: GET books/{bookId}/status via proxy', {
          requestId,
          bookId,
          matchedRoute: 'getBookStatus'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await getBookStatus(bookId, userContext, requestId);
      }

      // GET /api/workflow/books/{bookId}/history (via proxy)
      if (httpMethod === 'GET' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'history') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: GET books/{bookId}/history via proxy', {
          requestId,
          bookId,
          matchedRoute: 'getBookHistory'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await getBookHistory(bookId, event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/transition (via proxy)
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'transition') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: POST books/{bookId}/transition via proxy', {
          requestId,
          bookId,
          matchedRoute: 'executeTransition'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await executeTransition(bookId, event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/validate-transition (via proxy)
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'validate-transition') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: POST books/{bookId}/validate-transition via proxy', {
          requestId,
          bookId,
          matchedRoute: 'validateTransition'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await validateTransition(bookId, event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/submit (via proxy) - Backward compatible endpoint
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'submit') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: POST books/{bookId}/submit via proxy', {
          requestId,
          bookId,
          matchedRoute: 'submitBook'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await executeWorkflowAction(bookId, 'SUBMIT', event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/approve (via proxy) - Backward compatible endpoint
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'approve') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: POST books/{bookId}/approve via proxy', {
          requestId,
          bookId,
          matchedRoute: 'approveBook'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await executeWorkflowAction(bookId, 'APPROVE', event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/reject (via proxy) - Backward compatible endpoint
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'reject') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: POST books/{bookId}/reject via proxy', {
          requestId,
          bookId,
          matchedRoute: 'rejectBook'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await executeWorkflowAction(bookId, 'REJECT', event, userContext, requestId);
      }

      // POST /api/workflow/books/{bookId}/publish (via proxy) - Backward compatible endpoint
      if (httpMethod === 'POST' && proxySegments.length === 3 &&
        proxySegments[0] === 'books' && proxySegments[2] === 'publish') {
        const bookId = proxySegments[1];
        logger.info('✅ MATCHED: POST books/{bookId}/publish via proxy', {
          requestId,
          bookId,
          matchedRoute: 'publishBook'
        });
        if (!bookId) {
          return {
            statusCode: 400,
            body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
          };
        }
        return await executeWorkflowAction(bookId, 'PUBLISH', event, userContext, requestId);
      }

      // Handle other proxy routes (tasks, statistics)
      if (httpMethod === 'GET' && proxySegments.length === 1 && proxySegments[0] === 'tasks') {
        logger.info('✅ MATCHED: GET tasks via proxy', {
          requestId,
          matchedRoute: 'getTasks'
        });
        return await getTasks(event, userContext, requestId);
      }

      if (httpMethod === 'GET' && proxySegments.length === 1 && proxySegments[0] === 'statistics') {
        logger.info('✅ MATCHED: GET statistics via proxy', {
          requestId,
          matchedRoute: 'getStatistics'
        });
        return await getStatistics(event, userContext, requestId);
      }

      logger.warn('❌ NO PROXY ROUTE MATCH', {
        requestId,
        proxyPath,
        proxySegments,
        httpMethod,
        availableProxyRoutes: [
          'GET books/{bookId}/status',
          'GET books/{bookId}/history', 
          'POST books/{bookId}/transition',
          'POST books/{bookId}/validate-transition',
          'POST books/{bookId}/submit',
          'POST books/{bookId}/approve',
          'POST books/{bookId}/reject',
          'POST books/{bookId}/publish',
          'GET tasks',
          'GET statistics'
        ]
      });
    }

    // Fallback to legacy path-segments routing for base endpoints
    logger.info('🔄 FALLBACK TO PATH-SEGMENTS ROUTING', {
      requestId,
      pathSegments,
      pathSegmentsLength: pathSegments.length
    });

    // GET /workflow/books/{bookId}/status (legacy path-segments)
    if (httpMethod === 'GET' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'status') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: GET workflow/books/{bookId}/status via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'getBookStatus'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await getBookStatus(bookId, userContext, requestId);
    }

    // GET /workflow/books/{bookId}/history (legacy path-segments)
    if (httpMethod === 'GET' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'history') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: GET workflow/books/{bookId}/history via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'getBookHistory'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await getBookHistory(bookId, event, userContext, requestId);
    }

    // POST /workflow/books/{bookId}/transition (legacy path-segments)
    if (httpMethod === 'POST' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'transition') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: POST workflow/books/{bookId}/transition via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'executeTransition'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await executeTransition(bookId, event, userContext, requestId);
    }

    // POST /workflow/books/{bookId}/validate-transition (legacy path-segments)
    if (httpMethod === 'POST' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'validate-transition') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: POST workflow/books/{bookId}/validate-transition via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'validateTransition'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await validateTransition(bookId, event, userContext, requestId);
    }

    // POST /workflow/books/{bookId}/submit (legacy path-segments) - Backward compatible endpoint
    if (httpMethod === 'POST' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'submit') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: POST workflow/books/{bookId}/submit via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'submitBook'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await executeWorkflowAction(bookId, 'SUBMIT', event, userContext, requestId);
    }

    // POST /workflow/books/{bookId}/approve (legacy path-segments) - Backward compatible endpoint
    if (httpMethod === 'POST' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'approve') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: POST workflow/books/{bookId}/approve via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'approveBook'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await executeWorkflowAction(bookId, 'APPROVE', event, userContext, requestId);
    }

    // POST /workflow/books/{bookId}/reject (legacy path-segments) - Backward compatible endpoint
    if (httpMethod === 'POST' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'reject') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: POST workflow/books/{bookId}/reject via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'rejectBook'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await executeWorkflowAction(bookId, 'REJECT', event, userContext, requestId);
    }

    // POST /workflow/books/{bookId}/publish (legacy path-segments) - Backward compatible endpoint
    if (httpMethod === 'POST' && pathSegments.length === 4 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'books' && pathSegments[3] === 'publish') {
      const bookId = pathSegments[2];
      logger.info('✅ MATCHED: POST workflow/books/{bookId}/publish via path-segments', {
        requestId,
        bookId,
        matchedRoute: 'publishBook'
      });
      if (!bookId) {
        return {
          statusCode: 400,
          body: { error: { code: 'MISSING_BOOK_ID', message: 'Book ID is required' } }
        };
      }
      return await executeWorkflowAction(bookId, 'PUBLISH', event, userContext, requestId);
    }

    // GET /workflow/tasks (legacy path-segments)
    if (httpMethod === 'GET' && pathSegments.length === 2 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'tasks') {
      logger.info('✅ MATCHED: GET workflow/tasks via path-segments', {
        requestId,
        matchedRoute: 'getTasks'
      });
      return await getTasks(event, userContext, requestId);
    }

    // GET /workflow/statistics (legacy path-segments)
    if (httpMethod === 'GET' && pathSegments.length === 2 &&
      pathSegments[0] === 'workflow' && pathSegments[1] === 'statistics') {
      logger.info('✅ MATCHED: GET workflow/statistics via path-segments', {
        requestId,
        matchedRoute: 'getStatistics'
      });
      return await getStatistics(event, userContext, requestId);
    }

    // Handle base workflow endpoint
    if (httpMethod === 'GET' && (pathSegments.length === 1 && pathSegments[0] === 'workflow' || 
        pathSegments.length === 2 && pathSegments[0] === 'api' && pathSegments[1] === 'workflow')) {
      logger.info('✅ MATCHED: GET base workflow endpoint', {
        requestId,
        matchedRoute: 'baseWorkflowEndpoint'
      });
      return {
        statusCode: 200,
        body: {
          message: 'Workflow service is running',
          service: 'workflow-service',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }

    // Route not found - Enhanced debugging
    logger.error('❌ ROUTE NOT FOUND - COMPREHENSIVE DEBUG INFO', new Error(`Route not found: ${httpMethod} ${path}`), {
      requestId: requestId,
      routeNotFound: {
        httpMethod,
        path,
        resource,
        pathParameters,
        pathSegments,
        pathSegmentsLength: pathSegments.length,
        proxyPath,
        proxySegments,
        proxySegmentsLength: proxySegments.length,
        availableRoutes: {
          proxy: [
            'GET books/{bookId}/status',
            'GET books/{bookId}/history',
            'POST books/{bookId}/transition', 
            'POST books/{bookId}/validate-transition',
            'GET tasks',
            'GET statistics'
          ],
          pathSegments: [
            'GET workflow/books/{bookId}/status',
            'GET workflow/books/{bookId}/history',
            'POST workflow/books/{bookId}/transition',
            'POST workflow/books/{bookId}/validate-transition',
            'POST workflow/books/{bookId}/submit',
            'POST workflow/books/{bookId}/approve',
            'POST workflow/books/{bookId}/reject',
            'POST workflow/books/{bookId}/publish',
            'GET workflow/tasks',
            'GET workflow/statistics',
            'GET workflow (base)'
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
          debug: {
            path,
            resource,
            pathParameters,
            pathSegments,
            proxyPath,
            proxySegments
          },
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
 * GET /workflow/books/{bookId}/status
 */
async function getBookStatus(
  bookId: string,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('📊 EXECUTING: getBookStatus', { 
      requestId, 
      bookId, 
      userRole: userContext.role,
      userId: userContext.userId,
      functionName: 'getBookStatus'
    });

    // Get book details
    const book = await bookDAO.getBookById(bookId);
    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'BOOK_NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Check access permissions
    if (!canAccessBook(book, userContext)) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this book',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Get workflow summary
    const workflowSummary = await workflowDAO.getBookWorkflowSummary(bookId);

    // Get available actions
    const availableActions = getAvailableActions(book, userContext);

    // Get workflow stage info
    const workflowStage = getWorkflowStage(book.status);

    // Get next steps
    const nextSteps = getNextSteps(book.status, userContext.role);

    return {
      statusCode: 200,
      body: {
        bookId: book.bookId,
        currentStatus: book.status,
        availableActions,
        workflowStage,
        nextSteps,
        timeInCurrentStatus: workflowSummary.timeInCurrentStatus
      }
    };

  } catch (error) {
    logger.error('Error getting book status:', error instanceof Error ? error : new Error(String(error)));
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

/**
 * GET /workflow/books/{bookId}/history
 */
async function getBookHistory(
  bookId: string,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('Getting book history', { requestId, bookId, userRole: userContext.role });

    // Get book details for access control
    const book = await bookDAO.getBookById(bookId);
    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'BOOK_NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Check access permissions
    if (!canAccessBook(book, userContext)) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this book',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Parse query parameters
    const limit = parseInt(event.queryStringParameters?.['limit'] || '50');
    const lastEvaluatedKey = event.queryStringParameters?.['lastEvaluatedKey'];

    // Get workflow history
    const result = await workflowDAO.getBookWorkflowHistory(bookId, limit, lastEvaluatedKey);

    return {
      statusCode: 200,
      body: {
        bookId,
        history: result.history,
        hasMore: result.hasMore,
        lastEvaluatedKey: result.lastEvaluatedKey
      }
    };

  } catch (error) {
    logger.error('Error getting book history:', error instanceof Error ? error : new Error(String(error)));
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

/**
 * Execute workflow action (backward-compatible endpoints)
 * Calls the existing transition logic with the specified action
 */
async function executeWorkflowAction(
  bookId: string,
  action: WorkflowAction,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('Executing workflow action via backward-compatible endpoint', { 
      requestId, 
      bookId, 
      action,
      userRole: userContext.role,
      userId: userContext.userId,
      functionName: 'executeWorkflowAction'
    });

    // Parse request body for comments and metadata (optional)
    const body = event.body ? JSON.parse(event.body) : {};
    const { comments, metadata } = body;

    // Create transition request
    const transitionRequest: TransitionRequest = {
      action,
      comments,
      metadata
    };

    // Create a modified event with the transition request body
    const modifiedEvent: APIGatewayProxyEvent = {
      ...event,
      body: JSON.stringify(transitionRequest)
    };

    // Call the existing transition logic
    return await executeTransition(bookId, modifiedEvent, userContext, requestId);

  } catch (error) {
    logger.error('Error executing workflow action:', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      body: {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        userMessage: 'Failed to execute workflow action',
        timestamp: new Date().toISOString(),
        requestId
      }
    };
  }
}

/**
 * POST /workflow/books/{bookId}/transition
 */
async function executeTransition(
  bookId: string,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('Executing workflow transition', { requestId, bookId, userRole: userContext.role });

    // Parse request body
    const body: TransitionRequest = event.body ? JSON.parse(event.body) : {};
    const { action, comments, metadata } = body;

    if (!action) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'MISSING_ACTION',
            message: 'Action is required',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Get current book state
    const book = await bookDAO.getBookById(bookId);
    if (!book) {
      return {
        statusCode: 404,
        body: {
          error: {
            code: 'BOOK_NOT_FOUND',
            message: 'Book not found',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Validate transition
    const validation = validateWorkflowTransition(book, action, userContext);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        body: {
          success: false,
          errorCode: validation.errorCode,
          userMessage: validation.userMessage,
          availableActions: validation.availableActions,
          suggestedAction: validation.suggestedAction,
          currentStatus: book.status
        }
      };
    }

    // Determine new status
    const newStatus = getNewStatusForAction(action, book.status);
    if (!newStatus) {
      return {
        statusCode: 400,
        body: {
          success: false,
          errorCode: 'INVALID_TRANSITION',
          userMessage: `Cannot perform ${action} on book in ${book.status} status`,
          availableActions: getAvailableActions(book, userContext),
          currentStatus: book.status
        }
      };
    }

    // Update book status
    const updatedBook = await bookDAO.updateBookStatus(
      bookId,
      newStatus,
      userContext.role,
      userContext.userId,
      book.version
    );
    if (!updatedBook) {
      throw new Error('Failed to update book status');
    }

    // Record workflow transition
    await workflowDAO.recordTransition(
      bookId,
      book.status,
      newStatus,
      userContext.userId,
      action,
      comments,
      metadata
    );

    // Publish book status change event (async, don't block workflow)
    logger.info('🔔 INITIATING EVENT PUBLISHING FOR WORKFLOW TRANSITION', {
      bookId,
      fromStatus: book.status,
      toStatus: newStatus,
      action,
      userRole: userContext.role,
      requestId
    });
    
    const workflowEventService = getWorkflowEventService();
    workflowEventService.publishBookStatusChangeEvent(
      updatedBook,
      book.status,
      newStatus,
      userContext.userId,
      comments,
      {
        action,
        userRole: userContext.role,
        userEmail: userContext.email,
        requestId,
        ...metadata
      }
    ).catch(error => {
      // Event publishing failure should not affect the workflow
      logger.warn('Event publishing failed but workflow transition completed', {
        bookId,
        fromStatus: book.status,
        toStatus: newStatus,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Get new available actions
    const availableActions = getAvailableActions(updatedBook, userContext);

    // Create workflow entry for response
    const workflowEntry: WorkflowEntry = {
      bookId,
      fromState: book.status,
      toState: newStatus,
      actionBy: userContext.userId,
      action,
      timestamp: new Date().toISOString()
    };

    if (comments) {
      workflowEntry.comments = comments;
    }

    if (metadata) {
      workflowEntry.metadata = metadata;
    }

    logger.info('Workflow transition completed', {
      requestId,
      bookId,
      fromStatus: book.status,
      toStatus: newStatus,
      action,
      userId: userContext.userId
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        newStatus,
        message: getTransitionSuccessMessage(action, newStatus),
        availableActions,
        workflowEntry
      }
    };

  } catch (error) {
    logger.error('Error executing transition:', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      body: {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        userMessage: 'Failed to execute workflow transition',
        timestamp: new Date().toISOString(),
        requestId
      }
    };
  }
}

/**
 * POST /workflow/books/{bookId}/validate-transition
 */
async function validateTransition(
  bookId: string,
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('Validating workflow transition', { requestId, bookId, userRole: userContext.role });

    // Parse request body
    const body: ValidationRequest = event.body ? JSON.parse(event.body) : {};
    const { action, fromStatus } = body;

    if (!action) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'MISSING_ACTION',
            message: 'Action is required',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Get current book state if fromStatus not provided
    let currentStatus = fromStatus;
    let book: Book | null = null;

    if (!currentStatus) {
      book = await bookDAO.getBookById(bookId);
      if (!book) {
        return {
          statusCode: 404,
          body: {
            error: {
              code: 'BOOK_NOT_FOUND',
              message: 'Book not found',
              timestamp: new Date().toISOString(),
              requestId
            }
          }
        };
      }
      currentStatus = book.status;
    } else {
      // Still need book for access control
      book = await bookDAO.getBookById(bookId);
      if (!book) {
        return {
          statusCode: 404,
          body: {
            error: {
              code: 'BOOK_NOT_FOUND',
              message: 'Book not found',
              timestamp: new Date().toISOString(),
              requestId
            }
          }
        };
      }
    }

    // Create a mock book object for validation if we only have status
    const bookForValidation = book || {
      bookId,
      status: currentStatus,
      authorId: '',
      title: '',
      description: '',
      content: '',
      genre: 'fiction' as const,
      tags: [],
      wordCount: 0,
      createdAt: '',
      updatedAt: '',
      version: 1
    };

    // Validate transition
    const validation = validateWorkflowTransition(bookForValidation, action, userContext);

    return {
      statusCode: 200,
      body: validation
    };

  } catch (error) {
    logger.error('Error validating transition:', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      body: {
        isValid: false,
        errorCode: 'INTERNAL_ERROR',
        userMessage: 'Failed to validate transition',
        availableActions: [],
        timestamp: new Date().toISOString(),
        requestId
      }
    };
  }
}

/**
 * GET /workflow/tasks
 */
async function getTasks(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('Getting workflow tasks', { requestId, userRole: userContext.role });

    // Parse query parameters
    const limit = parseInt(event.queryStringParameters?.['limit'] || '20');
    const roleFilter = event.queryStringParameters?.['role'] as UserRole;
    const statusFilter = event.queryStringParameters?.['status'] as BookStatus;

    // Use the requesting user's role if no role filter provided
    const targetRole = roleFilter || userContext.role;

    // Get books requiring action for this role
    const bookIds = await workflowDAO.getBooksRequiringAction(targetRole, limit * 2); // Get more to account for filtering

    // Get book details for each ID
    const tasks = [];
    for (const bookId of bookIds.slice(0, limit)) {
      try {
        const book = await bookDAO.getBookById(bookId);
        if (!book) continue;

        // Apply status filter if provided
        if (statusFilter && book.status !== statusFilter) continue;

        // Check if user can access this book
        if (!canAccessBook(book, userContext)) continue;

        // Get author details
        const author = await bookDAO.getBookAuthor(book.authorId);
        const authorName = author ? `${author.firstName} ${author.lastName}` : 'Unknown Author';

        // Determine required action and priority
        const requiredAction = getRequiredActionForStatus(book.status, targetRole);
        const priority = getTaskPriority(book.status, book.updatedAt);

        if (requiredAction) {
          tasks.push({
            bookId: book.bookId,
            bookTitle: book.title,
            authorName,
            currentStatus: book.status,
            requiredAction,
            timeInStatus: Math.floor((Date.now() - new Date(book.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
            priority
          });
        }
      } catch (error) {
        logger.warn('Error processing task book:', { bookId, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }

    return {
      statusCode: 200,
      body: {
        tasks,
        totalCount: tasks.length
      }
    };

  } catch (error) {
    logger.error('Error getting tasks:', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get workflow tasks',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

/**
 * GET /workflow/statistics
 */
async function getStatistics(
  event: APIGatewayProxyEvent,
  userContext: { userId: string; role: UserRole; email: string; },
  requestId: string
): Promise<{ statusCode: number; body: any; }> {
  try {
    logger.info('Getting workflow statistics', { requestId, userRole: userContext.role });

    // Only allow admin roles to access statistics
    if (!['EDITOR', 'PUBLISHER'].includes(userContext.role)) {
      return {
        statusCode: 403,
        body: {
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to workflow statistics',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Parse query parameters
    const startDate = event.queryStringParameters?.['startDate'] ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Default: 30 days ago
    const endDate = event.queryStringParameters?.['endDate'] || new Date().toISOString();

    // Get workflow statistics
    const stats = await workflowDAO.getWorkflowStatistics(startDate, endDate);

    // Get current books in each status (simplified implementation)
    const booksInStatus = await getCurrentBooksInStatus();

    // Calculate throughput metrics
    const daysDiff = Math.max(1, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
    const booksPerDay = stats.totalTransitions / daysDiff;
    const averageProcessingTime = calculateAverageProcessingTime(stats.averageTimeInStatus);

    return {
      statusCode: 200,
      body: {
        ...stats,
        booksInStatus,
        throughputMetrics: {
          booksPerDay: Math.round(booksPerDay * 100) / 100,
          averageProcessingTime: Math.round(averageProcessingTime * 100) / 100
        }
      }
    };

  } catch (error) {
    logger.error('Error getting statistics:', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get workflow statistics',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}

// Helper Functions

/**
 * Check if user can access a book based on role and ownership
 */
function canAccessBook(book: Book, userContext: { userId: string; role: UserRole; }): boolean {
  switch (userContext.role) {
    case 'AUTHOR':
      return book.authorId === userContext.userId;
    case 'EDITOR':
      return ['SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'].includes(book.status);
    case 'PUBLISHER':
      return ['READY_FOR_PUBLICATION', 'PUBLISHED'].includes(book.status);
    case 'READER':
      return book.status === 'PUBLISHED';
    default:
      return false;
  }
}

/**
 * Get available actions for a book based on status and user role
 */
function getAvailableActions(book: Book, userContext: { userId: string; role: UserRole; }): BookAction[] {
  const actions: BookAction[] = [];

  // View action - always available if user can access book
  if (canAccessBook(book, userContext)) {
    actions.push({
      type: 'view',
      label: 'View Book',
      enabled: true
    });
  }

  // Role-specific actions
  switch (userContext.role) {
    case 'AUTHOR':
      if (book.authorId === userContext.userId) {
        // Edit action
        const editAction: BookAction = {
          type: 'edit',
          label: 'Edit Book',
          enabled: book.status === 'DRAFT'
        };
        if (book.status !== 'DRAFT') {
          editAction.tooltip = 'Cannot edit while under review or published';
        }
        actions.push(editAction);

        // Delete action
        const deleteAction: BookAction = {
          type: 'delete',
          label: 'Delete Book',
          enabled: book.status === 'DRAFT'
        };
        if (book.status !== 'DRAFT') {
          deleteAction.tooltip = 'Cannot delete while under review or published';
        }
        actions.push(deleteAction);

        // Submit action
        const submitAction: BookAction = {
          type: 'submit',
          label: 'Submit for Editing',
          enabled: book.status === 'DRAFT'
        };
        if (book.status === 'SUBMITTED_FOR_EDITING') {
          submitAction.tooltip = 'Book is already submitted for editing';
        } else if (book.status === 'READY_FOR_PUBLICATION') {
          submitAction.tooltip = 'Book is ready for publication';
        } else if (book.status === 'PUBLISHED') {
          submitAction.tooltip = 'Book is already published';
        }
        actions.push(submitAction);
      }
      break;

    case 'EDITOR':
      if (book.status === 'SUBMITTED_FOR_EDITING') {
        actions.push({
          type: 'approve',
          label: 'Approve for Publication',
          enabled: true
        });

        actions.push({
          type: 'reject',
          label: 'Reject to Draft',
          enabled: true
        });
      }
      break;

    case 'PUBLISHER':
      if (book.status === 'READY_FOR_PUBLICATION') {
        actions.push({
          type: 'publish',
          label: 'Publish Book',
          enabled: true
        });

        actions.push({
          type: 'reject',
          label: 'Reject to Draft',
          enabled: true
        });
      }
      break;
  }

  return actions;
}

/**
 * Get workflow stage information for a status
 */
function getWorkflowStage(status: BookStatus): WorkflowStage {
  const stages: Record<BookStatus, WorkflowStage> = {
    DRAFT: {
      current: 'DRAFT',
      displayName: 'Draft',
      description: 'Book is being written and can be edited by the author',
      isUserAction: true
    },
    SUBMITTED_FOR_EDITING: {
      current: 'SUBMITTED_FOR_EDITING',
      displayName: 'Under Review',
      description: 'Book has been submitted and is being reviewed by an editor',
      isUserAction: false
    },
    READY_FOR_PUBLICATION: {
      current: 'READY_FOR_PUBLICATION',
      displayName: 'Ready for Publication',
      description: 'Book has been approved by an editor and is ready to be published',
      isUserAction: false
    },
    PUBLISHED: {
      current: 'PUBLISHED',
      displayName: 'Published',
      description: 'Book has been published and is available to readers',
      isUserAction: false
    }
  };

  return stages[status];
}

/**
 * Get next steps for a user based on book status and their role
 */
function getNextSteps(status: BookStatus, userRole: UserRole): string[] {
  const nextSteps: Record<BookStatus, Record<UserRole, string[]>> = {
    DRAFT: {
      AUTHOR: ['Complete your book content', 'Review and edit your work', 'Submit for editing when ready'],
      EDITOR: ['Wait for author to submit book'],
      PUBLISHER: ['Wait for book to be approved by editor'],
      READER: ['Book is not yet available']
    },
    SUBMITTED_FOR_EDITING: {
      AUTHOR: ['Wait for editor review', 'Book cannot be edited during review'],
      EDITOR: ['Review the book content', 'Approve for publication or reject with feedback'],
      PUBLISHER: ['Wait for editor approval'],
      READER: ['Book is not yet available']
    },
    READY_FOR_PUBLICATION: {
      AUTHOR: ['Wait for publisher to publish the book'],
      EDITOR: ['Book review complete'],
      PUBLISHER: ['Review final book', 'Publish the book or reject with feedback'],
      READER: ['Book will be available soon']
    },
    PUBLISHED: {
      AUTHOR: ['Book is live and available to readers', 'Monitor reviews and feedback'],
      EDITOR: ['Book is successfully published'],
      PUBLISHER: ['Book is successfully published'],
      READER: ['Book is available to read', 'Leave a review after reading']
    }
  };

  return nextSteps[status]?.[userRole] || [];
}

/**
 * Validate a workflow transition
 */
function validateWorkflowTransition(
  book: Book,
  action: WorkflowAction,
  userContext: { userId: string; role: UserRole; }
): ValidationResult {
  const availableActions = getAvailableActions(book, userContext);

  // Check if user has permission for this action
  if (!hasPermissionForAction(action, userContext.role, book, userContext.userId)) {
    const result: ValidationResult = {
      isValid: false,
      errorCode: 'PERMISSION_DENIED',
      userMessage: getPermissionDeniedMessage(action, userContext.role),
      availableActions
    };
    const suggestion = getSuggestedAction(book.status, userContext.role);
    if (suggestion) {
      result.suggestedAction = suggestion;
    }
    return result;
  }

  // Check if transition is valid for current status
  if (!workflowDAO.validateWorkflowAction(action, book.status, getNewStatusForAction(action, book.status)!)) {
    const result: ValidationResult = {
      isValid: false,
      errorCode: 'INVALID_TRANSITION',
      userMessage: getInvalidTransitionMessage(action, book.status),
      availableActions
    };
    const suggestion = getSuggestedAction(book.status, userContext.role);
    if (suggestion) {
      result.suggestedAction = suggestion;
    }
    return result;
  }

  return {
    isValid: true,
    availableActions
  };
}

/**
 * Check if user has permission for an action
 */
function hasPermissionForAction(
  action: WorkflowAction,
  userRole: UserRole,
  book: Book,
  userId: string
): boolean {
  switch (action) {
    case 'SUBMIT':
      return userRole === 'AUTHOR' && book.authorId === userId;
    case 'APPROVE':
    case 'REJECT':
      return userRole === 'EDITOR' || userRole === 'PUBLISHER';
    case 'PUBLISH':
      return userRole === 'PUBLISHER';
    default:
      return false;
  }
}

/**
 * Get new status for an action
 */
function getNewStatusForAction(action: WorkflowAction, currentStatus: BookStatus): BookStatus | null {
  const transitions: Record<WorkflowAction, Partial<Record<BookStatus, BookStatus>>> = {
    SUBMIT: {
      DRAFT: 'SUBMITTED_FOR_EDITING'
    },
    APPROVE: {
      SUBMITTED_FOR_EDITING: 'READY_FOR_PUBLICATION'
    },
    REJECT: {
      SUBMITTED_FOR_EDITING: 'DRAFT',
      READY_FOR_PUBLICATION: 'DRAFT'
    },
    PUBLISH: {
      READY_FOR_PUBLICATION: 'PUBLISHED'
    },
    CREATE: {
      // This would be handled differently, not through this function
    }
  };

  return transitions[action]?.[currentStatus] || null;
}

/**
 * Get success message for a transition
 */
function getTransitionSuccessMessage(action: WorkflowAction, newStatus: BookStatus): string {
  const messages: Record<WorkflowAction, string> = {
    SUBMIT: 'Book successfully submitted for editing',
    APPROVE: 'Book approved and ready for publication',
    REJECT: 'Book rejected and returned to draft status',
    PUBLISH: 'Book successfully published',
    CREATE: 'Book created successfully'
  };

  return messages[action] || `Book status updated to ${newStatus}`;
}

/**
 * Get permission denied message
 */
function getPermissionDeniedMessage(action: WorkflowAction, userRole: UserRole): string {
  const messages: Record<WorkflowAction, Record<UserRole, string>> = {
    SUBMIT: {
      AUTHOR: 'You can only submit your own books',
      EDITOR: 'Only authors can submit books for editing',
      PUBLISHER: 'Only authors can submit books for editing',
      READER: 'Only authors can submit books for editing'
    },
    APPROVE: {
      AUTHOR: 'Only editors can approve books',
      EDITOR: 'You have permission to approve books',
      PUBLISHER: 'You have permission to approve books',
      READER: 'Only editors and publishers can approve books'
    },
    REJECT: {
      AUTHOR: 'Only editors and publishers can reject books',
      EDITOR: 'You have permission to reject books',
      PUBLISHER: 'You have permission to reject books',
      READER: 'Only editors and publishers can reject books'
    },
    PUBLISH: {
      AUTHOR: 'Only publishers can publish books',
      EDITOR: 'Only publishers can publish books',
      PUBLISHER: 'You have permission to publish books',
      READER: 'Only publishers can publish books'
    },
    CREATE: {
      AUTHOR: 'You have permission to create books',
      EDITOR: 'Only authors can create books',
      PUBLISHER: 'Only authors can create books',
      READER: 'Only authors can create books'
    }
  };

  return messages[action]?.[userRole] || `You don't have permission to perform ${action}`;
}

/**
 * Get invalid transition message
 */
function getInvalidTransitionMessage(action: WorkflowAction, currentStatus: BookStatus): string {
  const messages: Record<WorkflowAction, Record<BookStatus, string>> = {
    SUBMIT: {
      DRAFT: '',
      SUBMITTED_FOR_EDITING: 'This book has already been submitted for editing and cannot be submitted again.',
      READY_FOR_PUBLICATION: 'This book is ready for publication and cannot be submitted again.',
      PUBLISHED: 'This book is already published and cannot be submitted again.'
    },
    APPROVE: {
      DRAFT: 'Books must be submitted for editing before they can be approved.',
      SUBMITTED_FOR_EDITING: '',
      READY_FOR_PUBLICATION: 'This book has already been approved for publication.',
      PUBLISHED: 'This book is already published.'
    },
    REJECT: {
      DRAFT: 'Books in draft status cannot be rejected.',
      SUBMITTED_FOR_EDITING: '',
      READY_FOR_PUBLICATION: '',
      PUBLISHED: 'Published books cannot be rejected.'
    },
    PUBLISH: {
      DRAFT: 'Books must be approved before they can be published.',
      SUBMITTED_FOR_EDITING: 'Books must be approved before they can be published.',
      READY_FOR_PUBLICATION: '',
      PUBLISHED: 'This book is already published.'
    },
    CREATE: {
      DRAFT: 'Book already exists',
      SUBMITTED_FOR_EDITING: 'Book already exists',
      READY_FOR_PUBLICATION: 'Book already exists',
      PUBLISHED: 'Book already exists'
    }
  };

  return messages[action]?.[currentStatus] || `Cannot perform ${action} on book in ${currentStatus} status`;
}

/**
 * Get suggested action for current status and role
 */
function getSuggestedAction(status: BookStatus, userRole: UserRole): string | undefined {
  const suggestions: Record<BookStatus, Record<UserRole, string>> = {
    DRAFT: {
      AUTHOR: 'Complete your book and submit it for editing',
      EDITOR: 'Wait for the author to submit the book',
      PUBLISHER: 'Wait for the book to be approved by an editor',
      READER: 'This book is not yet available'
    },
    SUBMITTED_FOR_EDITING: {
      AUTHOR: 'Wait for editor review',
      EDITOR: 'Review the book and approve or reject it',
      PUBLISHER: 'Wait for editor approval',
      READER: 'This book is not yet available'
    },
    READY_FOR_PUBLICATION: {
      AUTHOR: 'Wait for publisher to publish the book',
      EDITOR: 'Book review is complete',
      PUBLISHER: 'Review and publish the book',
      READER: 'This book will be available soon'
    },
    PUBLISHED: {
      AUTHOR: 'Your book is now live',
      EDITOR: 'Book is successfully published',
      PUBLISHER: 'Book is successfully published',
      READER: 'You can now read this book'
    }
  };

  return suggestions[status]?.[userRole];
}

/**
 * Get required action for a status and role
 */
function getRequiredActionForStatus(status: BookStatus, role: UserRole): WorkflowAction | null {
  const requiredActions: Record<BookStatus, Record<UserRole, WorkflowAction | null>> = {
    DRAFT: {
      AUTHOR: 'SUBMIT',
      EDITOR: null,
      PUBLISHER: null,
      READER: null
    },
    SUBMITTED_FOR_EDITING: {
      AUTHOR: null,
      EDITOR: 'APPROVE', // or REJECT
      PUBLISHER: null,
      READER: null
    },
    READY_FOR_PUBLICATION: {
      AUTHOR: null,
      EDITOR: null,
      PUBLISHER: 'PUBLISH', // or REJECT
      READER: null
    },
    PUBLISHED: {
      AUTHOR: null,
      EDITOR: null,
      PUBLISHER: null,
      READER: null
    }
  };

  return requiredActions[status]?.[role] || null;
}

/**
 * Get task priority based on status and time
 */
function getTaskPriority(_status: BookStatus, updatedAt: string): 'high' | 'medium' | 'low' {
  const daysSinceUpdate = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));

  // High priority if waiting more than 7 days
  if (daysSinceUpdate > 7) return 'high';

  // Medium priority if waiting 3-7 days
  if (daysSinceUpdate > 3) return 'medium';

  // Low priority if less than 3 days
  return 'low';
}

/**
 * Get current books in each status (simplified implementation)
 */
async function getCurrentBooksInStatus(): Promise<Record<BookStatus, number>> {
  // This is a simplified implementation
  // In production, you might want to maintain counters or use a more efficient query
  const counts: Record<BookStatus, number> = {
    DRAFT: 0,
    SUBMITTED_FOR_EDITING: 0,
    READY_FOR_PUBLICATION: 0,
    PUBLISHED: 0
  };

  try {
    // This would need to be implemented based on your book DAO capabilities
    // For now, return empty counts
    return counts;
  } catch (error) {
    logger.error('Error getting books in status:', error instanceof Error ? error : new Error(String(error)));
    return counts;
  }
}

/**
 * Calculate average processing time across all statuses
 */
function calculateAverageProcessingTime(averageTimeInStatus: Record<BookStatus, number>): number {
  const times = Object.values(averageTimeInStatus).filter(time => time > 0);
  if (times.length === 0) return 0;

  return times.reduce((sum, time) => sum + time, 0) / times.length;
}

/**
 * Create error response with enhanced logging
 */
function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const errorResponse = {
    statusCode,
    headers: getCorsHeaders(),
    body: JSON.stringify({
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        requestId
      }
    })
  };

  logger.error('🚨 ERROR RESPONSE CREATED', new Error(`${code}: ${message}`), {
    requestId: requestId,
    statusCode: statusCode,
    errorCode: code
  });

  return errorResponse;
}