/**
 * User Data Access Object with CRUD operations
 */

import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { dynamoDBClient } from '@/data/dynamodb-client';
import { UserEntityMapper, USER_ROLE_PERMISSIONS } from '@/data/entities/user-entity';
import { encryptionService } from '@/utils/encryption';
import { logger } from '@/utils/logger';
import { User, UserRole, RegisterRequest, Permission } from '@/types';

export class UserDAO {
  private client = dynamoDBClient;

  /**
   * Create a new user
   */
  async createUser(userData: RegisterRequest): Promise<string> {
    const userId = uuidv4();
    const now = new Date().toISOString();

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Encrypt PII
    const encryptedEmail = encryptionService.encrypt(userData.email.toLowerCase());
    const encryptedFirstName = encryptionService.encrypt(userData.firstName);
    const encryptedLastName = encryptionService.encrypt(userData.lastName);

    // Create user domain object
    const user: User = {
      userId,
      email: userData.email.toLowerCase(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      isActive: true,
      emailVerified: false,
      preferences: UserEntityMapper.getDefaultPreferences(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Convert to DynamoDB entity
    const entity = UserEntityMapper.toDynamoDBEntity(
      user,
      encryptedEmail,
      encryptedFirstName,
      encryptedLastName,
      hashedPassword
    );

    try {
      // Ensure user doesn't already exist
      await this.client.put(entity, 'attribute_not_exists(PK)');
      logger.info(`User created successfully: ${userId}`);
      return userId;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User already exists');
      }
      logger.error('Error creating user:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const pk = UserEntityMapper.createPK(userId);
      const sk = UserEntityMapper.createSK();
      
      const entity = await this.client.get(pk, sk);
      
      if (!entity || !UserEntityMapper.validateEntity(entity)) {
        return null;
      }

      // Decrypt PII
      const decryptedEmail = encryptionService.decrypt(entity.email);
      const decryptedFirstName = encryptionService.decrypt(entity.firstName);
      const decryptedLastName = encryptionService.decrypt(entity.lastName);

      return UserEntityMapper.fromDynamoDBEntity(
        entity,
        decryptedEmail,
        decryptedFirstName,
        decryptedLastName
      );
    } catch (error) {
      logger.error('Error getting user by ID:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get user by email (requires scanning - use sparingly)
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      // Hash email for consistent lookup (not used in current implementation)
      
      // Query all users and decrypt emails to find match
      // Note: This is inefficient and should be optimized with GSI in production
      const result = await this.client.query(
        'begins_with(PK, :pk)',
        { ':pk': 'USER#' }
      );

      for (const item of result.items) {
        if (UserEntityMapper.validateEntity(item)) {
          try {
            const decryptedEmail = encryptionService.decrypt(item.email);
            if (decryptedEmail.toLowerCase() === email.toLowerCase()) {
              const decryptedFirstName = encryptionService.decrypt(item.firstName);
              const decryptedLastName = encryptionService.decrypt(item.lastName);
              
              return UserEntityMapper.fromDynamoDBEntity(
                item,
                decryptedEmail,
                decryptedFirstName,
                decryptedLastName
              );
            }
          } catch (decryptError) {
            // Skip invalid encrypted data
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting user by email:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(
    userId: string,
    updates: Partial<Pick<User, 'firstName' | 'lastName' | 'preferences' | 'emailVerified'>>,
    currentVersion: number
  ): Promise<User> {
    try {
      const pk = UserEntityMapper.createPK(userId);
      const sk = UserEntityMapper.createSK();
      const now = new Date().toISOString();

      let updateExpression = 'SET updatedAt = :now, #version = #version + :inc';
      const expressionAttributeValues: any = {
        ':now': now,
        ':currentVersion': currentVersion,
        ':inc': 1,
      };
      const expressionAttributeNames: any = {
        '#version': 'version',
      };

      // Build update expression dynamically
      if (updates.firstName !== undefined) {
        const encryptedFirstName = encryptionService.encrypt(updates.firstName);
        updateExpression += ', firstName = :firstName';
        expressionAttributeValues[':firstName'] = encryptedFirstName;
      }

      if (updates.lastName !== undefined) {
        const encryptedLastName = encryptionService.encrypt(updates.lastName);
        updateExpression += ', lastName = :lastName';
        expressionAttributeValues[':lastName'] = encryptedLastName;
      }

      if (updates.preferences !== undefined) {
        updateExpression += ', preferences = :preferences';
        expressionAttributeValues[':preferences'] = updates.preferences;
      }

      if (updates.emailVerified !== undefined) {
        updateExpression += ', emailVerified = :emailVerified';
        expressionAttributeValues[':emailVerified'] = updates.emailVerified;
      }

      const updatedEntity = await this.client.update(
        pk,
        sk,
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames,
        '#version = :currentVersion'
      );

      if (!UserEntityMapper.validateEntity(updatedEntity)) {
        throw new Error('Invalid updated entity');
      }

      // Decrypt and return updated user
      const decryptedEmail = encryptionService.decrypt(updatedEntity.email);
      const decryptedFirstName = encryptionService.decrypt(updatedEntity.firstName);
      const decryptedLastName = encryptionService.decrypt(updatedEntity.lastName);

      return UserEntityMapper.fromDynamoDBEntity(
        updatedEntity,
        decryptedEmail,
        decryptedFirstName,
        decryptedLastName
      );
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User version mismatch - please refresh and try again');
      }
      logger.error('Error updating user:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string, currentVersion: number): Promise<void> {
    try {
      const pk = UserEntityMapper.createPK(userId);
      const sk = UserEntityMapper.createSK();
      const now = new Date().toISOString();

      await this.client.update(
        pk,
        sk,
        'SET isActive = :isActive, updatedAt = :now, #version = #version + :inc',
        {
          ':isActive': false,
          ':now': now,
          ':currentVersion': currentVersion,
          ':inc': 1,
        },
        { '#version': 'version' },
        '#version = :currentVersion'
      );

      logger.info(`User deactivated: ${userId}`);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User version mismatch - please refresh and try again');
      }
      logger.error('Error deactivating user:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Verify user password
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      const pk = UserEntityMapper.createPK(userId);
      const sk = UserEntityMapper.createSK();
      
      const entity = await this.client.get(pk, sk);
      
      if (!entity || !UserEntityMapper.validateEntity(entity)) {
        return false;
      }

      return await bcrypt.compare(password, entity.hashedPassword);
    } catch (error) {
      logger.error('Error verifying password:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string, currentVersion: number): Promise<void> {
    try {
      const pk = UserEntityMapper.createPK(userId);
      const sk = UserEntityMapper.createSK();
      const now = new Date().toISOString();
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await this.client.update(
        pk,
        sk,
        'SET hashedPassword = :hashedPassword, updatedAt = :now, #version = #version + :inc',
        {
          ':hashedPassword': hashedPassword,
          ':now': now,
          ':currentVersion': currentVersion,
          ':inc': 1,
        },
        { '#version': 'version' },
        '#version = :currentVersion'
      );

      logger.info(`Password updated for user: ${userId}`);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User version mismatch - please refresh and try again');
      }
      logger.error('Error updating password:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get user permissions based on role
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
   * Check if user has specific permission
   */
  hasPermission(
    userRole: UserRole,
    resource: string,
    action: string,
    conditions?: string[]
  ): boolean {
    const permissions = this.getUserPermissions(userRole);
    
    const permission = permissions.find(p => 
      p.resource === resource && p.action === action
    );
    
    if (!permission) {
      return false;
    }

    // If no conditions required, permission is granted
    if (!permission.conditions || permission.conditions.length === 0) {
      return true;
    }

    // If conditions are required but none provided, deny access
    if (!conditions || conditions.length === 0) {
      return false;
    }

    // Check if all required conditions are met
    return permission.conditions.every(condition => conditions.includes(condition));
  }

  /**
   * Validate user role
   */
  isValidRole(role: string): role is UserRole {
    return UserEntityMapper.isValidRole(role);
  }

  /**
   * Get users by role (for admin purposes)
   */
  async getUsersByRole(role: UserRole, limit: number = 50): Promise<User[]> {
    try {
      // This would require a GSI on role in production
      // For now, we'll scan and filter (inefficient but functional)
      const result = await this.client.query(
        'begins_with(PK, :pk)',
        { ':pk': 'USER#' },
        undefined,
        undefined,
        undefined,
        limit
      );

      const users: User[] = [];
      
      for (const item of result.items) {
        if (UserEntityMapper.validateEntity(item) && item.role === role) {
          try {
            const decryptedEmail = encryptionService.decrypt(item.email);
            const decryptedFirstName = encryptionService.decrypt(item.firstName);
            const decryptedLastName = encryptionService.decrypt(item.lastName);
            
            users.push(UserEntityMapper.fromDynamoDBEntity(
              item,
              decryptedEmail,
              decryptedFirstName,
              decryptedLastName
            ));
          } catch (decryptError) {
            // Skip invalid encrypted data
            continue;
          }
        }
      }

      return users;
    } catch (error) {
      logger.error('Error getting users by role:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

// Singleton instance
export const userDAO = new UserDAO();