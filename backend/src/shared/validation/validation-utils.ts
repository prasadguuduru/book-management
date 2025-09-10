/**
 * Validation utilities extracted from individual services
 * Provides common validation patterns and helpers
 */

import { ValidationResult, ValidationError, Validator } from './validator';

/**
 * Book status validation
 */
export type BookStatus = 'DRAFT' | 'SUBMITTED_FOR_EDITING' | 'READY_FOR_PUBLICATION' | 'PUBLISHED';

export const VALID_BOOK_STATUSES: BookStatus[] = [
  'DRAFT', 
  'SUBMITTED_FOR_EDITING', 
  'READY_FOR_PUBLICATION', 
  'PUBLISHED'
];

/**
 * User role validation
 */
export type UserRole = 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';

export const VALID_USER_ROLES: UserRole[] = [
  'AUTHOR', 
  'EDITOR', 
  'PUBLISHER', 
  'READER'
];

/**
 * Book genre validation
 */
export type BookGenre = 'fiction' | 'non-fiction' | 'mystery' | 'romance' | 'sci-fi' | 
                       'fantasy' | 'biography' | 'history' | 'self-help' | 'other';

export const VALID_BOOK_GENRES: BookGenre[] = [
  'fiction', 'non-fiction', 'mystery', 'romance', 'sci-fi', 
  'fantasy', 'biography', 'history', 'self-help', 'other'
];

/**
 * Validation utilities class
 */
export class ValidationUtils {
  /**
   * Validate book status
   */
  static validateBookStatus(status: string): ValidationResult<BookStatus> {
    return Validator.validateEnum(status, 'status', VALID_BOOK_STATUSES);
  }

  /**
   * Validate user role
   */
  static validateUserRole(role: string): ValidationResult<UserRole> {
    return Validator.validateEnum(role, 'role', VALID_USER_ROLES);
  }

  /**
   * Validate book genre
   */
  static validateBookGenre(genre: string): ValidationResult<BookGenre> {
    return Validator.validateEnum(genre, 'genre', VALID_BOOK_GENRES);
  }

  /**
   * Validate book status transition
   */
  static validateBookStatusTransition(
    currentStatus: BookStatus | null, 
    newStatus: BookStatus
  ): ValidationResult<BookStatus> {
    const validTransitions: Record<BookStatus | 'null', BookStatus[]> = {
      'null': ['DRAFT'],
      'DRAFT': ['SUBMITTED_FOR_EDITING'],
      'SUBMITTED_FOR_EDITING': ['DRAFT', 'READY_FOR_PUBLICATION'],
      'READY_FOR_PUBLICATION': ['SUBMITTED_FOR_EDITING', 'PUBLISHED'],
      'PUBLISHED': [] // No transitions allowed from published
    };

    const currentKey = currentStatus || 'null';
    const allowedTransitions = validTransitions[currentKey] || [];

    if (!allowedTransitions.includes(newStatus)) {
      return {
        isValid: false,
        errors: [{
          field: 'status',
          message: `Invalid status transition from ${currentStatus || 'null'} to ${newStatus}`,
          code: 'INVALID_STATUS_TRANSITION'
        }]
      };
    }

    return {
      isValid: true,
      data: newStatus,
      errors: []
    };
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): ValidationResult<string> {
    const errors: ValidationError[] = [];

    if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    if (!/[A-Z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one uppercase letter',
        code: 'PASSWORD_MISSING_UPPERCASE'
      });
    }

    if (!/[a-z]/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one lowercase letter',
        code: 'PASSWORD_MISSING_LOWERCASE'
      });
    }

    if (!/\d/.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one number',
        code: 'PASSWORD_MISSING_NUMBER'
      });
    }

    return {
      isValid: errors.length === 0,
      data: password,
      errors
    };
  }

  /**
   * Validate content length for books
   */
  static validateBookContent(content: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    const wordCount = content.trim().split(/\s+/).length;

    if (wordCount < 100) {
      errors.push({
        field: 'content',
        message: 'Book content must be at least 100 words',
        code: 'CONTENT_TOO_SHORT'
      });
    }

    if (wordCount > 100000) {
      errors.push({
        field: 'content',
        message: 'Book content must be no more than 100,000 words',
        code: 'CONTENT_TOO_LONG'
      });
    }

    return {
      isValid: errors.length === 0,
      data: content,
      errors
    };
  }

  /**
   * Validate API Gateway event structure
   */
  static validateApiGatewayEvent(event: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!event) {
      errors.push({
        field: 'event',
        message: 'Event object is required',
        code: 'MISSING_EVENT'
      });
      return { isValid: false, errors };
    }

    if (!event.httpMethod) {
      errors.push({
        field: 'httpMethod',
        message: 'HTTP method is required',
        code: 'MISSING_HTTP_METHOD'
      });
    }

    if (!event.path) {
      errors.push({
        field: 'path',
        message: 'Path is required',
        code: 'MISSING_PATH'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .trim();
  }

  /**
   * Validate and sanitize user input
   */
  static validateAndSanitizeInput(
    input: string, 
    field: string, 
    minLength?: number, 
    maxLength?: number
  ): ValidationResult<string> {
    const sanitized = this.sanitizeInput(input);
    return Validator.validateStringLength(sanitized, field, minLength, maxLength);
  }
}