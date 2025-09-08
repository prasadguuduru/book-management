/**
 * Book Workflow Event Schema and Interfaces
 * Defines the standardized event schema for book status changes
 */

import { BookStatus } from '../../types';

/**
 * Base event interface for all book workflow events
 */
export interface BaseBookEvent {
  eventType: 'book_status_changed';
  eventId: string;
  timestamp: string; // ISO 8601 format
  source: 'workflow-service';
  version: '1.0';
}

/**
 * Book status change event data payload
 */
export interface BookStatusChangeEventData {
  bookId: string;
  title: string;
  author: string;
  previousStatus: BookStatus | null;
  newStatus: BookStatus;
  changedBy: string;
  changeReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Complete book status change event
 */
export interface BookStatusChangeEvent extends BaseBookEvent {
  data: BookStatusChangeEventData;
}

/**
 * Event validation result
 */
export interface EventValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * SNS message wrapper for book events
 */
export interface SNSBookEventMessage {
  Type: 'Notification';
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string; // JSON stringified BookStatusChangeEvent
  Timestamp: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  UnsubscribeURL?: string;
  MessageAttributes?: Record<string, any>;
}

/**
 * SQS message wrapper for book events
 */
export interface SQSBookEventRecord {
  messageId: string;
  receiptHandle: string;
  body: string; // JSON stringified SNSBookEventMessage
  attributes: {
    ApproximateReceiveCount: string;
    SentTimestamp: string;
    SenderId: string;
    ApproximateFirstReceiveTimestamp: string;
  };
  messageAttributes: Record<string, any>;
  md5OfBody: string;
  eventSource: 'aws:sqs';
  eventSourceARN: string;
  awsRegion: string;
}

/**
 * SQS event containing multiple records
 */
export interface SQSBookEvent {
  Records: SQSBookEventRecord[];
}