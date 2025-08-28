"use strict";
/**
 * User Data Access Object with CRUD operations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.userDAO = exports.UserDAO = void 0;
const uuid_1 = require("uuid");
const bcrypt = __importStar(require("bcryptjs"));
const dynamodb_client_1 = require("../dynamodb-client");
const user_entity_1 = require("../entities/user-entity");
const encryption_1 = require("../../utils/encryption");
const logger_1 = require("../../utils/logger");
class UserDAO {
    constructor() {
        this.client = dynamodb_client_1.dynamoDBClient;
    }
    /**
     * Create a new user
     */
    async createUser(userData) {
        const userId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        // Encrypt PII
        const encryptedEmail = encryption_1.encryptionService.encrypt(userData.email.toLowerCase());
        const encryptedFirstName = encryption_1.encryptionService.encrypt(userData.firstName);
        const encryptedLastName = encryption_1.encryptionService.encrypt(userData.lastName);
        // Create user domain object
        const user = {
            userId,
            email: userData.email.toLowerCase(),
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            isActive: true,
            emailVerified: false,
            preferences: user_entity_1.UserEntityMapper.getDefaultPreferences(),
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        // Convert to DynamoDB entity
        const entity = user_entity_1.UserEntityMapper.toDynamoDBEntity(user, encryptedEmail, encryptedFirstName, encryptedLastName, hashedPassword);
        try {
            // Ensure user doesn't already exist
            await this.client.put(entity, 'attribute_not_exists(PK)');
            logger_1.logger.info(`User created successfully: ${userId}`);
            return userId;
        }
        catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                throw new Error('User already exists');
            }
            logger_1.logger.error('Error creating user:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        try {
            const pk = user_entity_1.UserEntityMapper.createPK(userId);
            const sk = user_entity_1.UserEntityMapper.createSK();
            const entity = await this.client.get(pk, sk);
            if (!entity || !user_entity_1.UserEntityMapper.validateEntity(entity)) {
                return null;
            }
            // Decrypt PII
            const decryptedEmail = encryption_1.encryptionService.decrypt(entity.email);
            const decryptedFirstName = encryption_1.encryptionService.decrypt(entity.firstName);
            const decryptedLastName = encryption_1.encryptionService.decrypt(entity.lastName);
            return user_entity_1.UserEntityMapper.fromDynamoDBEntity(entity, decryptedEmail, decryptedFirstName, decryptedLastName);
        }
        catch (error) {
            logger_1.logger.error('Error getting user by ID:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Get user by email (requires scanning - use sparingly)
     */
    async getUserByEmail(email) {
        try {
            // Scan all user records and decrypt emails to find match
            // Note: This is inefficient and should be optimized with GSI in production
            const result = await this.client.scan('begins_with(PK, :pk)', { ':pk': 'USER#' });
            // If no users found, return null
            if (!result.items || result.items.length === 0) {
                logger_1.logger.debug('No users found in database');
                return null;
            }
            for (const item of result.items) {
                if (user_entity_1.UserEntityMapper.validateEntity(item)) {
                    try {
                        // Validate that encrypted fields exist and are properly structured
                        if (!encryption_1.encryptionService.isValidEncryptedData(item.email) ||
                            !encryption_1.encryptionService.isValidEncryptedData(item.firstName) ||
                            !encryption_1.encryptionService.isValidEncryptedData(item.lastName)) {
                            logger_1.logger.warn(`Invalid encrypted data structure for user ${item.userId}`);
                            continue;
                        }
                        const decryptedEmail = encryption_1.encryptionService.decrypt(item.email);
                        if (decryptedEmail.toLowerCase() === email.toLowerCase()) {
                            const decryptedFirstName = encryption_1.encryptionService.decrypt(item.firstName);
                            const decryptedLastName = encryption_1.encryptionService.decrypt(item.lastName);
                            return user_entity_1.UserEntityMapper.fromDynamoDBEntity(item, decryptedEmail, decryptedFirstName, decryptedLastName);
                        }
                    }
                    catch (decryptError) {
                        logger_1.logger.warn(`Failed to decrypt user data for ${item.userId}: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`);
                        // Skip invalid encrypted data
                        continue;
                    }
                }
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting user by email:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Update user profile
     */
    async updateUser(userId, updates, currentVersion) {
        try {
            const pk = user_entity_1.UserEntityMapper.createPK(userId);
            const sk = user_entity_1.UserEntityMapper.createSK();
            const now = new Date().toISOString();
            let updateExpression = 'SET updatedAt = :now, #version = #version + :inc';
            const expressionAttributeValues = {
                ':now': now,
                ':currentVersion': currentVersion,
                ':inc': 1,
            };
            const expressionAttributeNames = {
                '#version': 'version',
            };
            // Build update expression dynamically
            if (updates.firstName !== undefined) {
                const encryptedFirstName = encryption_1.encryptionService.encrypt(updates.firstName);
                updateExpression += ', firstName = :firstName';
                expressionAttributeValues[':firstName'] = encryptedFirstName;
            }
            if (updates.lastName !== undefined) {
                const encryptedLastName = encryption_1.encryptionService.encrypt(updates.lastName);
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
            const updatedEntity = await this.client.update(pk, sk, updateExpression, expressionAttributeValues, expressionAttributeNames, '#version = :currentVersion');
            if (!user_entity_1.UserEntityMapper.validateEntity(updatedEntity)) {
                throw new Error('Invalid updated entity');
            }
            // Decrypt and return updated user
            const decryptedEmail = encryption_1.encryptionService.decrypt(updatedEntity.email);
            const decryptedFirstName = encryption_1.encryptionService.decrypt(updatedEntity.firstName);
            const decryptedLastName = encryption_1.encryptionService.decrypt(updatedEntity.lastName);
            return user_entity_1.UserEntityMapper.fromDynamoDBEntity(updatedEntity, decryptedEmail, decryptedFirstName, decryptedLastName);
        }
        catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                throw new Error('User version mismatch - please refresh and try again');
            }
            logger_1.logger.error('Error updating user:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Deactivate user (soft delete)
     */
    async deactivateUser(userId, currentVersion) {
        try {
            const pk = user_entity_1.UserEntityMapper.createPK(userId);
            const sk = user_entity_1.UserEntityMapper.createSK();
            const now = new Date().toISOString();
            await this.client.update(pk, sk, 'SET isActive = :isActive, updatedAt = :now, #version = #version + :inc', {
                ':isActive': false,
                ':now': now,
                ':currentVersion': currentVersion,
                ':inc': 1,
            }, { '#version': 'version' }, '#version = :currentVersion');
            logger_1.logger.info(`User deactivated: ${userId}`);
        }
        catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                throw new Error('User version mismatch - please refresh and try again');
            }
            logger_1.logger.error('Error deactivating user:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Verify user password
     */
    async verifyPassword(userId, password) {
        try {
            const pk = user_entity_1.UserEntityMapper.createPK(userId);
            const sk = user_entity_1.UserEntityMapper.createSK();
            const entity = await this.client.get(pk, sk);
            if (!entity || !user_entity_1.UserEntityMapper.validateEntity(entity)) {
                return false;
            }
            return await bcrypt.compare(password, entity.hashedPassword);
        }
        catch (error) {
            logger_1.logger.error('Error verifying password:', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    /**
     * Update user password
     */
    async updatePassword(userId, newPassword, currentVersion) {
        try {
            const pk = user_entity_1.UserEntityMapper.createPK(userId);
            const sk = user_entity_1.UserEntityMapper.createSK();
            const now = new Date().toISOString();
            const hashedPassword = await bcrypt.hash(newPassword, 12);
            await this.client.update(pk, sk, 'SET hashedPassword = :hashedPassword, updatedAt = :now, #version = #version + :inc', {
                ':hashedPassword': hashedPassword,
                ':now': now,
                ':currentVersion': currentVersion,
                ':inc': 1,
            }, { '#version': 'version' }, '#version = :currentVersion');
            logger_1.logger.info(`Password updated for user: ${userId}`);
        }
        catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                throw new Error('User version mismatch - please refresh and try again');
            }
            logger_1.logger.error('Error updating password:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Get user permissions based on role
     */
    getUserPermissions(role) {
        const permissions = user_entity_1.USER_ROLE_PERMISSIONS[role] || [];
        return permissions.map(p => {
            const permission = {
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
    hasPermission(userRole, resource, action, conditions) {
        const permissions = this.getUserPermissions(userRole);
        const permission = permissions.find(p => p.resource === resource && p.action === action);
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
    isValidRole(role) {
        return user_entity_1.UserEntityMapper.isValidRole(role);
    }
    /**
     * Get users by role (for admin purposes)
     */
    async getUsersByRole(role, limit = 50) {
        try {
            // This would require a GSI on role in production
            // For now, we'll scan and filter (inefficient but functional)
            const result = await this.client.scan('begins_with(PK, :pk) AND #role = :role', {
                ':pk': 'USER#',
                ':role': role
            }, undefined, { '#role': 'role' }, limit);
            const users = [];
            for (const item of result.items) {
                if (user_entity_1.UserEntityMapper.validateEntity(item)) {
                    try {
                        const decryptedEmail = encryption_1.encryptionService.decrypt(item.email);
                        const decryptedFirstName = encryption_1.encryptionService.decrypt(item.firstName);
                        const decryptedLastName = encryption_1.encryptionService.decrypt(item.lastName);
                        users.push(user_entity_1.UserEntityMapper.fromDynamoDBEntity(item, decryptedEmail, decryptedFirstName, decryptedLastName));
                    }
                    catch (decryptError) {
                        // Skip invalid encrypted data
                        continue;
                    }
                }
            }
            return users;
        }
        catch (error) {
            logger_1.logger.error('Error getting users by role:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
}
exports.UserDAO = UserDAO;
// Singleton instance
exports.userDAO = new UserDAO();
