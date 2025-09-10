/**
 * Notification Service Lambda Function
 * Handles email notification delivery using AWS SES
 * Supports both API Gateway (HTTP) and SQS (event-driven) invocations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, SQSEvent, Context } from 'aws-lambda';
import { SharedLogger } from '../shared/logging/logger';
import { sharedCorsHandler } from '../shared/http/cors-utils';
import { sharedResponseHandler } from '../shared/http/response-utils';
import { extractUserContext } from '../shared/auth/auth-middleware';
import { UserRole } from '../types';
import { UserContext, HandlerResponse } from './types/notification';
import { sendEmailHandler } from './handlers/send-email';
import { healthCheckHandler } from './handlers/health';
import { sqsHandler } from './handlers/sqs-event-handler';

// Initialize shared logger for notification service
const logger = new SharedLogger('notification-service');

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
      return sharedResponseHandler.error('INVALID_EVENT', 'Invalid event format', 400, { requestId });
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
        return sharedResponseHandler.error('UNSUPPORTED_EVENT', 'Unsupported event type', 400, { requestId });
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
  logger.setCorrelationId(requestId);

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

    // Handle CORS preflight with shared CORS handler
    if (safeHttpMethod === 'OPTIONS') {
      logger.info('✅ HANDLING CORS PREFLIGHT', {
        requestId,
        originHeader
      });
      return sharedCorsHandler.createOptionsResponse(originHeader);
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
      return sharedResponseHandler.success(
        healthResponse.body,
        healthResponse.statusCode,
        { requestId, origin: originHeader }
      );
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
      return sharedResponseHandler.success(
        healthResponse.body,
        healthResponse.statusCode,
        { requestId, origin: originHeader }
      );
    }

    // Extract user context from authorizer for authenticated endpoints
    const userContext = await extractUserContext(apiEvent, requestId);
    if (!userContext) {
      logger.security('❌ AUTHENTICATION REQUIRED', {
        requestId,
        path: safePath,
        method: safeHttpMethod,
        hasRequestContext: !!apiEvent.requestContext,
        hasAuthorizer: !!(apiEvent.requestContext?.authorizer)
      });
      return sharedResponseHandler.unauthorized('Authentication required', { requestId, origin: originHeader });
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

    // Return the result directly since routeRequest already returns a properly formatted response
    return {
      statusCode: result.statusCode,
      headers: sharedCorsHandler.getHeaders(originHeader),
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
    return sharedResponseHandler.internalError('Internal server error', { requestId, origin: apiEvent.headers?.['origin'] });
  }
}

// Local user context extraction removed - now using shared auth middleware

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

// Remove createErrorResponse function since we're using shared response handler