/**
 * User Context Utilities
 * Provides standardized user context handling and permission checking helpers
 */

import { UserRole } from '../types';
import { logger } from '../utils/logger';

/**
 * Standardized user context interface (re-exported from auth-middleware)
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
 * Permission categories for different resources
 */
export const PERMISSIONS = {
  // Book permissions
  BOOK_CREATE: 'book:create',
  BOOK_READ: 'book:read',
  BOOK_UPDATE: 'book:update',
  BOOK_DELETE: 'book:delete',
  BOOK_SUBMIT: 'book:submit',
  BOOK_APPROVE: 'book:approve',
  BOOK_REJECT: 'book:reject',
  BOOK_PUBLISH: 'book:publish',
  
  // Review permissions
  REVIEW_CREATE: 'review:create',
  REVIEW_READ: 'review:read',
  REVIEW_UPDATE: 'review:update',
  REVIEW_DELETE: 'review:delete',
  REVIEW_MODERATE: 'review:moderate',
  
  // User permissions
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  
  // Workflow permissions
  WORKFLOW_READ: 'workflow:read',
  WORKFLOW_MANAGE: 'workflow:manage',
  
  // Analytics permissions
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_MANAGE: 'analytics:manage',
  
  // System permissions
  SYSTEM_ADMIN: 'system:admin'
} as const;

/**
 * Role-based permission mappings
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  READER: [
    PERMISSIONS.BOOK_READ,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE
  ],
  
  AUTHOR: [
    PERMISSIONS.BOOK_CREATE,
    PERMISSIONS.BOOK_READ,
    PERMISSIONS.BOOK_UPDATE,
    PERMISSIONS.BOOK_DELETE,
    PERMISSIONS.BOOK_SUBMIT,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.WORKFLOW_READ
  ],
  
  EDITOR: [
    PERMISSIONS.BOOK_READ,
    PERMISSIONS.BOOK_UPDATE,
    PERMISSIONS.BOOK_APPROVE,
    PERMISSIONS.BOOK_REJECT,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.REVIEW_MODERATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.WORKFLOW_MANAGE,
    PERMISSIONS.ANALYTICS_READ
  ],
  
  PUBLISHER: [
    PERMISSIONS.BOOK_READ,
    PERMISSIONS.BOOK_UPDATE,
    PERMISSIONS.BOOK_APPROVE,
    PERMISSIONS.BOOK_REJECT,
    PERMISSIONS.BOOK_PUBLISH,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.REVIEW_MODERATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.WORKFLOW_MANAGE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_MANAGE
  ]
};

/**
 * Get permissions for a specific role
 */
export const getPermissionsForRole = (role: UserRole): string[] => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (
  userContext: UserContext,
  permission: string,
  correlationId?: string
): boolean => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId,
    permission
  };
  
  logger.functionEntry('hasPermission', {
    userId: userContext.userId,
    role: userContext.role,
    permission,
    userPermissions: userContext.permissions
  }, logContext);

  const hasAccess = userContext.permissions.includes(permission);
  
  logger.debug('Permission check result', {
    hasAccess,
    ...logContext
  });

  return hasAccess;
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (
  userContext: UserContext,
  permissions: string[],
  correlationId?: string
): boolean => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId,
    permissions
  };
  
  logger.functionEntry('hasAnyPermission', {
    userId: userContext.userId,
    role: userContext.role,
    permissions,
    userPermissions: userContext.permissions
  }, logContext);

  const hasAccess = permissions.some(permission => userContext.permissions.includes(permission));
  
  logger.debug('Any permission check result', {
    hasAccess,
    matchedPermissions: permissions.filter(p => userContext.permissions.includes(p)),
    ...logContext
  });

  return hasAccess;
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (
  userContext: UserContext,
  permissions: string[],
  correlationId?: string
): boolean => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId,
    permissions
  };
  
  logger.functionEntry('hasAllPermissions', {
    userId: userContext.userId,
    role: userContext.role,
    permissions,
    userPermissions: userContext.permissions
  }, logContext);

  const hasAccess = permissions.every(permission => userContext.permissions.includes(permission));
  
  logger.debug('All permissions check result', {
    hasAccess,
    missingPermissions: permissions.filter(p => !userContext.permissions.includes(p)),
    ...logContext
  });

  return hasAccess;
};

