/**
 * Shared Lambda Event Detection Utility
 * Detects and validates different types of Lambda events (API Gateway, SQS, DynamoDB, etc.)
 */

import { Context } from 'aws-lambda';
import { SharedLogger } from '../logging/logger';

/**
 * Event type enumeration for better type safety
 */
export enum EventType {
  SQS = 'SQS',
  API_GATEWAY = 'API_GATEWAY',
  DYNAMODB = 'DYNAMODB',
  SNS = 'SNS',
  CLOUDWATCH = 'CLOUDWATCH',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Event detection result interface
 */
export interface EventDetectionResult {
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
 * Shared event detector class
 */
export class LambdaEventDetector {
  private logger: SharedLogger;

  constructor(serviceName: string) {
    this.logger = new SharedLogger(`${serviceName}-event-detector`);
  }

  /**
   * Enhanced event detection with comprehensive null safety and validation
   */
  detectEventType(event: any, context: Context): EventDetectionResult {
    const requestId = context.awsRequestId;
    const result: EventDetectionResult = {
      eventType: EventType.UNKNOWN,
      isValid: false,
      errors: [],
      metadata: {}
    };

    this.logger.info('🔍 STARTING EVENT TYPE DETECTION', {
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
        this.logger.error('❌ INVALID EVENT OBJECT', new Error('Event validation failed'), {
          requestId,
          eventType: typeof event,
          eventValue: event
        });
        return result;
      }

      // Check for Records property (SQS/DynamoDB/SNS events)
      const hasRecords = 'Records' in event && event.Records !== null && event.Records !== undefined;
      result.metadata.hasRecords = hasRecords;

      if (hasRecords) {
        return this.detectRecordBasedEvent(event, result, requestId);
      }

      // Check for API Gateway event properties
      return this.detectApiGatewayEvent(event, result, requestId);

    } catch (error) {
      result.errors.push(`Event detection error: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.error('💥 EVENT DETECTION EXCEPTION', error instanceof Error ? error : new Error(String(error)), {
        requestId,
        eventKeys: event ? Object.keys(event) : [],
        eventType: typeof event
      });
      
      return result;
    }
  }

  private detectRecordBasedEvent(event: any, result: EventDetectionResult, requestId: string): EventDetectionResult {
    // Validate Records array
    if (!Array.isArray(event.Records)) {
      result.errors.push('Records property exists but is not an array');
      this.logger.error('❌ INVALID RECORDS PROPERTY', new Error('Records is not an array'), {
        requestId,
        recordsType: typeof event.Records,
        recordsValue: event.Records
      });
      return result;
    }

    const recordCount = event.Records.length;
    result.metadata.recordCount = recordCount;

    if (recordCount === 0) {
      result.errors.push('Records array is empty');
      this.logger.warn('⚠️ EMPTY RECORDS ARRAY', { requestId, recordCount: 0 });
      return result;
    }

    // Examine first record for event source detection
    const firstRecord = event.Records[0];
    if (!firstRecord || typeof firstRecord !== 'object') {
      result.errors.push('First record is null, undefined, or not an object');
      return result;
    }

    const firstRecordKeys = Object.keys(firstRecord);
    result.metadata.firstRecordKeys = firstRecordKeys;
    result.metadata.eventSource = firstRecord.eventSource;

    // SQS Event Detection
    if (firstRecord.eventSource === 'aws:sqs' || 
        ('receiptHandle' in firstRecord && 'messageId' in firstRecord && 'body' in firstRecord)) {
      result.eventType = EventType.SQS;
      result.isValid = true;
      this.logger.info('✅ SQS EVENT DETECTED', { requestId, recordCount });
      return result;
    }

    // DynamoDB Event Detection
    if (firstRecord.eventSource === 'aws:dynamodb') {
      result.eventType = EventType.DYNAMODB;
      result.isValid = true;
      this.logger.info('🗄️ DYNAMODB EVENT DETECTED', { requestId, recordCount });
      return result;
    }

    // SNS Event Detection
    if (firstRecord.eventSource === 'aws:sns') {
      result.eventType = EventType.SNS;
      result.isValid = true;
      this.logger.info('📢 SNS EVENT DETECTED', { requestId, recordCount });
      return result;
    }

    // Unknown event with records
    result.errors.push(`Unknown event source: ${firstRecord.eventSource || 'missing'}`);
    return result;
  }

  private detectApiGatewayEvent(event: any, result: EventDetectionResult, requestId: string): EventDetectionResult {
    const hasPath = 'path' in event;
    const hasHttpMethod = 'httpMethod' in event;
    const hasRequestContext = 'requestContext' in event;
    
    result.metadata.hasPath = hasPath;
    result.metadata.hasHttpMethod = hasHttpMethod;
    result.metadata.hasRequestContext = hasRequestContext;

    // API Gateway Event Detection
    if (hasHttpMethod || hasRequestContext || hasPath) {
      result.eventType = EventType.API_GATEWAY;
      result.isValid = true;
      
      this.logger.info('✅ API GATEWAY EVENT DETECTED', {
        requestId,
        hasPath,
        hasHttpMethod,
        hasRequestContext,
        path: hasPath ? event.path : undefined,
        httpMethod: hasHttpMethod ? event.httpMethod : undefined
      });
      
      return result;
    }

    // Unknown event type
    result.errors.push('Event does not match known patterns');
    this.logger.warn('⚠️ UNKNOWN EVENT TYPE', {
      requestId,
      eventKeys: Object.keys(event),
      eventSample: JSON.stringify(event).substring(0, 500)
    });

    return result;
  }
}