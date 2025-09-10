/**
 * Tests for validation utilities
 */

import { ValidationUtils } from '../validation-utils';

describe('ValidationUtils', () => {
  describe('validateBookStatus', () => {
    it('should validate valid book statuses', () => {
      const validStatuses = ['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'];

      validStatuses.forEach(status => {
        const result = ValidationUtils.validateBookStatus(status);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(status);
      });
    });

    it('should reject invalid book statuses', () => {
      const result = ValidationUtils.validateBookStatus('INVALID_STATUS');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_ENUM_VALUE');
    });
  });

  describe('validateUserRole', () => {
    it('should validate valid user roles', () => {
      const validRoles = ['AUTHOR', 'EDITOR', 'PUBLISHER', 'READER'];

      validRoles.forEach(role => {
        const result = ValidationUtils.validateUserRole(role);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(role);
      });
    });

    it('should reject invalid user roles', () => {
      const result = ValidationUtils.validateUserRole('INVALID_ROLE');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_ENUM_VALUE');
    });
  });

  describe('validateBookGenre', () => {
    it('should validate valid book genres', () => {
      const validGenres = ['fiction', 'non-fiction', 'mystery', 'romance', 'sci-fi'];

      validGenres.forEach(genre => {
        const result = ValidationUtils.validateBookGenre(genre);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(genre);
      });
    });

    it('should reject invalid book genres', () => {
      const result = ValidationUtils.validateBookGenre('invalid-genre');

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_ENUM_VALUE');
    });
  });

  describe('validateBookStatusTransition', () => {
    it('should allow valid status transitions', () => {
      const validTransitions = [
        [null, 'DRAFT'],
        ['DRAFT', 'SUBMITTED_FOR_EDITING'],
        ['SUBMITTED_FOR_EDITING', 'DRAFT'],
        ['SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION'],
        ['READY_FOR_PUBLICATION', 'SUBMITTED_FOR_EDITING'],
        ['READY_FOR_PUBLICATION', 'PUBLISHED']
      ] as const;

      validTransitions.forEach(([current, next]) => {
        const result = ValidationUtils.validateBookStatusTransition(current, next);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(next);
      });
    });

    it('should reject invalid status transitions', () => {
      const invalidTransitions = [
        ['DRAFT', 'PUBLISHED'],
        ['PUBLISHED', 'DRAFT'],
        ['READY_FOR_PUBLICATION', 'DRAFT']
      ] as const;

      invalidTransitions.forEach(([current, next]) => {
        const result = ValidationUtils.validateBookStatusTransition(current, next);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]?.code).toBe('INVALID_STATUS_TRANSITION');
      });
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'Password123',
        'MyStr0ngP@ss',
        'SecurePass1'
      ];

      strongPasswords.forEach(password => {
        const result = ValidationUtils.validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(password);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'short', // too short
        'nouppercase1', // no uppercase
        'NOLOWERCASE1', // no lowercase
        'NoNumbers' // no numbers
      ];

      weakPasswords.forEach(password => {
        const result = ValidationUtils.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should provide specific error messages for password requirements', () => {
      const result = ValidationUtils.validatePasswordStrength('weak');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_UPPERCASE')).toBe(true);
      expect(result.errors.some(e => e.code === 'PASSWORD_MISSING_NUMBER')).toBe(true);
    });
  });

  describe('validateBookContent', () => {
    it('should validate content with appropriate word count', () => {
      const content = 'This is a test book content. '.repeat(50); // 500 words
      const result = ValidationUtils.validateBookContent(content);

      expect(result.isValid).toBe(true);
      expect(result.data).toBe(content);
    });

    it('should reject content that is too short', () => {
      const content = 'Short content';
      const result = ValidationUtils.validateBookContent(content);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('CONTENT_TOO_SHORT');
    });

    it('should reject content that is too long', () => {
      const content = 'Word '.repeat(100001); // 100,001 words
      const result = ValidationUtils.validateBookContent(content);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('CONTENT_TOO_LONG');
    });
  });

  describe('validateApiGatewayEvent', () => {
    it('should validate valid API Gateway events', () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/books',
        headers: {},
        queryStringParameters: null,
        body: null
      };

      const result = ValidationUtils.validateApiGatewayEvent(event);

      expect(result.isValid).toBe(true);
    });

    it('should reject events missing required fields', () => {
      const event = {
        headers: {}
      };

      const result = ValidationUtils.validateApiGatewayEvent(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some(e => e.code === 'MISSING_HTTP_METHOD')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_PATH')).toBe(true);
    });

    it('should reject null or undefined events', () => {
      const result = ValidationUtils.validateApiGatewayEvent(null);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MISSING_EVENT');
    });
  });

  describe('sanitizeInput', () => {
    it('should remove potentially dangerous characters', () => {
      const input = '<script>alert("xss")</script>';
      const result = ValidationUtils.sanitizeInput(input);

      expect(result).toBe('scriptalert(xss)/script');
    });

    it('should remove quotes', () => {
      const input = 'Hello "world" and \'test\'';
      const result = ValidationUtils.sanitizeInput(input);

      expect(result).toBe('Hello world and test');
    });

    it('should trim whitespace', () => {
      const input = '  hello world  ';
      const result = ValidationUtils.sanitizeInput(input);

      expect(result).toBe('hello world');
    });

    it('should handle non-string input', () => {
      const result = ValidationUtils.sanitizeInput(123 as any);

      expect(result).toBe('');
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('should sanitize and validate input', () => {
      const input = '  <b>Hello</b> World  ';
      const result = ValidationUtils.validateAndSanitizeInput(input, 'message', 5, 20);

      expect(result.isValid).toBe(true);
      expect(result.data).toBe('bHello/b World');
    });

    it('should reject sanitized input that violates length constraints', () => {
      const input = '<>hi<>';  // Will become 'hi' after sanitization (2 chars)
      const result = ValidationUtils.validateAndSanitizeInput(input, 'message', 5, 20);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MIN_LENGTH_VIOLATION');
    });
  });
});