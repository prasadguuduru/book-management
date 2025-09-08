/**
 * TypeScript interfaces and types for notification service
 */

import { UserRole } from '../../types';
import { BookNotificationType } from '../../shared/events/event-types';

// Use the shared notification type enum for consistency
export type NotificationType = BookNotificationType;

// Variables for email content
export interface EmailVariables {
  userName?: string;
  bookTitle?: string;
  bookId?: string;
  actionUrl?: string;
  comments?: string;
}

// Email content structure
export interface EmailContent {
  subject: string;
  htmlBody: string;
  textBody: string;
}

// SES email parameters
export interface EmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  from?: string;
}

// Email sending result
export interface SendEmailResult {
  success: boolean;
  messageId?: string | undefined;
  error?: string;
}

// Notification request payload
export interface NotificationRequest {
  type: NotificationType;
  recipientEmail: string;
  ccEmails?: string[];
  variables?: EmailVariables;
}

// API Response types
export interface SendNotificationResponse {
  success: boolean;
  messageId?: string | undefined;
  message: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
  };
}

// User context from API Gateway authorizer
export interface UserContext {
  userId: string;
  role: UserRole;
  email: string;
}

// Handler response type
export interface HandlerResponse {
  statusCode: number;
  body: any;
}

// CC Configuration types
export interface CCConfiguration {
  enabled: boolean;
  emails: string[];
  defaultEmail: string;
}

// CC Email validation result
export interface CCEmailValidationResult {
  valid: boolean;
  validEmails: string[];
  invalidEmails: string[];
  errors: string[];
}

// Enhanced email parameters with CC support
export interface EnhancedEmailParams extends EmailParams {
  ccEmails?: string[];
}

// Enhanced email sending result with CC tracking
export interface EnhancedSendEmailResult extends SendEmailResult {
  ccDeliveryStatus?: Array<{
    email: string;
    success: boolean;
    error?: string;
  }>;
}