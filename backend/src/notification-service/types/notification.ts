/**
 * TypeScript interfaces and types for notification service
 */

import { UserRole } from '../../types';

// Notification types supported
export type NotificationType = 
  | 'book_submitted'
  | 'book_approved' 
  | 'book_rejected'
  | 'book_published';

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