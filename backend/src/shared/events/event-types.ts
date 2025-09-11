/**
 * Event Type Mappings and Enums
 * Defines book status and notification type enums with mappings
 */

import { BookStatus } from '../types';

/**
 * Book notification types that correspond to email templates
 */
export enum BookNotificationType {
  BOOK_SUBMITTED = 'book_submitted',
  BOOK_APPROVED = 'book_approved',
  BOOK_REJECTED = 'book_rejected',
  BOOK_PUBLISHED = 'book_published'
}

/**
 * Extended book status enum that matches the existing BookStatus type
 * but provides enum functionality for better type safety
 */
export enum BookStatusEnum {
  DRAFT = 'DRAFT',
  SUBMITTED_FOR_EDITING = 'SUBMITTED_FOR_EDITING',
  READY_FOR_PUBLICATION = 'READY_FOR_PUBLICATION',
  PUBLISHED = 'PUBLISHED'
}

/**
 * Mapping from book status to notification type
 * Defines which notification should be sent for each status transition
 */
export const STATUS_TO_NOTIFICATION: Record<BookStatus, BookNotificationType | null> = {
  [BookStatusEnum.DRAFT]: null, // No notification for draft status
  [BookStatusEnum.SUBMITTED_FOR_EDITING]: BookNotificationType.BOOK_SUBMITTED,
  [BookStatusEnum.READY_FOR_PUBLICATION]: BookNotificationType.BOOK_APPROVED,
  [BookStatusEnum.PUBLISHED]: BookNotificationType.BOOK_PUBLISHED
};

/**
 * Reverse mapping from notification type to book status
 * Useful for validation and debugging
 */
export const NOTIFICATION_TO_STATUS: Record<BookNotificationType, BookStatus> = {
  [BookNotificationType.BOOK_SUBMITTED]: BookStatusEnum.SUBMITTED_FOR_EDITING,
  [BookNotificationType.BOOK_APPROVED]: BookStatusEnum.READY_FOR_PUBLICATION,
  [BookNotificationType.BOOK_REJECTED]: BookStatusEnum.READY_FOR_PUBLICATION, // Rejected books stay in ready state
  [BookNotificationType.BOOK_PUBLISHED]: BookStatusEnum.PUBLISHED
};

/**
 * Status transitions that should trigger notifications
 * Maps from previous status to new status, indicating if notification should be sent
 */
export const NOTIFICATION_TRIGGERS: Record<string, boolean> = {
  // Transitions TO SUBMITTED_FOR_EDITING
  [`${BookStatusEnum.DRAFT}->${BookStatusEnum.SUBMITTED_FOR_EDITING}`]: true,
  
  // Transitions TO READY_FOR_PUBLICATION (approval)
  [`${BookStatusEnum.SUBMITTED_FOR_EDITING}->${BookStatusEnum.READY_FOR_PUBLICATION}`]: true,
  
  // Transitions TO PUBLISHED
  [`${BookStatusEnum.READY_FOR_PUBLICATION}->${BookStatusEnum.PUBLISHED}`]: true,
  
  // Transitions back to SUBMITTED_FOR_EDITING (rejection)
  [`${BookStatusEnum.READY_FOR_PUBLICATION}->${BookStatusEnum.SUBMITTED_FOR_EDITING}`]: true,
  
  // Other transitions don't trigger notifications
  [`${BookStatusEnum.DRAFT}->${BookStatusEnum.DRAFT}`]: false,
  [`${BookStatusEnum.SUBMITTED_FOR_EDITING}->${BookStatusEnum.SUBMITTED_FOR_EDITING}`]: false,
  [`${BookStatusEnum.READY_FOR_PUBLICATION}->${BookStatusEnum.READY_FOR_PUBLICATION}`]: false,
  [`${BookStatusEnum.PUBLISHED}->${BookStatusEnum.PUBLISHED}`]: false
};

/**
 * Gets the notification type for a status transition
 */
export function getNotificationTypeForTransition(
  previousStatus: BookStatus | null,
  newStatus: BookStatus
): BookNotificationType | null {
  // Special case: rejection (going back from READY_FOR_PUBLICATION to SUBMITTED_FOR_EDITING)
  if (previousStatus === BookStatusEnum.READY_FOR_PUBLICATION && 
      newStatus === BookStatusEnum.SUBMITTED_FOR_EDITING) {
    return BookNotificationType.BOOK_REJECTED;
  }

  // Standard status-based notification
  return STATUS_TO_NOTIFICATION[newStatus];
}

/**
 * Checks if a status transition should trigger a notification
 */
export function shouldTriggerNotification(
  previousStatus: BookStatus | null,
  newStatus: BookStatus
): boolean {
  if (!previousStatus) {
    // Initial status creation - only notify for non-draft status
    return newStatus !== BookStatusEnum.DRAFT;
  }

  const transitionKey = `${previousStatus}->${newStatus}`;
  return NOTIFICATION_TRIGGERS[transitionKey] === true;
}

/**
 * Validates if a book status is valid
 */
export function isValidBookStatus(status: string): status is BookStatus {
  return Object.values(BookStatusEnum).includes(status as BookStatusEnum);
}

/**
 * Validates if a notification type is valid
 */
export function isValidNotificationType(type: string): type is BookNotificationType {
  return Object.values(BookNotificationType).includes(type as BookNotificationType);
}

/**
 * Gets all valid book statuses
 */
export function getAllBookStatuses(): BookStatus[] {
  return Object.values(BookStatusEnum);
}

/**
 * Gets all valid notification types
 */
export function getAllNotificationTypes(): BookNotificationType[] {
  return Object.values(BookNotificationType);
}

/**
 * Gets human-readable status name
 */
export function getStatusDisplayName(status: BookStatus): string {
  const displayNames: Record<BookStatus, string> = {
    [BookStatusEnum.DRAFT]: 'Draft',
    [BookStatusEnum.SUBMITTED_FOR_EDITING]: 'Submitted for Editing',
    [BookStatusEnum.READY_FOR_PUBLICATION]: 'Ready for Publication',
    [BookStatusEnum.PUBLISHED]: 'Published'
  };
  
  return displayNames[status] || status;
}

/**
 * Gets human-readable notification type name
 */
export function getNotificationDisplayName(type: BookNotificationType): string {
  const displayNames: Record<BookNotificationType, string> = {
    [BookNotificationType.BOOK_SUBMITTED]: 'Book Submitted',
    [BookNotificationType.BOOK_APPROVED]: 'Book Approved',
    [BookNotificationType.BOOK_REJECTED]: 'Book Rejected',
    [BookNotificationType.BOOK_PUBLISHED]: 'Book Published'
  };
  
  return displayNames[type] || type;
}