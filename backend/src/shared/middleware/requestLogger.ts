/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const startTime = Date.now();

  // Add request ID to headers for downstream services
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || 'unknown',
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): Response {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
    });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};