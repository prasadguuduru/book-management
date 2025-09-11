/**
 * Shared Authentication Module
 * Exports all authentication and authorization utilities
 */

// Re-export authentication middleware
export {
  UserContext,
  AuthResult,
  AuthenticatedHandler,
  LambdaHandler,
  extractUserContext,
  authenticateRequest,
  requireAuth,
  requireRole,
  requirePermission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions
} from './auth-middleware';

// Re-export user context utilities
export {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  canAccessResource,
  canPerformWorkflowAction,
  getUserCapabilities,
  validateUserContext,
  auditAuthenticationEvent,
  auditAuthorizationEvent
} from './user-context';

// Re-export types for convenience
export type { UserRole } from '../types';
// Custom JWT Authorizer for API Gateway
export { customAuthorizerHandler, healthCheck as authorizerHealthCheck } from './custom-authorizer';
