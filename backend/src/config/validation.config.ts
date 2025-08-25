import Joi from 'joi';
import { BookGenre, BookStatus, NotificationChannel, NotificationType, UserRole } from '../types/enums';

export const validationSchemas = {
  // Auth Schemas
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    role: Joi.string().valid(...Object.values(UserRole)).required(),
  }),

  // Book Schemas
  createBook: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(2000).required(),
    content: Joi.string().max(2000000).required(), // 2MB limit
    genre: Joi.string().valid(...Object.values(BookGenre)).required(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).required(),
  }),

  updateBook: Joi.object({
    title: Joi.string().min(1).max(200),
    description: Joi.string().max(2000),
    content: Joi.string().max(2000000),
    genre: Joi.string().valid(...Object.values(BookGenre)),
    tags: Joi.array().items(Joi.string().max(50)).max(10),
  }),

  // Review Schemas
  createReview: Joi.object({
    bookId: Joi.string().uuid().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().min(10).max(2000).required(),
  }),

  // Workflow Schemas
  workflowTransition: Joi.object({
    bookId: Joi.string().uuid().required(),
    action: Joi.string().valid('SUBMIT', 'APPROVE', 'REJECT', 'PUBLISH').required(),
    comments: Joi.string().max(1000),
  }),

  // User Profile Schemas
  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    preferences: Joi.object({
      notifications: Joi.boolean(),
      theme: Joi.string().valid('light', 'dark'),
      language: Joi.string().length(2), // ISO 639-1 language code
    }),
  }),

  // Query Parameters
  queryParams: {
    pagination: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0),
    }),

    bookFilters: Joi.object({
      status: Joi.string().valid(...Object.values(BookStatus)),
      genre: Joi.string().valid(...Object.values(BookGenre)),
      authorId: Joi.string().uuid(),
    }),

    notificationFilters: Joi.object({
      unreadOnly: Joi.boolean().default(false),
      type: Joi.string().valid(...Object.values(NotificationType)),
      channel: Joi.string().valid(...Object.values(NotificationChannel)),
    }),
  },
};

// Validation options
export const validationOptions = {
  abortEarly: false, // Return all errors
  stripUnknown: true, // Remove unknown fields
  presence: 'required' as const, // Require explicit undefined
};

// Error formatter
export const formatValidationError = (error: Joi.ValidationError) => ({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request data',
    details: error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
    })),
  },
  timestamp: new Date().toISOString(),
  requestId: '', // Will be populated at runtime
});
