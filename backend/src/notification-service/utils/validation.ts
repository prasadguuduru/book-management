/**
 * Request validation utilities for notification service
 */

import { Validator } from '../../shared/validation/validator';
import { NotificationRequest, NotificationType, CCEmailValidationResult } from '../types/notification';
import { BookNotificationType } from '../../shared/events/event-types';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate notification request payload
 */
export function validateNotificationRequest(body: any): ValidationResult {
  const errors: string[] = [];

  // Check if body exists
  if (!body) {
    errors.push('Request body is required');
    return { isValid: false, errors };
  }

  // Validate notification type
  if (!body.type) {
    errors.push('Notification type is required');
  } else if (!isValidNotificationType(body.type)) {
    errors.push(`Invalid notification type. Must be one of: book_submitted, book_approved, book_rejected, book_published`);
  }

  // Validate recipient email using shared validator
  if (!body.recipientEmail || (typeof body.recipientEmail === 'string' && body.recipientEmail.trim() === '')) {
    errors.push('Recipient email is required');
  } else {
    const emailValidation = Validator.validateEmail(body.recipientEmail);
    if (!emailValidation.isValid) {
      errors.push('Invalid recipient email format');
    }
  }

  // Validate variables (optional)
  if (body.variables && typeof body.variables !== 'object') {
    errors.push('Variables must be an object');
  }

  // Validate CC emails (optional) using shared validator
  if (body.ccEmails) {
    if (!Array.isArray(body.ccEmails)) {
      errors.push('CC emails must be an array');
    } else {
      const invalidCCEmails = body.ccEmails.filter((email: any) => {
        if (typeof email !== 'string') return true;
        const emailValidation = Validator.validateEmail(email);
        return !emailValidation.isValid;
      });
      if (invalidCCEmails.length > 0) {
        errors.push(`Invalid CC email format(s): ${invalidCCEmails.join(', ')}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if notification type is valid
 */
function isValidNotificationType(type: string): type is NotificationType {
  const validTypes: NotificationType[] = [
    BookNotificationType.BOOK_SUBMITTED,
    BookNotificationType.BOOK_APPROVED,
    BookNotificationType.BOOK_REJECTED,
    BookNotificationType.BOOK_PUBLISHED
  ];

  return validTypes.includes(type as NotificationType);
}

/**
 * Validate email address format using shared validator
 */
function isValidEmail(email: string): boolean {
  const validation = Validator.validateEmail(email);
  return validation.isValid;
}

/**
 * Validate CC emails array and return validation result
 */
export function validateCCEmails(ccEmails: string[]): CCEmailValidationResult {
  if (!Array.isArray(ccEmails)) {
    return {
      valid: false,
      validEmails: [],
      invalidEmails: [],
      errors: ['CC emails must be an array']
    };
  }

  const validEmails: string[] = [];
  const invalidEmails: string[] = [];
  const errors: string[] = [];

  for (const email of ccEmails) {
    if (typeof email !== 'string') {
      invalidEmails.push(String(email));
      errors.push(`CC email must be a string: ${email}`);
      continue;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      invalidEmails.push(email);
      errors.push('CC email cannot be empty');
      continue;
    }

    const emailValidation = Validator.validateEmail(trimmedEmail);
    if (emailValidation.isValid) {
      validEmails.push(trimmedEmail.toLowerCase());
    } else {
      invalidEmails.push(email);
      errors.push(`Invalid CC email format: ${email}`);
    }
  }

  return {
    valid: errors.length === 0,
    validEmails,
    invalidEmails,
    errors
  };
}

/**
 * Sanitize notification request
 */
export function sanitizeNotificationRequest(body: any): NotificationRequest {
  const sanitized: NotificationRequest = {
    type: body.type,
    recipientEmail: body.recipientEmail.trim().toLowerCase(),
    variables: body.variables || {}
  };

  // Add CC emails if provided
  if (body.ccEmails && Array.isArray(body.ccEmails)) {
    const filteredCCEmails = body.ccEmails
      .filter((email: any) => typeof email === 'string' && email.trim())
      .map((email: string) => email.trim().toLowerCase());

    // Only add ccEmails if there are valid emails after filtering
    if (filteredCCEmails.length > 0) {
      sanitized.ccEmails = filteredCCEmails;
    }
  }

  return sanitized;
}