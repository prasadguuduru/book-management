/**
 * User entity model for DynamoDB single table design
 */

import { DynamoDBEntity, User, UserRole, UserPreferences, EncryptedData } from '../../types';

export interface UserEntity extends DynamoDBEntity {
  PK: `USER#${string}`;
  SK: 'PROFILE';
  entityType: 'USER';
  userId: string;
  email: EncryptedData;
  firstName: EncryptedData;
  lastName: EncryptedData;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export class UserEntityMapper {
  /**
   * Convert User domain object to DynamoDB entity
   */
  static toDynamoDBEntity(
    user: User,
    encryptedEmail: EncryptedData,
    encryptedFirstName: EncryptedData,
    encryptedLastName: EncryptedData,
    hashedPassword: string
  ): UserEntity {
    return {
      PK: `USER#${user.userId}`,
      SK: 'PROFILE',
      entityType: 'USER',
      userId: user.userId,
      email: encryptedEmail,
      firstName: encryptedFirstName,
      lastName: encryptedLastName,
      passwordHash: hashedPassword,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      version: user.version,
    };
  }

  /**
   * Convert DynamoDB entity to User domain object
   */
  static fromDynamoDBEntity(
    entity: UserEntity,
    decryptedEmail: string,
    decryptedFirstName: string,
    decryptedLastName: string
  ): User {
    return {
      userId: entity.userId,
      email: decryptedEmail,
      firstName: decryptedFirstName,
      lastName: decryptedLastName,
      role: entity.role,
      isActive: entity.isActive,
      emailVerified: entity.emailVerified,
      preferences: entity.preferences,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };
  }

  /**
   * Create primary key for user entity
   */
  static createPK(userId: string): `USER#${string}` {
    return `USER#${userId}`;
  }

  /**
   * Create sort key for user profile
   */
  static createSK(): 'PROFILE' {
    return 'PROFILE';
  }

  /**
   * Validate user role
   */
  static isValidRole(role: string): role is UserRole {
    return ['AUTHOR', 'EDITOR', 'PUBLISHER', 'READER'].includes(role);
  }

  /**
   * Get default user preferences
   */
  static getDefaultPreferences(): UserPreferences {
    return {
      notifications: true,
      theme: 'light',
      language: 'en',
    };
  }

  /**
   * Validate user entity structure
   */
  static validateEntity(entity: any): entity is UserEntity {
    return (
      entity &&
      typeof entity.PK === 'string' &&
      entity.PK.startsWith('USER#') &&
      entity.SK === 'PROFILE' &&
      entity.entityType === 'USER' &&
      typeof entity.userId === 'string' &&
      entity.email &&
      entity.firstName &&
      entity.lastName &&
      (typeof entity.passwordHash === 'string' || typeof entity.hashedPassword === 'string') &&
      this.isValidRole(entity.role) &&
      typeof entity.isActive === 'boolean' &&
      typeof entity.emailVerified === 'boolean' &&
      entity.preferences &&
      typeof entity.createdAt === 'string' &&
      typeof entity.updatedAt === 'string' &&
      typeof entity.version === 'number'
    );
  }
}

/**
 * User role permissions mapping
 */
export const USER_ROLE_PERMISSIONS = {
  AUTHOR: [
    { resource: 'books', action: 'create' },
    { resource: 'books', action: 'read', conditions: ['own'] },
    { resource: 'books', action: 'update', conditions: ['own', 'draft'] },
    { resource: 'books', action: 'delete', conditions: ['own', 'draft'] },
    { resource: 'books', action: 'submit', conditions: ['own'] },
    { resource: 'reviews', action: 'read', conditions: ['own-books'] },
    { resource: 'analytics', action: 'read', conditions: ['own-books'] },
  ],
  EDITOR: [
    { resource: 'books', action: 'read', conditions: ['submitted'] },
    { resource: 'books', action: 'update', conditions: ['submitted'] },
    { resource: 'books', action: 'approve' },
    { resource: 'books', action: 'reject' },
    { resource: 'reviews', action: 'moderate' },
    { resource: 'users', action: 'read', conditions: ['authors'] },
  ],
  PUBLISHER: [
    { resource: 'books', action: 'read', conditions: ['ready'] },
    { resource: 'books', action: 'publish' },
    { resource: 'books', action: 'unpublish', conditions: ['emergency'] },
    { resource: 'analytics', action: 'read', conditions: ['all'] },
    { resource: 'users', action: 'read', conditions: ['all'] },
  ],
  READER: [
    { resource: 'books', action: 'read', conditions: ['published'] },
    { resource: 'reviews', action: 'create' },
    { resource: 'reviews', action: 'update', conditions: ['own'] },
    { resource: 'reviews', action: 'delete', conditions: ['own'] },
    { resource: 'users', action: 'read', conditions: ['own'] },
    { resource: 'users', action: 'update', conditions: ['own'] },
  ],
} as const;