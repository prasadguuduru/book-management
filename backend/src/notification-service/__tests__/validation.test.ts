/**
 * Tests for request validation utilities
 */

import { validateNotificationRequest, sanitizeNotificationRequest } from '../utils/validation';

describe('Validation Utils', () => {
  describe('validateNotificationRequest', () => {
    const validRequest = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com',
      variables: {
        userName: 'John Doe',
        bookTitle: 'Test Book'
      }
    };

    it('should validate a correct request', () => {
      const result = validateNotificationRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty body', () => {
      const result = validateNotificationRequest(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    it('should reject missing notification type', () => {
      const request = { ...validRequest };
      delete request.type;

      const result = validateNotificationRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Notification type is required');
    });

    it('should reject invalid notification type', () => {
      const request = {
        ...validRequest,
        type: 'invalid_type'
      };

      const result = validateNotificationRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid notification type. Must be one of: book_submitted, book_approved, book_rejected, book_published');
    });

    it('should accept all valid notification types', () => {
      const validTypes = ['book_submitted', 'book_approved', 'book_rejected', 'book_published'];

      validTypes.forEach(type => {
        const request = {
          ...validRequest,
          type
        };

        const result = validateNotificationRequest(request);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject missing recipient email', () => {
      const request = { ...validRequest };
      delete request.recipientEmail;

      const result = validateNotificationRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Recipient email is required');
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example',
        '',
        ' ',
        'test @example.com'
      ];

      invalidEmails.forEach(email => {
        const request = {
          ...validRequest,
          recipientEmail: email
        };

        const result = validateNotificationRequest(request);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid recipient email format');
      });
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'test123@test-domain.com',
        'a@b.co'
      ];

      validEmails.forEach(email => {
        const request = {
          ...validRequest,
          recipientEmail: email
        };

        const result = validateNotificationRequest(request);
        expect(result.isValid).toBe(true);
      });
    });

    it('should accept request without variables', () => {
      const request = {
        type: 'book_submitted',
        recipientEmail: 'test@example.com'
      };

      const result = validateNotificationRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object variables', () => {
      const request = {
        ...validRequest,
        variables: 'invalid'
      };

      const result = validateNotificationRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Variables must be an object');
    });

    it('should accept empty variables object', () => {
      const request = {
        ...validRequest,
        variables: {}
      };

      const result = validateNotificationRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect multiple validation errors', () => {
      const request = {
        type: 'invalid_type',
        recipientEmail: 'invalid-email',
        variables: 'not-an-object'
      };

      const result = validateNotificationRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Invalid notification type. Must be one of: book_submitted, book_approved, book_rejected, book_published');
      expect(result.errors).toContain('Invalid recipient email format');
      expect(result.errors).toContain('Variables must be an object');
    });
  });

  describe('sanitizeNotificationRequest', () => {
    it('should sanitize email address', () => {
      const request = {
        type: 'book_submitted',
        recipientEmail: '  TEST@EXAMPLE.COM  ',
        variables: { userName: 'John' }
      };

      const sanitized = sanitizeNotificationRequest(request);

      expect(sanitized.recipientEmail).toBe('test@example.com');
      expect(sanitized.type).toBe('book_submitted');
      expect(sanitized.variables).toEqual({ userName: 'John' });
    });

    it('should provide empty variables object when missing', () => {
      const request = {
        type: 'book_approved',
        recipientEmail: 'test@example.com'
      };

      const sanitized = sanitizeNotificationRequest(request);

      expect(sanitized.variables).toEqual({});
    });

    it('should preserve existing variables', () => {
      const variables = {
        userName: 'John Doe',
        bookTitle: 'Test Book',
        bookId: 'book-123'
      };

      const request = {
        type: 'book_published',
        recipientEmail: 'test@example.com',
        variables
      };

      const sanitized = sanitizeNotificationRequest(request);

      expect(sanitized.variables).toEqual(variables);
    });
  });
});