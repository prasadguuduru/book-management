/**
 * Tests for validation schemas
 */

import { Validator } from '../validator';
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  createBookSchema,
  updateBookSchema,
  paginationSchema,
  bookIdSchema,
  userIdSchema
} from '../schemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = Validator.validateRequest(data, loginSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'invalid-email',
        password: 'password123'
      };

      const result = Validator.validateRequest(data, loginSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject missing password', () => {
      const data = {
        email: 'test@example.com'
      };

      const result = Validator.validateRequest(data, loginSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'password')).toBe(true);
    });
  });

  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'AUTHOR'
      };

      const result = Validator.validateRequest(data, registerSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject short password', () => {
      const data = {
        email: 'test@example.com',
        password: 'short',
        firstName: 'John',
        lastName: 'Doe',
        role: 'AUTHOR'
      };

      const result = Validator.validateRequest(data, registerSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'password')).toBe(true);
    });

    it('should reject invalid role', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'INVALID_ROLE'
      };

      const result = Validator.validateRequest(data, registerSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'role')).toBe(true);
    });

    it('should reject short names', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'J',
        lastName: 'D',
        role: 'AUTHOR'
      };

      const result = Validator.validateRequest(data, registerSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'firstName')).toBe(true);
      expect(result.errors.some(e => e.field === 'lastName')).toBe(true);
    });
  });

  describe('refreshTokenSchema', () => {
    it('should validate valid refresh token data', () => {
      const data = {
        refreshToken: 'valid-refresh-token'
      };

      const result = Validator.validateRequest(data, refreshTokenSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject missing refresh token', () => {
      const data = {};

      const result = Validator.validateRequest(data, refreshTokenSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'refreshToken')).toBe(true);
    });
  });

  describe('createBookSchema', () => {
    it('should validate valid book creation data', () => {
      const data = {
        title: 'Test Book',
        description: 'A test book description',
        content: 'This is the content of the test book',
        genre: 'fiction'
      };

      const result = Validator.validateRequest(data, createBookSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject empty title', () => {
      const data = {
        title: '',
        description: 'A test book description',
        content: 'This is the content of the test book',
        genre: 'fiction'
      };

      const result = Validator.validateRequest(data, createBookSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
    });

    it('should reject invalid genre', () => {
      const data = {
        title: 'Test Book',
        description: 'A test book description',
        content: 'This is the content of the test book',
        genre: 'invalid-genre'
      };

      const result = Validator.validateRequest(data, createBookSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'genre')).toBe(true);
    });

    it('should reject title that is too long', () => {
      const data = {
        title: 'A'.repeat(201), // 201 characters
        description: 'A test book description',
        content: 'This is the content of the test book',
        genre: 'fiction'
      };

      const result = Validator.validateRequest(data, createBookSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
    });
  });

  describe('updateBookSchema', () => {
    it('should validate valid book update data', () => {
      const data = {
        title: 'Updated Title',
        description: 'Updated description'
      };

      const result = Validator.validateRequest(data, updateBookSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should allow partial updates', () => {
      const data = {
        title: 'Updated Title'
      };

      const result = Validator.validateRequest(data, updateBookSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject empty update object', () => {
      const data = {};

      const result = Validator.validateRequest(data, updateBookSchema);

      expect(result.isValid).toBe(false);
    });

    it('should reject invalid genre in update', () => {
      const data = {
        genre: 'invalid-genre'
      };

      const result = Validator.validateRequest(data, updateBookSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'genre')).toBe(true);
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination parameters', () => {
      const data = {
        limit: 10,
        lastEvaluatedKey: 'some-key'
      };

      const result = Validator.validateRequest(data, paginationSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should use default limit when not provided', () => {
      const data = {};

      const result = Validator.validateRequest(data, paginationSchema);

      expect(result.isValid).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it('should reject limit that is too high', () => {
      const data = {
        limit: 101
      };

      const result = Validator.validateRequest(data, paginationSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'limit')).toBe(true);
    });

    it('should reject negative limit', () => {
      const data = {
        limit: -1
      };

      const result = Validator.validateRequest(data, paginationSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'limit')).toBe(true);
    });
  });

  describe('bookIdSchema', () => {
    it('should validate valid book ID', () => {
      const data = {
        bookId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = Validator.validateRequest(data, bookIdSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject invalid UUID', () => {
      const data = {
        bookId: 'invalid-uuid'
      };

      const result = Validator.validateRequest(data, bookIdSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'bookId')).toBe(true);
    });
  });

  describe('userIdSchema', () => {
    it('should validate valid user ID', () => {
      const data = {
        userId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = Validator.validateRequest(data, userIdSchema);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject invalid UUID', () => {
      const data = {
        userId: 'invalid-uuid'
      };

      const result = Validator.validateRequest(data, userIdSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'userId')).toBe(true);
    });
  });
});