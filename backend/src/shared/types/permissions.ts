/**
 * Role-Based Access Control (RBAC) types and permissions
 */

export interface Permission {
  resource: string;              // books, reviews, users, analytics
  action: string;                // create, read, update, delete, publish
  conditions?: string[];         // ownership, state-based, time-based
}

export interface AccessContext {
  userId: string;
  resourceOwnerId?: string;
  resourceState?: string;
  isAssigned?: boolean;
}

export type UserRole = 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  AUTHOR: [
    { resource: 'books', action: 'create' },
    { resource: 'books', action: 'read', conditions: ['own'] },
    { resource: 'books', action: 'update', conditions: ['own', 'draft'] },
    { resource: 'books', action: 'delete', conditions: ['own', 'draft'] },
    { resource: 'books', action: 'submit', conditions: ['own'] },
    { resource: 'reviews', action: 'read', conditions: ['own-books'] },
    { resource: 'analytics', action: 'read', conditions: ['own-books'] },
    { resource: 'users', action: 'read', conditions: ['own'] },
    { resource: 'users', action: 'update', conditions: ['own'] }
  ],
  EDITOR: [
    { resource: 'books', action: 'read', conditions: ['submitted', 'assigned'] },
    { resource: 'books', action: 'update', conditions: ['submitted', 'assigned'] },
    { resource: 'books', action: 'approve' },
    { resource: 'books', action: 'reject' },
    { resource: 'reviews', action: 'moderate' },
    { resource: 'users', action: 'read', conditions: ['authors'] },
    { resource: 'users', action: 'read', conditions: ['own'] },
    { resource: 'users', action: 'update', conditions: ['own'] }
  ],
  PUBLISHER: [
    { resource: 'books', action: 'read', conditions: ['ready'] },
    { resource: 'books', action: 'publish' },
    { resource: 'books', action: 'unpublish', conditions: ['emergency'] },
    { resource: 'analytics', action: 'read', conditions: ['all'] },
    { resource: 'users', action: 'read', conditions: ['all'] },
    { resource: 'users', action: 'read', conditions: ['own'] },
    { resource: 'users', action: 'update', conditions: ['own'] }
  ],
  READER: [
    { resource: 'books', action: 'read', conditions: ['published'] },
    { resource: 'reviews', action: 'create' },
    { resource: 'reviews', action: 'update', conditions: ['own'] },
    { resource: 'reviews', action: 'delete', conditions: ['own'] },
    { resource: 'users', action: 'read', conditions: ['own'] },
    { resource: 'users', action: 'update', conditions: ['own'] }
  ]
};