/**
 * Check if user can access a specific resource
 */
export const canAccessResource = (
  userContext: UserContext,
  resourceType: string,
  action: string,
  resourceOwnerId?: string,
  correlationId?: string
): boolean => {
  const permission = `${resourceType}:${action}`;
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId,
    resourceType,
    action,
    permission,
    resourceOwnerId
  };
  
  logger.functionEntry('canAccessResource', {
    userId: userContext.userId,
    role: userContext.role,
    resourceType,
    action,
    permission,
    resourceOwnerId,
    isOwner: resourceOwnerId === userContext.userId
  }, logContext);

  // Check if user has the general permission
  const hasGeneralPermission = hasPermission(userContext, permission, correlationId);
  
  // For certain actions, check ownership
  const ownershipActions = ['update', 'delete'];
  const isOwnershipAction = ownershipActions.includes(action.toLowerCase());
  const isOwner = resourceOwnerId === userContext.userId;
  
  let hasAccess = hasGeneralPermission;
  
  // Special case: Authors can only modify their own books
  if (isOwnershipAction && resourceType === 'book' && userContext.role === 'AUTHOR') {
    hasAccess = hasGeneralPermission && isOwner;
  }
  
  logger.security('Resource access check', {
    hasAccess,
    hasGeneralPermission,
    isOwnershipAction,
    isOwner,
    ...logContext
  });

  return hasAccess;
};

/**
 * Check if user can perform workflow action
 */
export const canPerformWorkflowAction = (
  userContext: UserContext,
  action: string,
  currentStatus?: string,
  correlationId?: string
): boolean => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId,
    action,
    currentStatus
  };
  
  logger.functionEntry('canPerformWorkflowAction', {
    userId: userContext.userId,
    role: userContext.role,
    action,
    currentStatus
  }, logContext);

  let canPerform = false;

  switch (action.toLowerCase()) {
    case 'submit':
      // Authors can submit their own books
      canPerform = userContext.role === 'AUTHOR' && 
                   hasPermission(userContext, PERMISSIONS.BOOK_SUBMIT, correlationId);
      break;
      
    case 'approve':
      // Editors and Publishers can approve books
      canPerform = ['EDITOR', 'PUBLISHER'].includes(userContext.role) && 
                   hasPermission(userContext, PERMISSIONS.BOOK_APPROVE, correlationId);
      break;
      
    case 'reject':
      // Editors and Publishers can reject books
      canPerform = ['EDITOR', 'PUBLISHER'].includes(userContext.role) && 
                   hasPermission(userContext, PERMISSIONS.BOOK_REJECT, correlationId);
      break;
      
    case 'publish':
      // Only Publishers can publish books
      canPerform = userContext.role === 'PUBLISHER' && 
                   hasPermission(userContext, PERMISSIONS.BOOK_PUBLISH, correlationId);
      break;
      
    default:
      canPerform = false;
  }

  logger.security('Workflow action check', {
    canPerform,
    ...logContext
  });

  return canPerform;
};

/**
 * Get user capabilities based on role and permissions
 */
