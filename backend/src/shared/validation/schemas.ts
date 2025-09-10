/**
 * Common validation schemas for Lambda functions
 * Extracted from individual services for reusability
 */

import Joi from 'joi';
import { ValidationSchema } from './validator';

// User-related types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Book-related types
export interface CreateBookRequest {
  title: string;
  description: string;
  content: string;
  genre: string;
}

export interface UpdateBookRequest {
  title?: string;
  description?: string;
  content?: string;
  genre?: string;
}

// Common validation schemas
export const loginSchema: ValidationSchema<LoginRequest> = {
  name: 'LoginRequest',
  schema: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(1).required()
  })
};

export const registerSchema: ValidationSchema<RegisterRequest> = {
  name: 'RegisterRequest',
  schema: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    role: Joi.string().valid('AUTHOR', 'EDITOR', 'PUBLISHER', 'READER').required()
  })
};

export const refreshTokenSchema: ValidationSchema<RefreshTokenRequest> = {
  name: 'RefreshTokenRequest',
  schema: Joi.object({
    refreshToken: Joi.string().required()
  })
};

export const createBookSchema: ValidationSchema<CreateBookRequest> = {
  name: 'CreateBookRequest',
  schema: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().min(1).max(1000).required(),
    content: Joi.string().min(1).required(),
    genre: Joi.string().valid(
      'fiction', 'non-fiction', 'mystery', 'romance', 'sci-fi', 
      'fantasy', 'biography', 'history', 'self-help', 'other'
    ).required()
  })
};

export const updateBookSchema: ValidationSchema<UpdateBookRequest> = {
  name: 'UpdateBookRequest',
  schema: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    description: Joi.string().min(1).max(1000).optional(),
    content: Joi.string().min(1).optional(),
    genre: Joi.string().valid(
      'fiction', 'non-fiction', 'mystery', 'romance', 'sci-fi', 
      'fantasy', 'biography', 'history', 'self-help', 'other'
    ).optional()
  }).min(1) // At least one field must be provided
};

// Common field validation schemas
export const uuidSchema = Joi.string().uuid();
export const emailSchema = Joi.string().email();
export const timestampSchema = Joi.string().isoDate();

// Query parameter schemas
export const paginationSchema: ValidationSchema<{limit?: number; lastEvaluatedKey?: string}> = {
  name: 'PaginationParams',
  schema: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    lastEvaluatedKey: Joi.string().optional()
  })
};

// Path parameter schemas
export const bookIdSchema: ValidationSchema<{bookId: string}> = {
  name: 'BookIdParam',
  schema: Joi.object({
    bookId: uuidSchema.required()
  })
};

export const userIdSchema: ValidationSchema<{userId: string}> = {
  name: 'UserIdParam',
  schema: Joi.object({
    userId: uuidSchema.required()
  })
};