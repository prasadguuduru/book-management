/**
 * Permission validation service for RBAC
 */

import { UserRole, ROLE_PERMISSIONS, Permission, AccessContext } from '../types/permissions';
import { logger } from '../utils/logger';

export class PermissionValidator {
  /**
   * Validate if a user has permission to perform an action on a resource
   */
  validateAccess(
    userRole: UserRole,
    resource: string,
    action: string,
    context: AccessContext
  ): boolean {
    try {
      const permissions = ROLE_PERMISSIONS[userRole] || [];
      
      const permission = permissions.find(p => 
        p.resource === resource && p.action === action
      );
      
      if (!permission) {
        logger.debug('Permission denied: no matching permission found', {
          userRole,
          resource,
          action,
          userId: context.userId
        });
        return false;
      }
      
      const conditionsValid = this.validateConditions(permission.conditions, context);
      
      logger.debug('Permission validation result', {
        userRole,
        resource,
        action,
        userId: context.userId,
        conditionsValid,
        conditions: permission.conditions
      });
      
      return conditionsValid;
    } catch (error) {
      logger.error('Error validating permissions', error instanceof Error ? error : new Error('Unknown error'), {
        userRole,
        resource,
        action,
        userId: context.userId
      });
      return false;
    }
  }

  /**
   * Validate permission conditions
   */
  private validateConditions(
    conditions: string[] = [],
    context: AccessContext
  ): boolean {
    for (const condition of conditions) {
      switch (condition) {
        case 'own':
          if (context.resourceOwnerId !== context.userId) {
            return false;
          }
          break;
        case 'draft':
          if (context.resourceState !== 'DRAFT') {
            return false;
          }
          break;
        case 'submitted':
          if (context.resourceState !== 'SUBMITTED_FOR_EDITING') {
            return false;
          }
          break;
        case 'ready':
          if (context.resourceState !== 'READY_FOR_PUBLICATION') {
            return false;
          }
          break;
        case 'published':
          if (context.resourceState !== 'PUBLISHED') {
            return false;
          }
          break;
        case 'assigned':
          if (!context.isAssigned) {
            return false;
          }
          break;
        case 'own-books':
          // This would require additional context about book ownership
          // For now, we'll assume it's valid if resourceOwnerId matches
          if (context.resourceOwnerId !== context.userId) {
            return false;
          }
          break;
        case 'authors':
          // This condition is for editors to access author information
          // Implementation would depend on the specific use case
          break;
        case 'all':
          // Publishers can access all resources of this type
          break;
        case 'emergency':
          // Emergency conditions would be implemented based on business rules
          break;
        default:
          logger.warn('Unknown permission condition', { condition });
          return false;
      }
    }
    return true;
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if a role has any permission for a resource
   */
  hasResourceAccess(role: UserRole, resource: string): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.some(p => p.resource === resource);
  }
}

// Export singleton instance
export const permissionValidator = new PermissionValidator();