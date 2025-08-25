/**
 * Global error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any[];
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string;
  
  // Log the error
  logger.error('Request error', error, {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  
  // Determine error code
  const errorCode = error.code || 'INTERNAL_SERVER_ERROR';
  
  // Create error response
  const errorResponse: {
    error: {
      code: string;
      message: string;
      details?: any[];
    };
    timestamp: string;
    requestId: string;
  } = {
    error: {
      code: errorCode,
      message: error.message || 'An unexpected error occurred',
      details: error.details || [],
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Don't expose internal errors in production
  if (statusCode === 500 && process.env['NODE_ENV'] === 'production') {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  }

  res.status(statusCode).json(errorResponse);
};

export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any[]
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  if (code !== undefined) {
    error.code = code;
  }
  if (details !== undefined) {
    error.details = details;
  }
  return error;
};