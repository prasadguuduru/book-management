/**
 * Event Validation Functions
 * Provides JSON schema validation for book workflow events
 */

import { BookStatusChangeEvent, EventValidationResult } from './book-workflow-events';

export { EventValidationResult };
import { BookStatus } from '../types';

/**
 * JSON Schema for BookStatusChangeEvent
 */
export const BOOK_STATUS_CHANGE_EVENT_SCHEMA = {
  type: 'object',
  required: ['eventType', 'eventId', 'timestamp', 'source', 'version', 'data'],
  properties: {
    eventType: {
      type: 'string',
      enum: ['book_status_changed']
    },
    eventId: {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' // UUID v4 pattern
    },
    timestamp: {
      type: 'string',
      format: 'date-time' // ISO 8601 format
    },
    source: {
      type: 'string',
      enum: ['workflow-service']
    },
    version: {
      type: 'string',
      enum: ['1.0']
    },
    data: {
      type: 'object',
      required: ['bookId', 'title', 'author', 'newStatus', 'changedBy'],
      properties: {
        bookId: {
          type: 'string',
          minLength: 1
        },
        title: {
          type: 'string',
          minLength: 1
        },
        author: {
          type: 'string',
          minLength: 1
        },
        previousStatus: {
          type: ['string', 'null'],
          enum: ['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED', null]
        },
        newStatus: {
          type: 'string',
          enum: ['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED']
        },
        changedBy: {
          type: 'string',
          minLength: 1
        },
        changeReason: {
          type: 'string'
        },
        metadata: {
          type: 'object'
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
} as const;

/**
 * Validates a book status change event against the JSON schema
 */
export function validateBookStatusChangeEvent(event: any): EventValidationResult {
  const errors: string[] = [];

  // Import logger with fallback for Lambda environment
  let logger: any;
  try {
    logger = require('../../utils/logger').logger;
  } catch {
    logger = {
      info: (msg: string, ctx?: any) => console.log(`INFO: ${msg}`, ctx),
      warn: (msg: string, ctx?: any) => console.warn(`WARN: ${msg}`, ctx),
      error: (msg: string, err?: Error, ctx?: any) => console.error(`ERROR: ${msg}`, err, ctx)
    };
  }

  logger.info('🔍 STARTING EVENT VALIDATION', {
    eventType: event?.eventType,
    eventId: event?.eventId,
    source: event?.source,
    version: event?.version,
    hasData: !!event?.data,
    eventKeys: event ? Object.keys(event) : []
  });

  try {
    // Basic type and structure validation
    if (!event || typeof event !== 'object') {
      const error = 'Event must be a valid object';
      logger.error('❌ BASIC VALIDATION FAILED', new Error(error), {
        eventType: typeof event,
        eventValue: event
      });
      errors.push(error);
      return { isValid: false, errors };
    }

    // Required fields validation
    const requiredFields = ['eventType', 'eventId', 'timestamp', 'source', 'version', 'data'];
    const missingFields: string[] = [];
    for (const field of requiredFields) {
      if (!(field in event)) {
        missingFields.push(field);
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (missingFields.length > 0) {
      logger.error('❌ MISSING REQUIRED FIELDS', new Error(`Missing fields: ${missingFields.join(', ')}`), {
        missingFields,
        presentFields: Object.keys(event),
        eventId: event.eventId
      });
    }

    // Event type validation
    if (event.eventType !== 'book_status_changed') {
      const error = 'eventType must be "book_status_changed"';
      logger.error('❌ INVALID EVENT TYPE', new Error(error), {
        actualEventType: event.eventType,
        expectedEventType: 'book_status_changed',
        eventId: event.eventId
      });
      errors.push(error);
    }

    // Event ID validation (UUID v4 or test patterns)
    if (!event.eventId || !event.eventId.trim()) {
      const error = 'eventId is required and cannot be empty';
      logger.error('❌ MISSING EVENT ID', new Error(error), {
        eventId: event.eventId,
        eventIdType: typeof event.eventId,
        eventIdLength: event.eventId?.length
      });
      errors.push(error);
    } else if (!isValidUUID(event.eventId)) {
      const error = 'eventId must be a valid UUID v4, test-direct-{timestamp}, or debug-{id}';
      logger.error('❌ INVALID EVENT ID FORMAT', new Error(error), {
        eventId: event.eventId,
        eventIdType: typeof event.eventId,
        eventIdLength: event.eventId?.length,
        acceptedPatterns: [
          'UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
          'Test ID: test-direct-{timestamp}',
          'Debug ID: debug-{anything}'
        ]
      });
      errors.push(error);
    } else {
      // Determine which pattern matched
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const testIdRegex = /^test-direct-\d+$/;
      const debugIdRegex = /^debug-[a-zA-Z0-9-]+$/;

      let matchedPattern = 'unknown';
      if (uuidRegex.test(event.eventId)) {
        matchedPattern = 'UUID v4';
      } else if (testIdRegex.test(event.eventId)) {
        matchedPattern = 'test-direct pattern';
      } else if (debugIdRegex.test(event.eventId)) {
        matchedPattern = 'debug pattern';
      }

      logger.info('✅ EVENT ID VALIDATION PASSED', {
        eventId: event.eventId,
        matchedPattern,
        isValidFormat: true
      });
    }

    // Timestamp validation (ISO 8601)
    if (event.timestamp && !isValidISO8601(event.timestamp)) {
      const error = 'timestamp must be in ISO 8601 format';
      logger.error('❌ INVALID TIMESTAMP FORMAT', new Error(error), {
        timestamp: event.timestamp,
        timestampType: typeof event.timestamp,
        eventId: event.eventId
      });
      errors.push(error);
    } else if (event.timestamp) {
      logger.info('✅ TIMESTAMP VALIDATION PASSED', {
        timestamp: event.timestamp,
        eventId: event.eventId
      });
    }

    // Source validation - allow workflow-service and debug sources
    const validSources = ['workflow-service', 'debug-script'];
    if (event.source && !validSources.includes(event.source)) {
      const error = `source must be one of: ${validSources.join(', ')}`;
      logger.error('❌ INVALID SOURCE', new Error(error), {
        actualSource: event.source,
        validSources,
        eventId: event.eventId
      });
      errors.push(error);
    } else if (event.source) {
      logger.info('✅ SOURCE VALIDATION PASSED', {
        source: event.source,
        validSources,
        eventId: event.eventId
      });
    }

    // Version validation
    if (event.version !== '1.0') {
      const error = 'version must be "1.0"';
      logger.error('❌ INVALID VERSION', new Error(error), {
        actualVersion: event.version,
        expectedVersion: '1.0',
        eventId: event.eventId
      });
      errors.push(error);
    } else {
      logger.info('✅ VERSION VALIDATION PASSED', {
        version: event.version,
        eventId: event.eventId
      });
    }

    // Data object validation
    if (!event.data || typeof event.data !== 'object') {
      const error = 'data must be a valid object';
      logger.error('❌ INVALID DATA OBJECT', new Error(error), {
        dataType: typeof event.data,
        dataValue: event.data,
        eventId: event.eventId
      });
      errors.push(error);
    } else {
      logger.info('🔍 VALIDATING DATA OBJECT', {
        dataKeys: Object.keys(event.data),
        eventId: event.eventId
      });
      const dataErrors = validateEventData(event.data, event.eventId, logger);
      errors.push(...dataErrors);
    }

    const validationResult = {
      isValid: errors.length === 0,
      errors
    };

    if (validationResult.isValid) {
      logger.info('✅ EVENT VALIDATION SUCCESSFUL', {
        eventId: event.eventId,
        source: event.source,
        eventType: event.eventType
      });
    } else {
      logger.error('❌ EVENT VALIDATION FAILED', new Error(`Validation failed with ${errors.length} errors`), {
        eventId: event.eventId,
        source: event.source,
        eventType: event.eventType,
        errorCount: errors.length,
        errors
      });
    }

    return validationResult;

  } catch (error) {
    const errorMessage = `Validation error: ${error instanceof Error ? error.message : String(error)}`;
    logger.error('💥 VALIDATION EXCEPTION', error instanceof Error ? error : new Error(String(error)), {
      eventId: event?.eventId,
      source: event?.source,
      eventType: event?.eventType
    });
    errors.push(errorMessage);
    return { isValid: false, errors };
  }
}

/**
 * Validates the event data payload
 */
function validateEventData(data: any, eventId?: string, logger?: any): string[] {
  const errors: string[] = [];

  logger?.info('🔍 VALIDATING EVENT DATA FIELDS', {
    eventId,
    dataKeys: Object.keys(data || {}),
    bookId: data?.bookId,
    title: data?.title,
    author: data?.author,
    previousStatus: data?.previousStatus,
    newStatus: data?.newStatus,
    changedBy: data?.changedBy
  });

  // Required data fields
  const requiredDataFields = ['bookId', 'title', 'author', 'newStatus', 'changedBy'];
  const missingDataFields: string[] = [];

  for (const field of requiredDataFields) {
    if (!(field in data) || !data[field] || typeof data[field] !== 'string') {
      const error = `data.${field} is required and must be a non-empty string`;
      missingDataFields.push(field);
      errors.push(error);

      logger?.error(`❌ MISSING/INVALID DATA FIELD: ${field}`, new Error(error), {
        eventId,
        field,
        fieldValue: data[field],
        fieldType: typeof data[field],
        fieldExists: field in data
      });
    }
  }

  if (missingDataFields.length === 0) {
    logger?.info('✅ ALL REQUIRED DATA FIELDS PRESENT', {
      eventId,
      requiredFields: requiredDataFields
    });
  }

  // Book status validation
  const validStatuses: BookStatus[] = ['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'];

  if (data.newStatus && !validStatuses.includes(data.newStatus)) {
    const error = `data.newStatus must be one of: ${validStatuses.join(', ')}`;
    logger?.error('❌ INVALID NEW STATUS', new Error(error), {
      eventId,
      actualNewStatus: data.newStatus,
      validStatuses
    });
    errors.push(error);
  } else if (data.newStatus) {
    logger?.info('✅ NEW STATUS VALIDATION PASSED', {
      eventId,
      newStatus: data.newStatus
    });
  }

  if (data.previousStatus !== null && data.previousStatus && !validStatuses.includes(data.previousStatus)) {
    const error = `data.previousStatus must be null or one of: ${validStatuses.join(', ')}`;
    logger?.error('❌ INVALID PREVIOUS STATUS', new Error(error), {
      eventId,
      actualPreviousStatus: data.previousStatus,
      validStatuses
    });
    errors.push(error);
  } else {
    logger?.info('✅ PREVIOUS STATUS VALIDATION PASSED', {
      eventId,
      previousStatus: data.previousStatus
    });
  }

  // Optional fields type validation
  if (data.changeReason !== undefined && typeof data.changeReason !== 'string') {
    const error = 'data.changeReason must be a string if provided';
    logger?.error('❌ INVALID CHANGE REASON TYPE', new Error(error), {
      eventId,
      changeReasonType: typeof data.changeReason,
      changeReasonValue: data.changeReason
    });
    errors.push(error);
  }

  if (data.metadata !== undefined && (typeof data.metadata !== 'object' || data.metadata === null)) {
    const error = 'data.metadata must be an object if provided';
    logger?.error('❌ INVALID METADATA TYPE', new Error(error), {
      eventId,
      metadataType: typeof data.metadata,
      metadataValue: data.metadata
    });
    errors.push(error);
  } else if (data.metadata) {
    logger?.info('✅ METADATA VALIDATION PASSED', {
      eventId,
      metadataKeys: Object.keys(data.metadata)
    });
  }

  logger?.info('🏁 DATA VALIDATION COMPLETED', {
    eventId,
    errorCount: errors.length,
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  });

  return errors;
}

/**
 * Validates UUID v4 format or test ID patterns
 */
function isValidUUID(uuid: string): boolean {
  // Standard UUID v4 format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Test ID patterns for debug/test scenarios
  const testIdRegex = /^test-direct-\d+$/; // Matches: test-direct-{timestamp}
  const debugIdRegex = /^debug-[a-zA-Z0-9-]+$/; // Matches: debug-{anything}

  return uuidRegex.test(uuid) || testIdRegex.test(uuid) || debugIdRegex.test(uuid);
}

/**
 * Validates ISO 8601 timestamp format
 */
function isValidISO8601(timestamp: string): boolean {
  try {
    const date = new Date(timestamp);
    return date.toISOString() === timestamp;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if an object is a valid BookStatusChangeEvent
 */
export function isBookStatusChangeEvent(event: any): event is BookStatusChangeEvent {
  const validation = validateBookStatusChangeEvent(event);
  return validation.isValid;
}