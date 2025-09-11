/**
 * Event Serialization and Deserialization Utilities
 * Handles conversion between event objects and JSON strings for SNS/SQS
 */

import { BookStatusChangeEvent, BookStatusChangeEventData, SNSBookEventMessage, SQSBookEventRecord } from './book-workflow-events';
import { validateBookStatusChangeEvent, isBookStatusChangeEvent } from './event-validation';
import { logger } from '../utils/logger';

/**
 * Serializes a BookStatusChangeEvent to JSON string for SNS publishing
 */
export function serializeBookEvent(event: BookStatusChangeEvent): string {
  try {
    // Validate event before serialization
    const validation = validateBookStatusChangeEvent(event);
    if (!validation.isValid) {
      throw new Error(`Invalid event: ${validation.errors.join(', ')}`);
    }

    return JSON.stringify(event);
  } catch (error) {
    logger.error('Failed to serialize book event', error instanceof Error ? error : new Error(String(error)), {
      eventId: event?.eventId,
      eventType: event?.eventType
    });
    throw error;
  }
}

/**
 * Deserializes a JSON string to BookStatusChangeEvent
 */
export function deserializeBookEvent(eventJson: string): BookStatusChangeEvent {
  // Add defensive null/undefined checks
  if (!eventJson || typeof eventJson !== 'string') {
    logger.error('❌ INVALID EVENT JSON INPUT', new Error('Event JSON is null, undefined, or not a string'), {
      eventJsonType: typeof eventJson,
      eventJsonValue: eventJson
    });
    throw new Error('Event JSON must be a non-empty string');
  }

  logger.info('🔄 STARTING EVENT DESERIALIZATION', {
    eventJsonLength: eventJson.length,
    eventJsonPreview: eventJson.substring(0, 100)
  });

  try {
    const event = JSON.parse(eventJson);
    
    logger.info('✅ JSON PARSING SUCCESSFUL', {
      eventType: event?.eventType,
      eventId: event?.eventId,
      source: event?.source,
      version: event?.version,
      hasData: !!event?.data,
      eventKeys: Object.keys(event || {})
    });
    
    // Validate the deserialized event
    logger.info('🔍 STARTING EVENT VALIDATION', {
      eventId: event?.eventId,
      eventType: event?.eventType,
      source: event?.source
    });

    const validation = validateBookStatusChangeEvent(event);
    
    if (!validation.isValid) {
      logger.error('❌ EVENT VALIDATION FAILED IN DESERIALIZATION', new Error(`Validation failed: ${validation.errors.join(', ')}`), {
        eventId: event?.eventId,
        eventType: event?.eventType,
        source: event?.source,
        version: event?.version,
        validationErrors: validation.errors,
        errorCount: validation.errors.length,
        fullEvent: event
      });
      throw new Error(`Invalid event structure: ${validation.errors.join(', ')}`);
    }

    logger.info('✅ EVENT DESERIALIZATION SUCCESSFUL', {
      eventId: event.eventId,
      eventType: event.eventType,
      source: event.source,
      bookId: event.data?.bookId,
      statusTransition: `${event.data?.previousStatus} -> ${event.data?.newStatus}`
    });

    return event as BookStatusChangeEvent;
  } catch (error) {
    logger.error('💥 DESERIALIZATION FAILED', error instanceof Error ? error : new Error(String(error)), {
      eventJsonLength: eventJson?.length || 0,
      eventJsonPreview: eventJson?.substring(0, 200) || 'N/A',
      eventJsonType: typeof eventJson,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Extracts BookStatusChangeEvent from SNS message
 */
export function extractEventFromSNSMessage(snsMessage: SNSBookEventMessage): BookStatusChangeEvent {
  logger.info('📨 EXTRACTING EVENT FROM SNS MESSAGE', {
    messageId: snsMessage.MessageId,
    topicArn: snsMessage.TopicArn,
    messageType: snsMessage.Type,
    hasMessage: !!snsMessage.Message,
    messageLength: snsMessage.Message?.length,
    messagePreview: snsMessage.Message?.substring(0, 100),
    hasMessageAttributes: !!snsMessage.MessageAttributes,
    messageAttributeKeys: snsMessage.MessageAttributes ? Object.keys(snsMessage.MessageAttributes) : []
  });

  try {
    // SNS message contains the event in the Message field
    const event = deserializeBookEvent(snsMessage.Message);
    
    logger.info('✅ SNS MESSAGE EXTRACTION SUCCESSFUL', {
      messageId: snsMessage.MessageId,
      eventId: event.eventId,
      eventType: event.eventType,
      source: event.source
    });

    return event;
  } catch (error) {
    logger.error('❌ FAILED TO EXTRACT EVENT FROM SNS MESSAGE', error instanceof Error ? error : new Error(String(error)), {
      messageId: snsMessage.MessageId,
      topicArn: snsMessage.TopicArn,
      messageType: snsMessage.Type,
      messageLength: snsMessage.Message?.length,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Extracts BookStatusChangeEvent from SQS record
 */
export function extractEventFromSQSRecord(sqsRecord: SQSBookEventRecord): BookStatusChangeEvent {
  logger.info('📥 EXTRACTING EVENT FROM SQS RECORD', {
    messageId: sqsRecord.messageId,
    eventSource: sqsRecord.eventSource,
    eventSourceARN: sqsRecord.eventSourceARN,
    awsRegion: sqsRecord.awsRegion,
    receiveCount: sqsRecord.attributes?.ApproximateReceiveCount,
    bodyLength: sqsRecord.body?.length,
    bodyPreview: sqsRecord.body?.substring(0, 100),
    hasMessageAttributes: !!sqsRecord.messageAttributes,
    messageAttributeKeys: sqsRecord.messageAttributes ? Object.keys(sqsRecord.messageAttributes) : []
  });

  try {
    // SQS record body contains the SNS message
    logger.info('🔄 PARSING SQS BODY AS SNS MESSAGE', {
      messageId: sqsRecord.messageId,
      bodyLength: sqsRecord.body.length
    });

    const snsMessage: SNSBookEventMessage = JSON.parse(sqsRecord.body);
    
    logger.info('✅ SQS BODY PARSED SUCCESSFULLY', {
      messageId: sqsRecord.messageId,
      snsMessageId: snsMessage.MessageId,
      snsType: snsMessage.Type,
      snsTopicArn: snsMessage.TopicArn,
      hasSnsMessage: !!snsMessage.Message
    });

    const event = extractEventFromSNSMessage(snsMessage);
    
    logger.info('✅ SQS RECORD EXTRACTION SUCCESSFUL', {
      sqsMessageId: sqsRecord.messageId,
      snsMessageId: snsMessage.MessageId,
      eventId: event.eventId,
      eventType: event.eventType,
      source: event.source,
      receiveCount: sqsRecord.attributes?.ApproximateReceiveCount
    });

    return event;
  } catch (error) {
    logger.error('❌ FAILED TO EXTRACT EVENT FROM SQS RECORD', error instanceof Error ? error : new Error(String(error)), {
      messageId: sqsRecord.messageId,
      eventSource: sqsRecord.eventSource,
      eventSourceARN: sqsRecord.eventSourceARN,
      receiveCount: sqsRecord.attributes?.ApproximateReceiveCount,
      bodyLength: sqsRecord.body?.length,
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Batch extracts BookStatusChangeEvents from multiple SQS records
 */
export function extractEventsFromSQSRecords(sqsRecords: SQSBookEventRecord[]): {
  validEvents: { event: BookStatusChangeEvent; record: SQSBookEventRecord }[];
  invalidRecords: { record: SQSBookEventRecord; error: string }[];
} {
  const validEvents: { event: BookStatusChangeEvent; record: SQSBookEventRecord }[] = [];
  const invalidRecords: { record: SQSBookEventRecord; error: string }[] = [];

  for (const record of sqsRecords) {
    try {
      const event = extractEventFromSQSRecord(record);
      validEvents.push({ event, record });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      invalidRecords.push({ record, error: errorMessage });
      
      logger.warn('Skipping invalid SQS record', {
        messageId: record.messageId,
        error: errorMessage
      });
    }
  }

  return { validEvents, invalidRecords };
}

/**
 * Creates a properly formatted BookStatusChangeEvent
 */
export function createBookStatusChangeEvent(data: {
  bookId: string;
  title: string;
  author: string;
  previousStatus: string | null;
  newStatus: string;
  changedBy: string;
  changeReason?: string;
  metadata?: Record<string, any>;
}): BookStatusChangeEvent {
  const eventData: BookStatusChangeEventData = {
    bookId: data.bookId,
    title: data.title,
    author: data.author,
    previousStatus: data.previousStatus as any,
    newStatus: data.newStatus as any,
    changedBy: data.changedBy
  };

  // Only add optional properties if they are defined
  if (data.changeReason !== undefined) {
    eventData.changeReason = data.changeReason;
  }
  
  if (data.metadata !== undefined) {
    eventData.metadata = data.metadata;
  }

  const event: BookStatusChangeEvent = {
    eventType: 'book_status_changed',
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    source: 'workflow-service',
    version: '1.0',
    data: eventData
  };

  // Validate the created event
  const validation = validateBookStatusChangeEvent(event);
  if (!validation.isValid) {
    throw new Error(`Failed to create valid event: ${validation.errors.join(', ')}`);
  }

  return event;
}

/**
 * Generates a UUID v4 for event ID
 */
function generateEventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(jsonString: string, context?: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error(`Failed to parse JSON${context ? ` in ${context}` : ''}`, error instanceof Error ? error : new Error(String(error)), {
      jsonString: jsonString.substring(0, 200)
    });
    return null;
  }
}

/**
 * Safe JSON stringification with error handling
 */
export function safeJsonStringify(obj: any, context?: string): string | null {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    logger.error(`Failed to stringify object${context ? ` in ${context}` : ''}`, error instanceof Error ? error : new Error(String(error)), {
      objectType: typeof obj
    });
    return null;
  }
}