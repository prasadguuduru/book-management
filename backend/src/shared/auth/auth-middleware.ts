/**
 * Shared Authentication Middleware
 * Provides token validation, user context extraction, and role-based access control
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '../utils/auth';
import { userDAO } from '../data/dao/user-dao';
import { logger } from '../utils/logger';
import { sharedResponseHandler } from '../http/response-utils';
import { UserRole, Permission } from '../types';

/**
 * Standardized user context interface
 */
export interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  sessionId?: string;
  correlationId?: string;
}

/**
 * Authentication result interface
 */
export interface AuthResult {
  success: boolean;
  userContext?: UserContext;
  error?: APIGatewayProxyResult;
}

/**
 * Handler function type with user context
 */
export type AuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  userContext: UserContext
) => Promise<APIGatewayProxyResult>;

/**
 * Regular handler function type
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Extract user context from API Gateway authorizer or JWT token
 */
export const extractUserContext = async (
  event: APIGatewayProxyEvent,
  correlationId?: string
): Promise<UserContext | null> => {
  const logContext = { correlationId: correlationId || 'unknown' };

  logger.functionEntry('extractUserContext', {
    hasAuthorizer: !!event.requestContext?.authorizer,
    hasAuthHeader: !!(event.headers?.['Authorization'] || event.headers?.['authorization'])
  }, logContext);

  try {
    // First, try to extract from API Gateway authorizer context
    const authorizer = event.requestContext?.authorizer;
    if (authorizer && typeof authorizer === 'object' && 'principalId' in authorizer) {
      logger.debug('Extracting user context from API Gateway authorizer', logContext);

      const userContext: UserContext = {
        userId: (authorizer as any)['principalId'] as string,
        email: (authorizer as any).email || '',
        role: (authorizer as any).role || 'READER',
        permissions: (authorizer as any).permissions || [],
        isActive: (authorizer as any).isActive !== false,
        ...(correlationId && { correlationId }),
        ...((authorizer as any).sessionId && { sessionId: (authorizer as any).sessionId })
      };

      logger.info('User context extracted from authorizer', {
        userId: userContext.userId,
        role: userContext.role,
        permissionCount: userContext.permissions.length,
        ...logContext
      });

      return userContext;
    }

    // Fallback to JWT token extraction
    logger.debug('Attempting JWT token extraction', logContext);

    const authHeader = event.headers?.['Authorization'] || event.headers?.['authorization'];
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      logger.warn('No valid token found in request', logContext);
      return null;
    }

    // Verify and decode token
    const payload: JWTPayload = verifyToken(token);

    // Get user data to ensure user is still active
    const user = await userDAO.getUserById(payload.userId);
    if (!user || !user.isActive) {
      logger.security('Token valid but user inactive or not found', {
        userId: payload.userId,
        userExists: !!user,
        isActive: user?.isActive,
        ...logContext
      });
      return null;
    }

    // Get user permissions
    const permissionObjects = userDAO.getUserPermissions(user.role);
    const permissions = permissionObjects.map(p => `${p.resource}:${p.action}`);

    const userContext: UserContext = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      permissions,
      isActive: user.isActive,
      ...(correlationId && { correlationId })
    };

    logger.info('User context extracted from JWT token', {
      userId: userContext.userId,
      role: userContext.role,
      permissionCount: userContext.permissions.length,
      ...logContext
    });

    return userContext;

  } catch (error) {
    logger.error('Failed to extract user context', error as Error, logContext);
    return null;
  }
};

/**
 * Authenticate request and return user context or error response
 */
export const authenticateRequest = async (
  event: APIGatewayProxyEvent,
  correlationId?: string
): Promise<AuthResult> => {
  const logContext = { correlationId: correlationId || 'unknown' };

  logger.functionEntry('authenticateRequest', {
    path: event.path,
    method: event.httpMethod
  }, logContext);

  try {
    const userContext = await extractUserContext(event, correlationId);

    if (!userContext) {
      logger.security('Authentication failed - no valid user context', logContext);

      return {
        success: false,
        error: sharedResponseHandler.unauthorized('Authentication required')
      };
    }

    logger.security('Authentication successful', {
      userId: userContext.userId,
      role: userContext.role,
      ...logContext
    });

    return {
      success: true,
      userContext
    };

  } catch (error) {
    logger.error('Authentication error', error as Error, logContext);

    return {
      success: false,
      error: sharedResponseHandler.unauthorized('Invalid or expired token')
    };
  }
};

/**
 * Middleware that requires authentication
 */
