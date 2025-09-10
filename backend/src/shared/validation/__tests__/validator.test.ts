/**
 * Tests for the unified validation system
 */

import { Validator, ValidationSchema } from '../validator';
import Joi from 'joi';

describe('Validator', () => {
  describe('validateRequest', () => {
    const testSchema: ValidationSchema<{name: string; age: number}> = {
      name: 'TestSchema',
      schema: Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0).required()
      })
    };

    it('should validate valid data successfully', () => {
      const data = { name: 'John', age: 30 };
      const result = Validator.validateRequest(data, testSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const data = { name: '', age: -1 };
      const result = Validator.validateRequest(data, testSchema);

      expect(result.isValid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.field).toBe('name');
      expect(result.errors[1]?.field).toBe('age');
    });

    it('should strip unknown fields', () => {
      const data = { name: 'John', age: 30, extra: 'field' };
      const result = Validator.validateRequest(data, testSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should handle missing required fields', () => {
      const data = { name: 'John' };
      const result = Validator.validateRequest(data, testSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe('age');
      expect(result.errors[0]?.code).toBe('any.required');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];

      validEmails.forEach(email => {
        const result = Validator.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(email);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com'
      ];

      invalidEmails.forEach(email => {
        const result = Validator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]?.code).toBe('INVALID_EMAIL');
      });
    });
  });

  describe('validateUUID', () => {
    it('should validate correct UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      ];

      validUUIDs.forEach(uuid => {
        const result = Validator.validateUUID(uuid);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(uuid);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-426614174000-extra'
      ];

      invalidUUIDs.forEach(uuid => {
        const result = Validator.validateUUID(uuid);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]?.code).toBe('INVALID_UUID');
      });
    });
  });

  describe('validateRequiredFields', () => {
    it('should pass when all required fields are present', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const result = Validator.validateRequiredFields(data, ['name', 'email']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required fields are missing', () => {
      const data = { name: 'John' };
      const result = Validator.validateRequiredFields(data, ['name', 'email', 'age']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.field).toBe('email');
      expect(result.errors[1]?.field).toBe('age');
    });

    it('should handle falsy values correctly', () => {
      const data = { name: '', count: 0, active: false };
      const result = Validator.validateRequiredFields(data, ['name', 'count', 'active']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe('name');
    });
  });

  describe('validateStringLength', () => {
    it('should validate strings within length constraints', () => {
      const result = Validator.validateStringLength('hello', 'message', 3, 10);

      expect(result.isValid).toBe(true);
      expect(result.data).toBe('hello');
    });

    it('should reject strings that are too short', () => {
      const result = Validator.validateStringLength('hi', 'message', 5, 10);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MIN_LENGTH_VIOLATION');
    });

    it('should reject strings that are too long', () => {
      const result = Validator.validateStringLength('very long message', 'message', 3, 10);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MAX_LENGTH_VIOLATION');
    });

    it('should handle only min constraint', () => {
      const result = Validator.validateStringLength('hello', 'message', 3);

      expect(result.isValid).toBe(true);
    });

    it('should handle only max constraint', () => {
      const result = Validator.validateStringLength('hello', 'message', undefined, 10);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateEnum', () => {
    const validRoles = ['ADMIN', 'USER', 'GUEST'];

    it('should validate valid enum values', () => {
      const result = Validator.validateEnum('ADMIN', 'role', validRoles);

      expect(result.isValid).toBe(true);
      expect(result.data).toBe('ADMIN');
    });

    it('should reject invalid enum values', () => {
      const result = Validator.validateEnum('INVALID', 'role', validRoles);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('INVALID_ENUM_VALUE');
      expect(result.errors[0]?.message).toContain('ADMIN, USER, GUEST');
    });
  });
});