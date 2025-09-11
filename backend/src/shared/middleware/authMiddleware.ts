/**
 * Authentication and authorization middleware
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { permissionValidator } from '../services/permissionService';
import { UserRole, AccessContext } from '../types/permissions';
import { createError } from './errorHandler';
import { logger } from '../utils/logger';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyToken(token);

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole
    };

    logger.debug('User authenticated', {
      userId: req.user.userId,
      role: req.user.role
    });

    next();
  } catch (error) {
    logger.error('Authentication failed', error instanceof Error ? error : new Error('Unknown error'));
    
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else if (error instanceof Error && error.name === 'JsonWebTokenError') {
      next(createError('Invalid token', 401, 'INVALID_TOKEN'));
    } else {
      next(createError('Authentication failed', 401, 'AUTHENTICATION_FAILED'));
    }
  }
};

/**
 * Middleware factory to authorize specific permissions
 */
export const authorize = (
  resource: string,
  action: string,
  contextExtractor?: (req: Request) => Partial<AccessContext>
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
      }

      // Build access context
      const baseContext: AccessContext = {
        userId: req.user.userId
      };

      // Extract additional context if provided
      const additionalContext = contextExtractor ? contextExtractor(req) : {};
      const context = { ...baseContext, ...additionalContext };

      // Validate permission
      const hasPermission = permissionValidator.validateAccess(
        req.user.role,
        resource,
        action,
        context
      );

      if (!hasPermission) {
        logger.warn('Authorization failed', {
          userId: req.user.userId,
          role: req.user.role,
          resource,
          action,
          context
        });
        throw createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      logger.debug('Authorization successful', {
        userId: req.user.userId,
        role: req.user.role,
        resource,
        action
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to require specific roles
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
      }

      if (!roles.includes(req.user.role)) {
        logger.warn('Role authorization failed', {
          userId: req.user.userId,
          userRole: req.user.role,
          requiredRoles: roles
        });
        throw createError('Insufficient role permissions', 403, 'INSUFFICIENT_ROLE_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Context extractors for common scenarios
 */
export const contextExtractors = {
  /**
   * Extract book ownership context from route parameters
   */
  bookOwnership: (req: Request): Partial<AccessContext> => ({
    resourceOwnerId: req.params['authorId'] || req.body.authorId,
    resourceState: req.body.status || req.params['status']
  }),

  /**
   * Extract user ownership context from route parameters
   */
  userOwnership: (req: Request): Partial<AccessContext> => ({
    resourceOwnerId: req.params['userId'] || req.params['id'] || 'unknown'
  }),

  /**
   * Extract review ownership context
   */
  reviewOwnership: (req: Request): Partial<AccessContext> => ({
    resourceOwnerId: req.body.userId || req.params['userId'] || 'unknown'
  })
};