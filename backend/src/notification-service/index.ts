/**
 * Notification Service Lambda Function
 * Handles email notification delivery using AWS SES
 * Supports both API Gateway (HTTP) and SQS (event-driven) invocations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, SQSEvent, Context } from 'aws-lambda';
import { logger } from '../utils/logger';
import { getCorsHeaders, createOptionsResponse } from '../utils/cors';
import { UserRole } from '../types';
import { UserContext, HandlerResponse } from './types/notification';
import { sendEmailHandler } from './handlers/send-email';
import { healthCheckHandler } from './handlers/health';
import { sqsHandler } from './handlers/sqs-event-handler';

/**
 * Event type enumeration for better type safety
 */
enum EventType {
  SQS = 'SQS',
  API_GATEWAY = 'API_GATEWAY',
  DYNAMODB = 'DYNAMODB',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Event detection result interface
 */
interface EventDetectionResult {
  eventType: EventType;
  isValid: boolean;
  errors: string[];
  metadata: {
    hasRecords?: boolean;
    recordCount?: number;
    eventSource?: string;
    firstRecordKeys?: string[];
    hasPath?: boolean;
    hasHttpMethod?: boolean;
    hasRequestContext?: boolean;
    [key: string]: any;
  };
}

/**
 * Enhanced event detection with comprehensive null safety and validation
 */
function detectEventType(event: any, context: Context): EventDetectionResult {
  const requestId = context.awsRequestId;
  const result: EventDetectionResult = {
    eventType: EventType.UNKNOWN,
    isValid: false,
    errors: [],
    metadata: {}
  };

  logger.info('🔍 STARTING EVENT TYPE DETECTION', {
    requestId,
    eventKeys: event ? Object.keys(event) : [],
    eventType: typeof event,
    isNull: event === null,
    isUndefined: event === undefined
  });

  try {
    // Basic null/undefined checks
    if (!event || typeof event !== 'object') {
      result.errors.push('Event is null, undefined, or not an object');
      logger.error('❌ INVALID EVENT OBJECT', new Error('Event validation failed'), {
        requestId,
        eventType: typeof event,
        eventValue: event
      });
      return result;
    }

    // Check for Records property (SQS/DynamoDB events)
    const hasRecords = 'Records' in event && event.Records !== null && event.Records !== undefined;
    result.metadata.hasRecords = hasRecords;

    if (hasRecords) {
      // Validate Records array
      if (!Array.isArray(event.Records)) {
        result.errors.push('Records property exists but is not an array');
        logger.error('❌ INVALID RECORDS PROPERTY', new Error('Records is not an array'), {
          requestId,
          recordsType: typeof event.Records,
          recordsValue: event.Records
        });
        return result;
      }

      const recordCount = event.Records.length;
      result.metadata.recordCount = recordCount;

      logger.info('📋 RECORDS DETECTED', {
        requestId,
        recordCount,
        hasRecords: true
      });

      if (recordCount === 0) {
        result.errors.push('Records array is empty');
        logger.warn('⚠️ EMPTY RECORDS ARRAY', {
          requestId,
          recordCount: 0
        });
        return result;
      }

      // Examine first record for event source detection
      const firstRecord = event.Records[0];
      if (!firstRecord || typeof firstRecord !== 'object') {
        result.errors.push('First record is null, undefined, or not an object');
        logger.error('❌ INVALID FIRST RECORD', new Error('First record validation failed'), {
          requestId,
          firstRecordType: typeof firstRecord,
          firstRecordValue: firstRecord
        });
        return result;
      }

      const firstRecordKeys = Object.keys(firstRecord);
      result.metadata.firstRecordKeys = firstRecordKeys;
      result.metadata.eventSource = firstRecord.eventSource;

      logger.info('🔍 ANALYZING FIRST RECORD', {
        requestId,
        firstRecordKeys,
        eventSource: firstRecord.eventSource,
        hasEventSource: 'eventSource' in firstRecord,
        hasReceiptHandle: 'receiptHandle' in firstRecord,
        hasMessageId: 'messageId' in firstRecord
      });

      // SQS Event Detection
      if (firstRecord.eventSource === 'aws:sqs' || 
          ('receiptHandle' in firstRecord && 'messageId' in firstRecord && 'body' in firstRecord)) {
        
        result.eventType = EventType.SQS;
        result.isValid = true;
        
        logger.info('✅ SQS EVENT DETECTED', {
          requestId,
          recordCount,
          eventSource: firstRecord.eventSource,
          hasReceiptHandle: 'receiptHandle' in firstRecord,
          hasMessageId: 'messageId' in firstRecord,
          hasBody: 'body' in firstRecord
        });
        
        return result;
      }

      // DynamoDB Event Detection
      if (firstRecord.eventSource === 'aws:dynamodb') {
        result.eventType = EventType.DYNAMODB;
        result.isValid = true;
        
        logger.info('🗄️ DYNAMODB EVENT DETECTED', {
          requestId,
          recordCount,
          eventSource: firstRecord.eventSource,
          eventName: firstRecord.eventName
        });
        
        return result;
      }

      // Unknown event with records
      result.errors.push(`Unknown event source: ${firstRecord.eventSource || 'missing'}`);
      logger.warn('⚠️ UNKNOWN EVENT SOURCE WITH RECORDS', {
        requestId,
        recordCount,
        eventSource: firstRecord.eventSource,
        firstRecordKeys,
        availableEventSources: ['aws:sqs', 'aws:dynamodb']
      });
      
      return result;
    }

    // Check for API Gateway event properties
    const hasPath = 'path' in event;
    const hasHttpMethod = 'httpMethod' in event;
    const hasRequestContext = 'requestContext' in event;
    
    result.metadata.hasPath = hasPath;
    result.metadata.hasHttpMethod = hasHttpMethod;
    result.metadata.hasRequestContext = hasRequestContext;

    logger.info('🌐 CHECKING API GATEWAY PROPERTIES', {
      requestId,
      hasPath,
      hasHttpMethod,
      hasRequestContext,
      pathValue: hasPath ? event.path : undefined,
      httpMethodValue: hasHttpMethod ? event.httpMethod : undefined,
      pathType: hasPath ? typeof event.path : undefined,
      httpMethodType: hasHttpMethod ? typeof event.httpMethod : undefined
    });

    // API Gateway Event Detection
    if (hasHttpMethod || hasRequestContext || hasPath) {
      result.eventType = EventType.API_GATEWAY;
      result.isValid = true;
      
      logger.info('✅ API GATEWAY EVENT DETECTED', {
        requestId,
        hasPath,
        hasHttpMethod,
        hasRequestContext,
        path: hasPath ? event.path : undefined,
        httpMethod: hasHttpMethod ? event.httpMethod : undefined,
        stage: hasRequestContext && event.requestContext ? event.requestContext.stage : undefined
      });
      
      return result;
    }

    // If we reach here, it's an unknown event type
    result.errors.push('Event does not match SQS, DynamoDB, or API Gateway patterns');
    logger.warn('⚠️ UNKNOWN EVENT TYPE', {
      requestId,
      eventKeys: Object.keys(event),
      hasRecords: false,
      hasApiGatewayProps: false,
      eventSample: JSON.stringify(event).substring(0, 500)
    });

    return result;

  } catch (error) {
    result.errors.push(`Event detection error: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('💥 EVENT DETECTION EXCEPTION', error instanceof Error ? error : new Error(String(error)), {
      requestId,
      eventKeys: event ? Object.keys(event) : [],
      eventType: typeof event
    });
    
    return result;
  }
}

/**
 * Main Lambda handler - supports both API Gateway and SQS events with enhanced detection
 */
export const handler = async (
  event: APIGatewayProxyEvent | SQSEvent,
  context: Context
): Promise<APIGatewayProxyResult | any> => {
  const requestId = context.awsRequestId;
  
  // Enhanced event detection with comprehensive validation
  const detection = detectEventType(event, context);
  
  logger.info('🎯 EVENT DETECTION RESULT', {
    requestId,
    eventType: detection.eventType,
    isValid: detection.isValid,
    errorCount: detection.errors.length,
    errors: detection.errors.length > 0 ? detection.errors : undefined,
    metadata: detection.metadata
  });

  // Handle detection failures
  if (!detection.isValid) {
    logger.error('❌ EVENT DETECTION FAILED', new Error(`Event detection failed: ${detection.errors.join(', ')}`), {
      requestId,
      eventType: detection.eventType,
      errors: detection.errors,
      metadata: detection.metadata
    });
    
    // Return appropriate response based on suspected event type
    if (detection.metadata.hasRecords || detection.eventType === EventType.SQS) {
      // Likely SQS event - return SQS-compatible response
      return { batchItemFailures: [] };
    } else {
      // Likely API Gateway event - return HTTP response
      return createErrorResponse(400, 'INVALID_EVENT', 'Invalid event format', requestId);
    }
  }

  // Route to appropriate handler based on detected event type
  switch (detection.eventType) {
    case EventType.SQS:
      logger.info('🔔 ROUTING TO SQS HANDLER', {
        requestId,
        recordCount: detection.metadata.recordCount,
        eventSource: detection.metadata.eventSource
      });
      return await sqsHandler(event as SQSEvent, context);

    case EventType.DYNAMODB:
      logger.info('🗄️ IGNORING DYNAMODB EVENT', {
        requestId,
        recordCount: detection.metadata.recordCount,
        eventSource: detection.metadata.eventSource,
        reason: 'DynamoDB events not handled by notification service'
      });
      return { statusCode: 200, body: 'DynamoDB event ignored' };

    case EventType.API_GATEWAY:
      logger.info('🌐 ROUTING TO API GATEWAY HANDLER', {
        requestId,
        hasPath: detection.metadata.hasPath,
        hasHttpMethod: detection.metadata.hasHttpMethod,
        hasRequestContext: detection.metadata.hasRequestContext
      });
      return await handleApiGatewayEvent(event as APIGatewayProxyEvent, context);

    default:
      logger.error('❌ UNSUPPORTED EVENT TYPE', new Error(`Unsupported event type: ${detection.eventType}`), {
        requestId,
        eventType: detection.eventType,
        metadata: detection.metadata
      });
      
      // Return appropriate response format
      if (detection.metadata.hasRecords) {
        return { batchItemFailures: [] };
      } else {
        return createErrorResponse(400, 'UNSUPPORTED_EVENT', 'Unsupported event type', requestId);
      }
  }
}

/**
 * Handle API Gateway events with enhanced null safety
 */
async function handleApiGatewayEvent(
  apiEvent: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const requestId = context.awsRequestId;

  logger.info('🔔 NOTIFICATION SERVICE API HANDLER STARTED', {
    requestId,
    timestamp: new Date().toISOString(),
    path: apiEvent.path || 'undefined',
    method: apiEvent.httpMethod || 'undefined',
    resource: apiEvent.resource || 'undefined',
    stage: apiEvent.requestContext?.stage || 'undefined',
    hasRequestContext: !!apiEvent.requestContext,
    eventKeys: Object.keys(apiEvent)
  });

  try {
    // Enhanced null safety for API Gateway properties
    const safePath = apiEvent.path || '';
    const safeHttpMethod = apiEvent.httpMethod || '';
    const safeHeaders = apiEvent.headers || {};
    const originHeader = safeHeaders['origin'] || safeHeaders['Origin'] || '';

    logger.info('🔍 API GATEWAY EVENT PROPERTIES', {
      requestId,
      safePath,
      safeHttpMethod,
      hasHeaders: Object.keys(safeHeaders).length > 0,
      originHeader,
      pathType: typeof apiEvent.path,
      httpMethodType: typeof apiEvent.httpMethod
    });

    // Handle CORS preflight with null safety
    if (safeHttpMethod === 'OPTIONS') {
      logger.info('✅ HANDLING CORS PREFLIGHT', {
        requestId,
        originHeader
      });
      return createOptionsResponse(originHeader);
    }

    // Handle health check with enhanced path validation
    const isHealthCheck = safePath === '/health' || 
                         (safePath && typeof safePath === 'string' && safePath.endsWith('/health'));
    
    if (isHealthCheck) {
      logger.info('✅ HANDLING HEALTH CHECK', {
        requestId,
        path: safePath,
        matchedPattern: safePath === '/health' ? 'exact' : 'endsWith'
      });
      
      const healthResponse = await healthCheckHandler(requestId);
      return {
        statusCode: healthResponse.statusCode,
        headers: getCorsHeaders(originHeader),
        body: JSON.stringify(healthResponse.body)
      };
    }

    // Handle empty or invalid paths
    if (!safePath || safePath.trim() === '') {
      logger.warn('⚠️ RECEIVED API GATEWAY EVENT WITH EMPTY PATH', {
        requestId,
        pathValue: apiEvent.path,
        pathType: typeof apiEvent.path,
        eventKeys: Object.keys(apiEvent),
        hasRequestContext: !!apiEvent.requestContext,
        method: safeHttpMethod,
        fallbackAction: 'returning-health-response'
      });
      
      const healthResponse = await healthCheckHandler(requestId);
      return {
        statusCode: healthResponse.statusCode,
        headers: getCorsHeaders(originHeader),
        body: JSON.stringify(healthResponse.body)
      };
    }

    // Extract user context from authorizer for authenticated endpoints
    const userContext = extractUserContext(apiEvent);
    if (!userContext) {
      logger.warn('❌ AUTHENTICATION REQUIRED', {
        requestId,
        path: safePath,
        method: safeHttpMethod,
        hasRequestContext: !!apiEvent.requestContext,
        hasAuthorizer: !!(apiEvent.requestContext?.authorizer)
      });
      return createErrorResponse(401, 'UNAUTHORIZED', 'Authentication required', requestId);
    }

    logger.info('✅ USER AUTHENTICATED', {
      requestId,
      userId: userContext.userId,
      role: userContext.role,
      path: safePath,
      method: safeHttpMethod
    });

    // Route to appropriate handler
    const result = await routeRequest(apiEvent, userContext, requestId);

    return {
      statusCode: result.statusCode,
      headers: getCorsHeaders(originHeader),
      body: JSON.stringify(result.body)
    };

  } catch (error) {
    logger.error('❌ UNHANDLED ERROR IN API GATEWAY HANDLER', error instanceof Error ? error : new Error(String(error)), {
      requestId,
      eventPath: apiEvent.path,
      eventMethod: apiEvent.httpMethod,
      eventResource: apiEvent.resource,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
}

/**
 * Extract user context from API Gateway authorizer with enhanced null safety
 */
function extractUserContext(event: APIGatewayProxyEvent): UserContext | null {
  try {
    // Enhanced null safety checks
    if (!event || typeof event !== 'object') {
      logger.error('❌ INVALID EVENT OBJECT FOR USER CONTEXT EXTRACTION', new Error('Event is null or not an object'), {
        eventType: typeof event,
        eventValue: event
      });
      return null;
    }

    const requestContext = event.requestContext;
    if (!requestContext || typeof requestContext !== 'object') {
      logger.warn('⚠️ MISSING OR INVALID REQUEST CONTEXT', {
        hasRequestContext: !!requestContext,
        requestContextType: typeof requestContext,
        eventPath: event.path || 'undefined',
        eventMethod: event.httpMethod || 'undefined'
      });
      return null;
    }

    const authContext = requestContext.authorizer;
    if (!authContext || typeof authContext !== 'object') {
      logger.warn('⚠️ MISSING OR INVALID AUTHORIZER CONTEXT', {
        hasAuthorizer: !!authContext,
        authorizerType: typeof authContext,
        requestContextKeys: Object.keys(requestContext),
        eventPath: event.path || 'undefined',
        eventMethod: event.httpMethod || 'undefined'
      });
      return null;
    }

    logger.info('🔐 USER CONTEXT EXTRACTION ANALYSIS', {
      authContextKeys: Object.keys(authContext),
      hasUserId: 'userId' in authContext && authContext['userId'],
      hasRole: 'role' in authContext && authContext['role'],
      hasEmail: 'email' in authContext && authContext['email'],
      hasClaims: 'claims' in authContext && authContext['claims'],
      userIdValue: authContext['userId'] || 'missing',
      roleValue: authContext['role'] || 'missing',
      emailValue: authContext['email'] || 'missing',
      eventPath: event.path || 'undefined',
      eventMethod: event.httpMethod || 'undefined'
    });

    // Primary extraction: direct authorizer properties
    const directUserId = authContext['userId'];
    const directRole = authContext['role'];
    const directEmail = authContext['email'];

    if (directUserId && typeof directUserId === 'string' && directUserId.trim() !== '' &&
        directRole && typeof directRole === 'string' && directRole.trim() !== '') {
      
      const userContext: UserContext = {
        userId: directUserId.trim(),
        role: directRole.trim() as UserRole,
        email: (directEmail && typeof directEmail === 'string') ? directEmail.trim() : ''
      };

      logger.info('✅ USER CONTEXT EXTRACTED FROM DIRECT PROPERTIES', {
        extractedContext: {
          userId: userContext.userId,
          role: userContext.role,
          email: userContext.email || 'empty',
          hasEmail: !!userContext.email
        },
        extractionMethod: 'direct-properties'
      });

      return userContext;
    }

    // Fallback extraction: JWT claims
    const claims = authContext['claims'];
    if (claims && typeof claims === 'object' && claims !== null) {
      const claimsUserId = claims['sub'];
      const claimsRole = claims['role'];
      const claimsEmail = claims['email'];

      logger.info('🔍 ANALYZING JWT CLAIMS', {
        claimsKeys: Object.keys(claims),
        hasSubClaim: 'sub' in claims && claims['sub'],
        hasRoleClaim: 'role' in claims && claims['role'],
        hasEmailClaim: 'email' in claims && claims['email'],
        subValue: claimsUserId || 'missing',
        roleValue: claimsRole || 'missing',
        emailValue: claimsEmail || 'missing'
      });

      if (claimsUserId && typeof claimsUserId === 'string' && claimsUserId.trim() !== '' &&
          claimsRole && typeof claimsRole === 'string' && claimsRole.trim() !== '') {
        
        const userContext: UserContext = {
          userId: claimsUserId.trim(),
          role: claimsRole.trim() as UserRole,
          email: (claimsEmail && typeof claimsEmail === 'string') ? claimsEmail.trim() : ''
        };

        logger.info('✅ USER CONTEXT EXTRACTED FROM JWT CLAIMS', {
          extractedContext: {
            userId: userContext.userId,
            role: userContext.role,
            email: userContext.email || 'empty',
            hasEmail: !!userContext.email
          },
          extractionMethod: 'jwt-claims'
        });

        return userContext;
      }
    }

    // Extraction failed - log comprehensive debug information
    logger.warn('❌ USER CONTEXT EXTRACTION FAILED', {
      authContextAnalysis: {
        hasAuthContext: !!authContext,
        authContextKeys: authContext ? Object.keys(authContext) : [],
        directProperties: {
          userId: {
            exists: 'userId' in authContext,
            value: authContext['userId'],
            type: typeof authContext['userId'],
            isValidString: typeof authContext['userId'] === 'string' && authContext['userId'].trim() !== ''
          },
          role: {
            exists: 'role' in authContext,
            value: authContext['role'],
            type: typeof authContext['role'],
            isValidString: typeof authContext['role'] === 'string' && authContext['role'].trim() !== ''
          },
          email: {
            exists: 'email' in authContext,
            value: authContext['email'],
            type: typeof authContext['email']
          }
        },
        claimsAnalysis: claims ? {
          hasClaims: true,
          claimsKeys: Object.keys(claims),
          sub: {
            exists: 'sub' in claims,
            value: claims['sub'],
            type: typeof claims['sub'],
            isValidString: typeof claims['sub'] === 'string' && claims['sub'].trim() !== ''
          },
          role: {
            exists: 'role' in claims,
            value: claims['role'],
            type: typeof claims['role'],
            isValidString: typeof claims['role'] === 'string' && claims['role'].trim() !== ''
          },
          email: {
            exists: 'email' in claims,
            value: claims['email'],
            type: typeof claims['email']
          }
        } : { hasClaims: false }
      },
      eventContext: {
        path: event.path || 'undefined',
        method: event.httpMethod || 'undefined',
        hasRequestContext: !!event.requestContext,
        requestContextKeys: event.requestContext ? Object.keys(event.requestContext) : []
      }
    });

    return null;

  } catch (error) {
    logger.error('💥 EXCEPTION IN USER CONTEXT EXTRACTION', error instanceof Error ? error : new Error(String(error)), {
      eventAnalysis: {
        hasEvent: !!event,
        eventType: typeof event,
        hasRequestContext: !!(event && event.requestContext),
        hasAuthorizer: !!(event && event.requestContext && event.requestContext.authorizer),
        eventPath: event ? event.path : 'event-null',
        eventMethod: event ? event.httpMethod : 'event-null'
      },
      errorDetails: {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
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