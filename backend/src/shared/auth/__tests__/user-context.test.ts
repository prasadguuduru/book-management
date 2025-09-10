/**
 * Tests for User Context Utilities
 */

import {
  UserContext,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessResource,
  canPerformWorkflowAction,
  getUserCapabilities,
  validateUserContext,
  auditAuthenticationEvent,
  auditAuthorizationEvent
} from '../user-context';
import { logger } from '../../../utils/logger';

// Mock logger
jest.mock('../../../utils/logger');
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('User Context Utilities', () => {
  const mockUserContext: UserContext = {
    userId: 'user-123',
    email: 'author@example.com',
    role: 'AUTHOR',
    permissions: [
      'book:create',
      'book:read',
      'book:update',
      'book:delete',
      'book:submit',
      'review:read',
      'user:read',
      'user:update',
      'workflow:read'
    ],
    isActive: true,
    correlationId: 'test-correlation-id'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger.functionEntry = jest.fn();
    mockLogger.functionExit = jest.fn();
    mockLogger.debug = jest.fn();
    mockLogger.security = jest.fn();
  });

  describe('PERMISSIONS constants', () => {
    it('should have all required permission constants', () => {
      expect(PERMISSIONS.BOOK_CREATE).toBe('book:create');
      expect(PERMISSIONS.BOOK_READ).toBe('book:read');
      expect(PERMISSIONS.REVIEW_CREATE).toBe('review:create');
      expect(PERMISSIONS.USER_MANAGE).toBe('user:manage');
      expect(PERMISSIONS.SYSTEM_ADMIN).toBe('system:admin');
    });
  });

  describe('ROLE_PERMISSIONS mappings', () => {
    it('should have correct permissions for READER role', () => {
      const readerPermissions = ROLE_PERMISSIONS.READER;
      expect(readerPermissions).toContain('book:read');
      expect(readerPermissions).toContain('review:create');
      expect(readerPermissions).not.toContain('book:create');
    });

    it('should have correct permissions for AUTHOR role', () => {
      const authorPermissions = ROLE_PERMISSIONS.AUTHOR;
      expect(authorPermissions).toContain('book:create');
      expect(authorPermissions).toContain('book:submit');
      expect(authorPermissions).not.toContain('book:approve');
    });

    it('should have correct permissions for EDITOR role', () => {
      const editorPermissions = ROLE_PERMISSIONS.EDITOR;
      expect(editorPermissions).toContain('book:approve');
      expect(editorPermissions).toContain('review:moderate');
      expect(editorPermissions).not.toContain('book:publish');
    });

    it('should have correct permissions for PUBLISHER role', () => {
      const publisherPermissions = ROLE_PERMISSIONS.PUBLISHER;
      expect(publisherPermissions).toContain('book:publish');
      expect(publisherPermissions).toContain('user:manage');
      expect(publisherPermissions).toContain('analytics:manage');
    });
  });

  describe('getPermissionsForRole', () => {
    it('should return correct permissions for valid role', () => {
      const permissions = getPermissionsForRole('AUTHOR');
      expect(permissions).toEqual(ROLE_PERMISSIONS.AUTHOR);
    });

    it('should return empty array for invalid role', () => {
      const permissions = getPermissionsForRole('INVALID' as any);
      expect(permissions).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true for permission user has', () => {
      const result = hasPermission(mockUserContext, 'book:create');
      expect(result).toBe(true);
    });

    it('should return false for permission user does not have', () => {
      const result = hasPermission(mockUserContext, 'system:admin');
      expect(result).toBe(false);
    });

    it('should log permission check', () => {
      hasPermission(mockUserContext, 'book:create');
      expect(mockLogger.functionEntry).toHaveBeenCalledWith(
        'hasPermission',
        expect.objectContaining({
          userId: 'user-123',
          permission: 'book:create'
        }),
        expect.any(Object)
      );
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', () => {
      const result = hasAnyPermission(mockUserContext, ['book:create', 'system:admin']);
      expect(result).toBe(true);
    });

    it('should return false if user has none of the permissions', () => {
      const result = hasAnyPermission(mockUserContext, ['system:admin', 'analytics:manage']);
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      const result = hasAllPermissions(mockUserContext, ['book:create', 'book:read']);
      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', () => {
      const result = hasAllPermissions(mockUserContext, ['book:create', 'system:admin']);
      expect(result).toBe(false);
    });
  });

  describe('canAccessResource', () => {
    it('should allow access for general permission', () => {
      const result = canAccessResource(mockUserContext, 'book', 'read');
      expect(result).toBe(true);
    });

    it('should deny access without permission', () => {
      const result = canAccessResource(mockUserContext, 'system', 'admin');
      expect(result).toBe(false);
    });

    it('should check ownership for author updating own book', () => {
      const result = canAccessResource(mockUserContext, 'book', 'update', 'user-123');
      expect(result).toBe(true);
    });

    it('should deny author updating other user book', () => {
      const result = canAccessResource(mockUserContext, 'book', 'update', 'other-user');
      expect(result).toBe(false);
    });
  });

  describe('canPerformWorkflowAction', () => {
    it('should allow author to submit books', () => {
      const result = canPerformWorkflowAction(mockUserContext, 'submit');
      expect(result).toBe(true);
    });

    it('should not allow author to approve books', () => {
      const result = canPerformWorkflowAction(mockUserContext, 'approve');
      expect(result).toBe(false);
    });

    it('should allow editor to approve books', () => {
      const editorContext = {
        ...mockUserContext,
        role: 'EDITOR' as const,
        permissions: [...mockUserContext.permissions, 'book:approve']
      };
      
      const result = canPerformWorkflowAction(editorContext, 'approve');
      expect(result).toBe(true);
    });

    it('should only allow publisher to publish books', () => {
      const result = canPerformWorkflowAction(mockUserContext, 'publish');
      expect(result).toBe(false);

      const publisherContext = {
        ...mockUserContext,
        role: 'PUBLISHER' as const,
        permissions: [...mockUserContext.permissions, 'book:publish']
      };
      
      const publishResult = canPerformWorkflowAction(publisherContext, 'publish');
      expect(publishResult).toBe(true);
    });
  });

  describe('getUserCapabilities', () => {
    it('should return correct capabilities for author', () => {
      const capabilities = getUserCapabilities(mockUserContext);
      
      expect(capabilities['canCreateBooks']).toBe(true);
      expect(capabilities['canSubmitBooks']).toBe(true);
      expect(capabilities['canApproveBooks']).toBe(false);
      expect(capabilities['canPublishBooks']).toBe(false);
      expect(capabilities['canManageUsers']).toBe(false);
      expect(capabilities['isSystemAdmin']).toBe(false);
    });

    it('should return correct capabilities for publisher', () => {
      const publisherContext = {
        ...mockUserContext,
        role: 'PUBLISHER' as const,
        permissions: ROLE_PERMISSIONS.PUBLISHER
      };
      
      const capabilities = getUserCapabilities(publisherContext);
      
      expect(capabilities['canCreateBooks']).toBe(false);
      expect(capabilities['canApproveBooks']).toBe(true);
      expect(capabilities['canPublishBooks']).toBe(true);
      expect(capabilities['canManageUsers']).toBe(true);
      expect(capabilities['canViewAnalytics']).toBe(true);
    });
  });

  describe('validateUserContext', () => {
    it('should validate correct user context', () => {
      const result = validateUserContext(mockUserContext);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidContext = {
        ...mockUserContext,
        userId: '',
        email: ''
      };
      
      const result = validateUserContext(invalidContext);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User ID is required');
      expect(result.errors).toContain('Email is required');
    });

    it('should detect inactive user', () => {
      const inactiveContext = {
        ...mockUserContext,
        isActive: false
      };
      
      const result = validateUserContext(inactiveContext);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User account is inactive');
    });

    it('should detect invalid role', () => {
      const invalidRoleContext = {
        ...mockUserContext,
        role: 'INVALID_ROLE' as any
      };
      
      const result = validateUserContext(invalidRoleContext);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid role: INVALID_ROLE');
    });

    it('should detect permission mismatch', () => {
      const mismatchContext = {
        ...mockUserContext,
        permissions: ['invalid:permission']
      };
      
      const result = validateUserContext(mismatchContext);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User permissions do not match role');
    });
  });

  describe('auditAuthenticationEvent', () => {
    it('should log authentication event', () => {
      auditAuthenticationEvent('LOGIN_SUCCESS', mockUserContext, { ip: '127.0.0.1' });
      
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Authentication Event: LOGIN_SUCCESS',
        expect.objectContaining({
          event: 'LOGIN_SUCCESS',
          userId: 'user-123',
          email: 'author@example.com',
          role: 'AUTHOR',
          metadata: { ip: '127.0.0.1' }
        })
      );
    });
  });

  describe('auditAuthorizationEvent', () => {
    it('should log authorization event', () => {
      auditAuthorizationEvent(
        'ACCESS_GRANTED',
        mockUserContext,
        'book',
        'create',
        'granted',
        { bookId: 'book-123' }
      );
      
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Authorization Event: ACCESS_GRANTED',
        expect.objectContaining({
          event: 'ACCESS_GRANTED',
          userId: 'user-123',
          resource: 'book',
          action: 'create',
          result: 'granted',
          metadata: { bookId: 'book-123' }
        })
      );
    });
  });
});