export const requireAuth = (handler: AuthenticatedHandler): LambdaHandler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const correlationId = event.requestContext?.requestId || 'unknown';

    logger.functionEntry('requireAuth', {
      path: event.path,
      method: event.httpMethod
    }, { correlationId });

    const authResult = await authenticateRequest(event, correlationId);

    if (!authResult.success || !authResult.userContext) {
      logger.security('Authentication middleware blocked request', {
        path: event.path,
        method: event.httpMethod,
        correlationId
      });

      return authResult.error!;
    }

    // Add audit logging for authenticated requests
    logger.security('Authenticated request processing', {
      userId: authResult.userContext.userId,
      role: authResult.userContext.role,
      path: event.path,
      method: event.httpMethod,
      correlationId
    });

    try {
      return await handler(event, authResult.userContext);
    } catch (error) {
      logger.error('Handler error in authenticated request', error as Error, {
        userId: authResult.userContext.userId,
        correlationId
      });

      return sharedResponseHandler.internalError('Request processing failed');
    }
  };
};

/**
 * Middleware that requires specific roles
 */
export const requireRole = (
  allowedRoles: UserRole[],
  handler: AuthenticatedHandler
): LambdaHandler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const correlationId = event.requestContext?.requestId || 'unknown';

    logger.functionEntry('requireRole', {
      allowedRoles,
      path: event.path,
      method: event.httpMethod
    }, { correlationId });

    const authResult = await authenticateRequest(event, correlationId);

    if (!authResult.success || !authResult.userContext) {
      logger.security('Role middleware blocked request - authentication failed', {
        path: event.path,
        method: event.httpMethod,
        correlationId
      });

      return authResult.error!;
    }

    // Check if user has required role
    if (!allowedRoles.includes(authResult.userContext.role)) {
      logger.security('Role middleware blocked request - insufficient permissions', {
        userId: authResult.userContext.userId,
        userRole: authResult.userContext.role,
        requiredRoles: allowedRoles,
        path: event.path,
        method: event.httpMethod,
        correlationId
      });

      return sharedResponseHandler.forbidden(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
    }

    // Add audit logging for role-based access
    logger.security('Role-based access granted', {
      userId: authResult.userContext.userId,
      role: authResult.userContext.role,
      requiredRoles: allowedRoles,
      path: event.path,
      method: event.httpMethod,
      correlationId
    });

    try {
      return await handler(event, authResult.userContext);
    } catch (error) {
      logger.error('Handler error in role-protected request', error as Error, {
        userId: authResult.userContext.userId,
        role: authResult.userContext.role,
        correlationId
      });

      return sharedResponseHandler.internalError('Request processing failed');
    }
  };
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (
  userContext: UserContext,
  permission: string
): boolean => {
  return userContext.permissions.includes(permission);
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (
  userContext: UserContext,
  permissions: string[]
): boolean => {
  return permissions.some(permission => userContext.permissions.includes(permission));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (
  userContext: UserContext,
  permissions: string[]
): boolean => {
  return permissions.every(permission => userContext.permissions.includes(permission));
};

/**
 * Middleware that requires specific permissions
 */
export const requirePermission = (
  requiredPermissions: string[],
  requireAll: boolean = false,
  handler: AuthenticatedHandler
): LambdaHandler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const correlationId = event.requestContext?.requestId || 'unknown';

    logger.functionEntry('requirePermission', {
      requiredPermissions,
      requireAll,
      path: event.path,
      method: event.httpMethod
    }, { correlationId });

    const authResult = await authenticateRequest(event, correlationId);

    if (!authResult.success || !authResult.userContext) {
      logger.security('Permission middleware blocked request - authentication failed', {
        path: event.path,
        method: event.httpMethod,
        correlationId
      });

      return authResult.error!;
    }

    // Check permissions
    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(authResult.userContext, requiredPermissions)
      : hasAnyPermission(authResult.userContext, requiredPermissions);

    if (!hasRequiredPermissions) {
      logger.security('Permission middleware blocked request - insufficient permissions', {
        userId: authResult.userContext.userId,
        userPermissions: authResult.userContext.permissions,
        requiredPermissions,
        requireAll,
        path: event.path,
        method: event.httpMethod,
        correlationId
      });

      return sharedResponseHandler.forbidden(
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}`
      );
    }

    // Add audit logging for permission-based access
    logger.security('Permission-based access granted', {
      userId: authResult.userContext.userId,
      userPermissions: authResult.userContext.permissions,
      requiredPermissions,
      requireAll,
      path: event.path,
      method: event.httpMethod,
      correlationId
    });

    try {
      return await handler(event, authResult.userContext);
    } catch (error) {
      logger.error('Handler error in permission-protected request', error as Error, {
        userId: authResult.userContext.userId,
        correlationId
      });

      return sharedResponseHandler.internalError('Request processing failed');
    }
  };
};