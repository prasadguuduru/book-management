/**
 * Shared validation system exports
 * Provides unified validation functionality for all Lambda services
 */

// Core validation classes and interfaces
export {
  Validator,
  ValidationResult,
  ValidationError,
  ValidationSchema
} from './validator';

// Common validation schemas
export {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  CreateBookRequest,
  UpdateBookRequest,
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  createBookSchema,
  updateBookSchema,
  paginationSchema,
  bookIdSchema,
  userIdSchema,
  uuidSchema,
  emailSchema,
  timestampSchema
} from './schemas';

// Validation utilities and helpers
export {
  ValidationUtils,
  BookStatus,
  UserRole,
  BookGenre,
  VALID_BOOK_STATUSES,
  VALID_USER_ROLES,
  VALID_BOOK_GENRES
} from './validation-utils';