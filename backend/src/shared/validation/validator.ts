/**
 * Unified validation system for Lambda functions
 * Provides common validation patterns and schema-based validation
 */

import Joi from 'joi';

export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationSchema<T> {
  schema: Joi.ObjectSchema<T>;
  name: string;
}

/**
 * Main validator class providing unified validation functionality
 */
export class Validator {
  /**
   * Validate data against a Joi schema
   */
  static validateRequest<T>(data: unknown, validationSchema: ValidationSchema<T>): ValidationResult<T> {
    const { error, value } = validationSchema.schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        code: detail.type
      }));

      return {
        isValid: false,
        errors
      };
    }

    return {
      isValid: true,
      data: value,
      errors: []
    };
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): ValidationResult<string> {
    const schema = Joi.string().email().required();
    const { error, value } = schema.validate(email);

    if (error) {
      return {
        isValid: false,
        errors: [{
          field: 'email',
          message: 'Invalid email format',
          code: 'INVALID_EMAIL'
        }]
      };
    }

    return {
      isValid: true,
      data: value,
      errors: []
    };
  }

  /**
   * Validate UUID format
   */
  static validateUUID(uuid: string): ValidationResult<string> {
    const schema = Joi.string().uuid().required();
    const { error, value } = schema.validate(uuid);

    if (error) {
      return {
        isValid: false,
        errors: [{
          field: 'uuid',
          message: 'Invalid UUID format',
          code: 'INVALID_UUID'
        }]
      };
    }

    return {
      isValid: true,
      data: value,
      errors: []
    };
  }

  /**
   * Validate required fields are present
   */
  static validateRequiredFields(data: Record<string, any>, requiredFields: string[]): ValidationResult {
    const errors: ValidationError[] = [];

    for (const field of requiredFields) {
      if (!data[field] && data[field] !== 0 && data[field] !== false) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD_MISSING'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate string length constraints
   */
  static validateStringLength(
    value: string, 
    field: string, 
    min?: number, 
    max?: number
  ): ValidationResult<string> {
    const errors: ValidationError[] = [];

    if (min !== undefined && value.length < min) {
      errors.push({
        field,
        message: `${field} must be at least ${min} characters long`,
        code: 'MIN_LENGTH_VIOLATION'
      });
    }

    if (max !== undefined && value.length > max) {
      errors.push({
        field,
        message: `${field} must be no more than ${max} characters long`,
        code: 'MAX_LENGTH_VIOLATION'
      });
    }

    return {
      isValid: errors.length === 0,
      data: value,
      errors
    };
  }

  /**
   * Validate enum values
   */
  static validateEnum<T extends string>(
    value: string, 
    field: string, 
    allowedValues: T[]
  ): ValidationResult<T> {
    if (!allowedValues.includes(value as T)) {
      return {
        isValid: false,
        errors: [{
          field,
          message: `${field} must be one of: ${allowedValues.join(', ')}`,
          code: 'INVALID_ENUM_VALUE'
        }]
      };
    }

    return {
      isValid: true,
      data: value as T,
      errors: []
    };
  }
}