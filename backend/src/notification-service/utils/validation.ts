/**
 * Request validation utilities for notification service
 */

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

  // Validate recipient email
  if (!body.recipientEmail || (typeof body.recipientEmail === 'string' && body.recipientEmail.trim() === '')) {
    errors.push('Recipient email is required');
  } else if (!isValidEmail(body.recipientEmail)) {
    errors.push('Invalid recipient email format');
  }

  // Validate variables (optional)
  if (body.variables && typeof body.variables !== 'object') {
    errors.push('Variables must be an object');
  }

  // Validate CC emails (optional)
  if (body.ccEmails) {
    if (!Array.isArray(body.ccEmails)) {
      errors.push('CC emails must be an array');
    } else {
      const invalidCCEmails = body.ccEmails.filter((email: any) => !isValidEmail(email));
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
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmedEmail = email.trim();

  // Basic email validation regex with additional checks
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Additional checks for consecutive dots and other invalid patterns
  if (trimmedEmail.includes('..') ||
    trimmedEmail.startsWith('.') ||
    trimmedEmail.endsWith('.') ||
    trimmedEmail.includes(' ') ||
    !trimmedEmail.includes('@') ||
    trimmedEmail.indexOf('@') !== trimmedEmail.lastIndexOf('@') ||
    trimmedEmail.endsWith('@') ||
    trimmedEmail.startsWith('@')) {
    return false;
  }

  return emailRegex.test(trimmedEmail);
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

    if (isValidEmail(trimmedEmail)) {
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