/**
 * Event Type Validation Logic
 * Provides validation functions for event types and status transitions
 */

import { BookStatus } from '../../types';
import {
  BookNotificationType,
  BookStatusEnum,
  isValidBookStatus,
  isValidNotificationType,
  shouldTriggerNotification,
  getNotificationTypeForTransition
} from './event-types';
import { logger } from '../../utils/logger';

/**
 * Validation result for event type operations
 */
export interface EventTypeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a book status transition
 */
export function validateStatusTransition(
  previousStatus: BookStatus | null,
  newStatus: BookStatus
): EventTypeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate new status
  if (!isValidBookStatus(newStatus)) {
    errors.push(`Invalid new status: ${newStatus}`);
  }

  // Validate previous status if provided
  if (previousStatus !== null && !isValidBookStatus(previousStatus)) {
    errors.push(`Invalid previous status: ${previousStatus}`);
  }

  // Check for valid transitions
  if (previousStatus && newStatus) {
    const isValidTransition = validateTransitionLogic(previousStatus, newStatus);
    if (!isValidTransition.isValid) {
      errors.push(...isValidTransition.errors);
      warnings.push(...isValidTransition.warnings);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates the business logic of status transitions
 */
function validateTransitionLogic(
  previousStatus: BookStatus,
  newStatus: BookStatus
): EventTypeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Define valid transitions
  const validTransitions: Record<BookStatus, BookStatus[]> = {
    [BookStatusEnum.DRAFT]: [
      BookStatusEnum.DRAFT, // Can stay in draft
      BookStatusEnum.SUBMITTED_FOR_EDITING // Can submit for editing
    ],
    [BookStatusEnum.SUBMITTED_FOR_EDITING]: [
      BookStatusEnum.SUBMITTED_FOR_EDITING, // Can stay submitted
      BookStatusEnum.READY_FOR_PUBLICATION, // Can be approved
      BookStatusEnum.DRAFT // Can be sent back to draft (rare)
    ],
    [BookStatusEnum.READY_FOR_PUBLICATION]: [
      BookStatusEnum.READY_FOR_PUBLICATION, // Can stay ready
      BookStatusEnum.PUBLISHED, // Can be published
      BookStatusEnum.SUBMITTED_FOR_EDITING // Can be rejected back to editing
    ],
    [BookStatusEnum.PUBLISHED]: [
      BookStatusEnum.PUBLISHED // Published books stay published
    ]
  };

  const allowedNextStatuses = validTransitions[previousStatus] || [];
  
  if (!allowedNextStatuses.includes(newStatus)) {
    errors.push(`Invalid transition from ${previousStatus} to ${newStatus}`);
  }

  // Add warnings for unusual transitions
  if (previousStatus === BookStatusEnum.PUBLISHED && newStatus !== BookStatusEnum.PUBLISHED) {
    warnings.push('Transitioning from PUBLISHED status is unusual');
  }

  if (previousStatus === BookStatusEnum.READY_FOR_PUBLICATION && 
      newStatus === BookStatusEnum.DRAFT) {
    warnings.push('Transitioning from READY_FOR_PUBLICATION to DRAFT skips normal workflow');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates notification type for a given status transition
 */
export function validateNotificationForTransition(
  previousStatus: BookStatus | null,
  newStatus: BookStatus,
  expectedNotificationType?: BookNotificationType
): EventTypeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // First validate the status transition itself
  const transitionValidation = validateStatusTransition(previousStatus, newStatus);
  if (!transitionValidation.isValid) {
    errors.push(...transitionValidation.errors);
    warnings.push(...transitionValidation.warnings);
  }

  // Check if notification should be triggered
  const shouldNotify = shouldTriggerNotification(previousStatus, newStatus);
  const actualNotificationType = getNotificationTypeForTransition(previousStatus, newStatus);

  if (expectedNotificationType) {
    // Validate expected notification type
    if (!isValidNotificationType(expectedNotificationType)) {
      errors.push(`Invalid notification type: ${expectedNotificationType}`);
    }

    // Check if expected matches actual
    if (actualNotificationType !== expectedNotificationType) {
      if (shouldNotify && actualNotificationType) {
        errors.push(`Expected notification type ${expectedNotificationType} but transition requires ${actualNotificationType}`);
      } else if (!shouldNotify) {
        warnings.push(`Expected notification type ${expectedNotificationType} but transition does not trigger notifications`);
      }
    }
  }

  // Log validation results for debugging
  logger.debug('Notification validation for transition', {
    previousStatus,
    newStatus,
    shouldNotify,
    actualNotificationType,
    expectedNotificationType,
    isValid: errors.length === 0
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a complete event type configuration
 */
export function validateEventTypeConfiguration(): EventTypeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate that all book statuses have corresponding enum values
    const bookStatuses = getAllBookStatuses();
    const enumValues = Object.values(BookStatusEnum);
    
    for (const status of bookStatuses) {
      if (!enumValues.includes(status as BookStatusEnum)) {
        errors.push(`Book status ${status} not found in BookStatusEnum`);
      }
    }

    // Validate that all notification types are properly mapped
    const notificationTypes = Object.values(BookNotificationType);
    for (const notificationType of notificationTypes) {
      if (!isValidNotificationType(notificationType)) {
        errors.push(`Invalid notification type in enum: ${notificationType}`);
      }
    }

    // Validate transition mappings
    const statusValues = Object.values(BookStatusEnum);
    for (const fromStatus of statusValues) {
      for (const toStatus of statusValues) {
        try {
          const notificationType = getNotificationTypeForTransition(fromStatus, toStatus);
          const shouldNotify = shouldTriggerNotification(fromStatus, toStatus);
          
          if (shouldNotify && !notificationType) {
            warnings.push(`Transition ${fromStatus} -> ${toStatus} should notify but has no notification type`);
          }
          
          if (!shouldNotify && notificationType) {
            warnings.push(`Transition ${fromStatus} -> ${toStatus} has notification type but should not notify`);
          }
        } catch (error) {
          errors.push(`Error validating transition ${fromStatus} -> ${toStatus}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

  } catch (error) {
    errors.push(`Configuration validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Helper function to get all book statuses (for validation)
 */
function getAllBookStatuses(): BookStatus[] {
  return Object.values(BookStatusEnum);
}