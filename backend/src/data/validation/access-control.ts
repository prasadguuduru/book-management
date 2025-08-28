/**
 * Role-based access control validation service
 */

import { UserRole, BookStatus, Permission } from '../../types';
import { USER_ROLE_PERMISSIONS } from '../entities/user-entity';
import { STATE_TRANSITION_PERMISSIONS } from '../entities/book-entity';
import { logger } from '../../utils/logger';

export interface AccessContext {
  userId: string;
  userRole: UserRole;
  resourceId?: string;
  resourceOwnerId?: string;
  resourceState?: BookStatus;
  isAssigned?: boolean;
  metadata?: Record<string, any>;
}

export class AccessControlService {
  /**
   * Check if user has permission to perform an action on a resource
   */
  hasPermission(
    context: AccessContext,
    resource: string,
    action: string
  ): boolean {
    try {
      const permissions = this.getUserPermissions(context.userRole);
      
      const permission = permissions.find(p => 
        p.resource === resource && p.action === action
      );
      
      if (!permission) {
        logger.debug(`Permission denied: No permission found for ${context.userRole} to ${action} ${resource}`);
        return false;
      }

      // If no conditions required, permission is granted
      if (!permission.conditions || permission.conditions.length === 0) {
        logger.debug(`Permission granted: No conditions required for ${context.userRole} to ${action} ${resource}`);
        return true;
      }

      // Validate all conditions
      const conditionsValid = this.validateConditions(permission.conditions, context);
      
      if (conditionsValid) {
        logger.debug(`Permission granted: All conditions met for ${context.userRole} to ${action} ${resource}`);
      } else {
        logger.debug(`Permission denied: Conditions not met for ${context.userRole} to ${action} ${resource}`);
      }

      return conditionsValid;
    } catch (error) {
      logger.error('Error checking permission:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get all permissions for a user role
   */
  getUserPermissions(role: UserRole): Permission[] {
    const permissions = USER_ROLE_PERMISSIONS[role] || [];
    return permissions.map(p => {
      const permission: Permission = {
        resource: p.resource,
        action: p.action
      };
      if ('conditions' in p && p.conditions) {
        permission.conditions = [...p.conditions];
      }
      return permission;
    });
  }

  /**
   * Validate permission conditions
   */
  private validateConditions(conditions: string[], context: AccessContext): boolean {
    for (const condition of conditions) {
      if (!this.validateCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate a single condition
   */
  private validateCondition(condition: string, context: AccessContext): boolean {
    switch (condition) {
      case 'own':
        return context.resourceOwnerId === context.userId;
      
      case 'draft':
        return context.resourceState === 'DRAFT';
      
      case 'submitted':
        return context.resourceState === 'SUBMITTED_FOR_EDITING';
      
      case 'ready':
        return context.resourceState === 'READY_FOR_PUBLICATION';
      
      case 'published':
        return context.resourceState === 'PUBLISHED';
      
      case 'assigned':
        return context.isAssigned === true;
      
      case 'own-books':
        // For reviews on own books - would need additional logic
        return true; // Simplified for now
      
      case 'authors':
        // For editors accessing author information
        return true; // Simplified for now
      
      case 'all':
        // For publishers/admins accessing all resources
        return context.userRole === 'PUBLISHER' || context.userRole === 'EDITOR';
      
      case 'emergency':
        // For emergency unpublishing - would need additional metadata
        return context.metadata?.['emergency'] === true;
      
      default:
        logger.warn(`Unknown condition: ${condition}`);
        return false;
    }
  }

  /**
   * Check if user can transition book state
   */
  canTransitionBookState(
    userRole: UserRole,
    currentStatus: BookStatus,
    newStatus: BookStatus
  ): boolean {
    try {
      const rolePermissions = STATE_TRANSITION_PERMISSIONS[userRole];
      const allowedTransitions = rolePermissions[currentStatus] as readonly BookStatus[];
      
      const canTransition = allowedTransitions.includes(newStatus);
      
      if (canTransition) {
        logger.debug(`State transition allowed: ${userRole} can change ${currentStatus} to ${newStatus}`);
      } else {
        logger.debug(`State transition denied: ${userRole} cannot change ${currentStatus} to ${newStatus}`);
      }

      return canTransition;
    } catch (error) {
      logger.error('Error checking state transition permission:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get valid state transitions for a user role and current status
   */
  getValidStateTransitions(userRole: UserRole, currentStatus: BookStatus): BookStatus[] {
    try {
      const rolePermissions = STATE_TRANSITION_PERMISSIONS[userRole];
      return [...(rolePermissions[currentStatus] || [])];
    } catch (error) {
      logger.error('Error getting valid state transitions:', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Check if user can access book based on role and book state
   */
  canAccessBook(
    userRole: UserRole,
    userId: string,
    bookAuthorId: string,
    bookStatus: BookStatus,
    isAssigned: boolean = false
  ): boolean {
    const context: AccessContext = {
      userId,
      userRole,
      resourceOwnerId: bookAuthorId,
      resourceState: bookStatus,
      isAssigned,
    };

    return this.hasPermission(context, 'books', 'read');
  }

  /**
   * Check if user can edit book
   */
  canEditBook(
    userRole: UserRole,
    userId: string,
    bookAuthorId: string,
    bookStatus: BookStatus,
    isAssigned: boolean = false
  ): boolean {
    const context: AccessContext = {
      userId,
      userRole,
      resourceOwnerId: bookAuthorId,
      resourceState: bookStatus,
      isAssigned,
    };

    return this.hasPermission(context, 'books', 'update');
  }

  /**
   * Check if user can delete book
   */
  canDeleteBook(
    userRole: UserRole,
    userId: string,
    bookAuthorId: string,
    bookStatus: BookStatus
  ): boolean {
    const context: AccessContext = {
      userId,
      userRole,
      resourceOwnerId: bookAuthorId,
      resourceState: bookStatus,
    };

    return this.hasPermission(context, 'books', 'delete');
  }

  /**
   * Check if user can create reviews
   */
  canCreateReview(
    userRole: UserRole,
    bookStatus: BookStatus
  ): boolean {
    const context: AccessContext = {
      userId: 'any', // Not relevant for this check
      userRole,
      resourceState: bookStatus,
    };

    return this.hasPermission(context, 'reviews', 'create');
  }

  /**
   * Check if user can moderate reviews
   */
  canModerateReviews(userRole: UserRole): boolean {
    const context: AccessContext = {
      userId: 'any', // Not relevant for this check
      userRole,
    };

    return this.hasPermission(context, 'reviews', 'moderate');
  }

  /**
   * Get user capabilities summary
   */
  getUserCapabilities(userRole: UserRole): {
    canCreateBooks: boolean;
    canEditOwnBooks: boolean;
    canDeleteOwnBooks: boolean;
    canSubmitBooks: boolean;
    canApproveBooks: boolean;
    canPublishBooks: boolean;
    canCreateReviews: boolean;
    canModerateReviews: boolean;
    canAccessAnalytics: boolean;
  } {
    const permissions = this.getUserPermissions(userRole);
    
    return {
      canCreateBooks: permissions.some(p => p.resource === 'books' && p.action === 'create'),
      canEditOwnBooks: permissions.some(p => p.resource === 'books' && p.action === 'update' && p.conditions?.includes('own')),
      canDeleteOwnBooks: permissions.some(p => p.resource === 'books' && p.action === 'delete' && p.conditions?.includes('own')),
      canSubmitBooks: permissions.some(p => p.resource === 'books' && p.action === 'submit'),
      canApproveBooks: permissions.some(p => p.resource === 'books' && p.action === 'approve'),
      canPublishBooks: permissions.some(p => p.resource === 'books' && p.action === 'publish'),
      canCreateReviews: permissions.some(p => p.resource === 'reviews' && p.action === 'create'),
      canModerateReviews: permissions.some(p => p.resource === 'reviews' && p.action === 'moderate'),
      canAccessAnalytics: permissions.some(p => p.resource === 'analytics' && p.action === 'read'),
    };
  }

  /**
   * Validate role assignment
   */
  isValidRoleAssignment(_currentRole: UserRole, newRole: UserRole, assignerRole: UserRole): boolean {
    // Only publishers can change user roles (simplified business rule)
    if (assignerRole !== 'PUBLISHER') {
      return false;
    }

    // Publishers can assign any role
    return ['AUTHOR', 'EDITOR', 'PUBLISHER', 'READER'].includes(newRole);
  }

  /**
   * Get role hierarchy level (for permission escalation checks)
   */
  getRoleLevel(role: UserRole): number {
    const roleLevels = {
      READER: 1,
      AUTHOR: 2,
      EDITOR: 3,
      PUBLISHER: 4,
    };
    
    return roleLevels[role] || 0;
  }

  /**
   * Check if role has higher privileges than another
   */
  hasHigherPrivileges(role1: UserRole, role2: UserRole): boolean {
    return this.getRoleLevel(role1) > this.getRoleLevel(role2);
  }
}

// Singleton instance
export const accessControlService = new AccessControlService();