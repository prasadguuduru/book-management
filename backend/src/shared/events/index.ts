/**
 * Book Workflow Events - Main Export
 * Centralized exports for all event-related functionality
 */

// Event interfaces and types
export {
  BaseBookEvent,
  BookStatusChangeEvent,
  BookStatusChangeEventData,
  EventValidationResult,
  SNSBookEventMessage,
  SQSBookEventRecord,
  SQSBookEvent
} from './book-workflow-events';

// Event validation
export {
  BOOK_STATUS_CHANGE_EVENT_SCHEMA,
  validateBookStatusChangeEvent,
  isBookStatusChangeEvent
} from './event-validation';

// Event serialization and utilities
export {
  serializeBookEvent,
  deserializeBookEvent,
  extractEventFromSNSMessage,
  extractEventFromSQSRecord,
  extractEventsFromSQSRecords,
  createBookStatusChangeEvent,
  safeJsonParse,
  safeJsonStringify
} from './event-serialization';

// Event types and mappings
export {
  BookNotificationType,
  BookStatusEnum,
  STATUS_TO_NOTIFICATION,
  NOTIFICATION_TO_STATUS,
  NOTIFICATION_TRIGGERS,
  getNotificationTypeForTransition,
  shouldTriggerNotification,
  isValidBookStatus,
  isValidNotificationType,
  getAllBookStatuses,
  getAllNotificationTypes,
  getStatusDisplayName,
  getNotificationDisplayName
} from './event-types';

// Event type validation
export {
  EventTypeValidationResult,
  validateStatusTransition,
  validateNotificationForTransition,
  validateEventTypeConfiguration
} from './event-type-validation';