export const getUserCapabilities = (
  userContext: UserContext,
  correlationId?: string
): Record<string, boolean> => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId
  };
  
  logger.functionEntry('getUserCapabilities', {
    userId: userContext.userId,
    role: userContext.role,
    permissionCount: userContext.permissions.length
  }, logContext);

  const capabilities = {
    // Book capabilities
    canCreateBooks: hasPermission(userContext, PERMISSIONS.BOOK_CREATE, correlationId),
    canReadBooks: hasPermission(userContext, PERMISSIONS.BOOK_READ, correlationId),
    canUpdateBooks: hasPermission(userContext, PERMISSIONS.BOOK_UPDATE, correlationId),
    canDeleteBooks: hasPermission(userContext, PERMISSIONS.BOOK_DELETE, correlationId),
    canSubmitBooks: hasPermission(userContext, PERMISSIONS.BOOK_SUBMIT, correlationId),
    canApproveBooks: hasPermission(userContext, PERMISSIONS.BOOK_APPROVE, correlationId),
    canRejectBooks: hasPermission(userContext, PERMISSIONS.BOOK_REJECT, correlationId),
    canPublishBooks: hasPermission(userContext, PERMISSIONS.BOOK_PUBLISH, correlationId),
    
    // Review capabilities
    canCreateReviews: hasPermission(userContext, PERMISSIONS.REVIEW_CREATE, correlationId),
    canReadReviews: hasPermission(userContext, PERMISSIONS.REVIEW_READ, correlationId),
    canModerateReviews: hasPermission(userContext, PERMISSIONS.REVIEW_MODERATE, correlationId),
    
    // User capabilities
    canUpdateProfile: hasPermission(userContext, PERMISSIONS.USER_UPDATE, correlationId),
    canManageUsers: hasPermission(userContext, PERMISSIONS.USER_MANAGE, correlationId),
    
    // Workflow capabilities
    canViewWorkflow: hasPermission(userContext, PERMISSIONS.WORKFLOW_READ, correlationId),
    canManageWorkflow: hasPermission(userContext, PERMISSIONS.WORKFLOW_MANAGE, correlationId),
    
    // Analytics capabilities
    canViewAnalytics: hasPermission(userContext, PERMISSIONS.ANALYTICS_READ, correlationId),
    canManageAnalytics: hasPermission(userContext, PERMISSIONS.ANALYTICS_MANAGE, correlationId),
    
    // System capabilities
    isSystemAdmin: hasPermission(userContext, PERMISSIONS.SYSTEM_ADMIN, correlationId)
  };

  logger.debug('User capabilities calculated', {
    capabilities,
    ...logContext
  });

  return capabilities;
};

/**
 * Validate user context integrity
 */
export const validateUserContext = (
  userContext: UserContext,
  correlationId?: string
): { valid: boolean; errors: string[] } => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId
  };
  
  logger.functionEntry('validateUserContext', {
    userId: userContext.userId,
    role: userContext.role,
    isActive: userContext.isActive
  }, logContext);

  const errors: string[] = [];

  // Check required fields
  if (!userContext.userId) {
    errors.push('User ID is required');
  }
  
  if (!userContext.email) {
    errors.push('Email is required');
  }
  
  if (!userContext.role) {
    errors.push('Role is required');
  }
  
  if (!Array.isArray(userContext.permissions)) {
    errors.push('Permissions must be an array');
  }
  
  if (typeof userContext.isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  // Check if user is active
  if (!userContext.isActive) {
    errors.push('User account is inactive');
  }

  // Validate role
  const validRoles: UserRole[] = ['READER', 'AUTHOR', 'EDITOR', 'PUBLISHER'];
  if (!validRoles.includes(userContext.role)) {
    errors.push(`Invalid role: ${userContext.role}`);
  }

  // Validate permissions match role
  const expectedPermissions = getPermissionsForRole(userContext.role);
  const hasValidPermissions = expectedPermissions.every(permission => 
    userContext.permissions.includes(permission)
  );
  
  if (!hasValidPermissions) {
    errors.push('User permissions do not match role');
  }

  const isValid = errors.length === 0;

  logger.debug('User context validation result', {
    isValid,
    errorCount: errors.length,
    errors,
    ...logContext
  });

  if (!isValid) {
    logger.security('Invalid user context detected', {
      errors,
      ...logContext
    });
  }

  return { valid: isValid, errors };
};

/**
 * Create audit log entry for authentication events
 */
export const auditAuthenticationEvent = (
  event: string,
  userContext: UserContext,
  metadata?: Record<string, any>,
  correlationId?: string
): void => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId
  };
  
  logger.security(`Authentication Event: ${event}`, {
    ...logContext,
    event,
    email: userContext.email,
    role: userContext.role,
    timestamp: new Date().toISOString(),
    ...(userContext.sessionId && { sessionId: userContext.sessionId }),
    ...(metadata && { metadata })
  });
};

/**
 * Create audit log entry for authorization events
 */
export const auditAuthorizationEvent = (
  event: string,
  userContext: UserContext,
  resource?: string,
  action?: string,
  result?: 'granted' | 'denied',
  metadata?: Record<string, any>,
  correlationId?: string
): void => {
  const logContext = { 
    correlationId: correlationId || userContext.correlationId || 'unknown',
    userId: userContext.userId
  };
  
  logger.security(`Authorization Event: ${event}`, {
    ...logContext,
    event,
    email: userContext.email,
    role: userContext.role,
    resource,
    action,
    result,
    timestamp: new Date().toISOString(),
    metadata
  });
};