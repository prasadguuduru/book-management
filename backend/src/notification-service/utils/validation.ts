/**
 * Request validation utilities for notification service
 */

import { NotificationRequest, NotificationType } from '../types/notification';

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
  if (!body.recipientEmail) {
    errors.push('Recipient email is required');
  } else if (!isValidEmail(body.recipientEmail)) {
    errors.push('Invalid recipient email format');
  }

  // Validate variables (optional)
  if (body.variables && typeof body.variables !== 'object') {
    errors.push('Variables must be an object');
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
    'book_submitted',
    'book_approved',
    'book_rejected',
    'book_published'
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

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitize notification request
 */
export function sanitizeNotificationRequest(body: any): NotificationRequest {
  return {
    type: body.type,
    recipientEmail: body.recipientEmail.trim().toLowerCase(),
    variables: body.variables || {}
  };
}