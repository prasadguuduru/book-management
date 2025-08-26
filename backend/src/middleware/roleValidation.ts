/**
 * Role validation middleware for Lambda functions
 * Provides role-based access control for serverless functions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyToken } from '../utils/auth';
import { userDAO } from '../data/dao/user-dao';
import { logger } from '../utils/logger';
import { UserRole, Permission } from '../types';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
}

export interface ValidationResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: APIGatewayProxyResult;
}

/**
 * Middleware to validate JWT token and extract user information
 */
export const validateToken = async (event: APIGatewayProxyEvent): Promise<ValidationResult> => {
  try {
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: createErrorResponse(401, 'MISSING_TOKEN', 'Authorization token is required')
      };
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    // Get user permissions
    const permissions = userDAO.getUserPermissions(payload.role as UserRole);

    const user: AuthenticatedUser = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      permissions
    };

    logger.debug('Token validation successful', {
      userId: user.userId,
      role: user.role,
      permissionCount: permissions.length
    });

    return {
      success: true,
      user
    };

  } catch (error) {
    logger.error('Token validation failed', error as Error);
    return {
      success: false,
      error: createErrorResponse(401, 'INVALID_TOKEN', 'Invalid or expired token')
    };
  }
};

/**
 * Middleware to require specific roles
 */
export const requireRoles = (allowedRoles: UserRole[]) => {
  return async (event: APIGatewayProxyEvent): Promise<ValidationResult> => {
    const tokenResult = await validateToken(event);
    
    if (!tokenResult.success || !tokenResult.user) {
      return tokenResult;
    }

    if (!allowedRoles.includes(tokenResult.user.role)) {
      logger.warn('Role authorization failed', {
        userId: tokenResult.user.userId,
        userRole: tokenResult.user.role,
        allowedRoles
      });

      return {
        success: false,
        error: createErrorResponse(403, 'INSUFFICIENT_ROLE', `Access denied. Required roles: ${allowedRoles.join(', ')}`)
      };
    }

    logger.debug('Role validation successful', {
      userId: tokenResult.user.userId,
      role: tokenResult.user.role,
      allowedRoles
    });

    return tokenResult;
  };
};

/**
 * Middleware to require specific permissions
 */
export const requirePermission = (resource: string, action: string) => {
  return async (event: APIGatewayProxyEvent): Promise<ValidationResult> => {
    const tokenResult = await validateToken(event);
    
    if (!tokenResult.success || !tokenResult.user) {
      return tokenResult;
    }

    const hasPermission = tokenResult.user.permissions.some(permission =>
      permission.resource === resource && permission.action === action
    );

    if (!hasPermission) {
      logger.warn('Permission authorization failed', {
        userId: tokenResult.user.userId,
        role: tokenResult.user.role,
        requiredResource: resource,
        requiredAction: action
      });

      return {
        success: false,
        error: createErrorResponse(403, 'INSUFFICIENT_PERMISSION', `Access denied. Required permission: ${action} on ${resource}`)
      };
    }

    logger.debug('Permission validation successful', {
      userId: tokenResult.user.userId,
      role: tokenResult.user.role,
      resource,
      action
    });

    return tokenResult;
  };
};

/**
 * Middleware to validate resource ownership
 */
export const requireOwnership = (resourceIdExtractor: (event: APIGatewayProxyEvent) => string) => {
  return async (event: APIGatewayProxyEvent): Promise<ValidationResult> => {
    const tokenResult = await validateToken(event);
    
    if (!tokenResult.success || !tokenResult.user) {
      return tokenResult;
    }

    const resourceOwnerId = resourceIdExtractor(event);
    
    // Allow if user owns the resource or has admin-level permissions
    const isOwner = tokenResult.user.userId === resourceOwnerId;
    const hasAdminRole = ['EDITOR', 'PUBLISHER'].includes(tokenResult.user.role);

    if (!isOwner && !hasAdminRole) {
      logger.warn('Ownership authorization failed', {
        userId: tokenResult.user.userId,
        role: tokenResult.user.role,
        resourceOwnerId
      });

      return {
        success: false,
        error: createErrorResponse(403, 'ACCESS_DENIED', 'Access denied. You can only access your own resources.')
      };
    }

    logger.debug('Ownership validation successful', {
      userId: tokenResult.user.userId,
      role: tokenResult.user.role,
      resourceOwnerId,
      isOwner,
      hasAdminRole
    });

    return tokenResult;
  };
};

/**
 * Middleware to validate book access based on status and role
 */
export const requireBookAccess = (statusExtractor: (event: APIGatewayProxyEvent) => string) => {
  return async (event: APIGatewayProxyEvent): Promise<ValidationResult> => {
    const tokenResult = await validateToken(event);
    
    if (!tokenResult.success || !tokenResult.user) {
      return tokenResult;
    }

    const bookStatus = statusExtractor(event);
    const userRole = tokenResult.user.role;

    // Define access rules based on book status and user role
    const hasAccess = (() => {
      switch (bookStatus) {
        case 'DRAFT':
          return userRole === 'AUTHOR'; // Only authors can access drafts
        case 'SUBMITTED_FOR_EDITING':
          return ['AUTHOR', 'EDITOR'].includes(userRole); // Authors and editors
        case 'READY_FOR_PUBLICATION':
          return ['AUTHOR', 'EDITOR', 'PUBLISHER'].includes(userRole); // All except readers
        case 'PUBLISHED':
          return true; // Everyone can access published books
        default:
          return false;
      }
    })();

    if (!hasAccess) {
      logger.warn('Book access authorization failed', {
        userId: tokenResult.user.userId,
        role: tokenResult.user.role,
        bookStatus
      });

      return {
        success: false,
        error: createErrorResponse(403, 'BOOK_ACCESS_DENIED', `Access denied. ${userRole} cannot access books in ${bookStatus} status.`)
      };
    }

    logger.debug('Book access validation successful', {
      userId: tokenResult.user.userId,
      role: tokenResult.user.role,
      bookStatus
    });

    return tokenResult;
  };
};

/**
 * Combine multiple middleware functions
 */
export const combineMiddleware = (...middlewares: Array<(event: APIGatewayProxyEvent) => Promise<ValidationResult>>) => {
  return async (event: APIGatewayProxyEvent): Promise<ValidationResult> => {
    for (const middleware of middlewares) {
      const result = await middleware(event);
      if (!result.success) {
        return result;
      }
    }

    // If all middleware passed, return the last successful result
    const lastMiddleware = middlewares[middlewares.length - 1];
    if (lastMiddleware) {
      return await lastMiddleware(event);
    }
    
    // Fallback - should not happen if middlewares array is not empty
    return { success: false, error: createErrorResponse(500, 'MIDDLEWARE_ERROR', 'No middleware to execute') };
  };
};

/**
 * Common resource ID extractors
 */
export const extractors = {
  /**
   * Extract user ID from path parameters
   */
  userIdFromPath: (event: APIGatewayProxyEvent): string => {
    return event.pathParameters?.['userId'] || event.pathParameters?.['id'] || '';
  },

  /**
   * Extract author ID from path parameters
   */
  authorIdFromPath: (event: APIGatewayProxyEvent): string => {
    return event.pathParameters?.['authorId'] || '';
  },

  /**
   * Extract book ID from path parameters
   */
  bookIdFromPath: (event: APIGatewayProxyEvent): string => {
    return event.pathParameters?.['bookId'] || event.pathParameters?.['id'] || '';
  },

  /**
   * Extract book status from path parameters
   */
  bookStatusFromPath: (event: APIGatewayProxyEvent): string => {
    return event.pathParameters?.['status'] || '';
  },

  /**
   * Extract book status from request body
   */
  bookStatusFromBody: (event: APIGatewayProxyEvent): string => {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      return body.status || '';
    } catch {
      return '';
    }
  },

  /**
   * Extract user ID from request body
   */
  userIdFromBody: (event: APIGatewayProxyEvent): string => {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      return body.userId || '';
    } catch {
      return '';
    }
  }
};

/**
 * Helper function to create error responses
 */
const createErrorResponse = (
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify({
      error: {
        code,
        message
      },
      timestamp: new Date().toISOString(),
      requestId: `middleware-${Date.now()}`
    })
  };
};

/**
 * Utility function to wrap Lambda handlers with authentication
 */
export const withAuth = (
  handler: (event: APIGatewayProxyEvent, user: AuthenticatedUser) => Promise<APIGatewayProxyResult>,
  ...middlewares: Array<(event: APIGatewayProxyEvent) => Promise<ValidationResult>>
) => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Apply all middleware
      const combinedMiddleware = combineMiddleware(...middlewares);
      const validationResult = await combinedMiddleware(event);

      if (!validationResult.success || !validationResult.user) {
        return validationResult.error!;
      }

      // Call the actual handler with authenticated user
      return await handler(event, validationResult.user);

    } catch (error) {
      logger.error('Authentication wrapper error', error as Error);
      return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  };
};