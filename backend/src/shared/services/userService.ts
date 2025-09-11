/**
 * User service for managing user data with comprehensive logging
 */

import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment';
import { hashPassword, verifyPassword } from '../utils/auth';
import { logger } from '../utils/logger';

// Configure DynamoDB
const dynamoConfig: any = {
  region: config.aws.region,
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
};

if (config.database.endpoint) {
  dynamoConfig.endpoint = config.database.endpoint;
}

const dynamodb = new AWS.DynamoDB.DocumentClient(dynamoConfig);

export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';
  isActive: boolean;
  emailVerified: boolean;
  hashedPassword: string;
  preferences: {
    notifications: boolean;
    theme: 'light' | 'dark';
    language: string;
  };
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Create a new user
 */
export const createUser = async (userData: CreateUserData): Promise<User> => {
  const correlationId = uuidv4();
  const userId = uuidv4();
  
  logger.functionEntry('createUser', userData, { correlationId, userId });
  
  try {
    logger.info('🆕 Starting user creation process', {
      correlationId,
      userId,
      email: userData.email,
      role: userData.role,
      operation: 'USER_CREATE_START',
    });

    // Check if user already exists
    logger.debug('Checking for existing user', {
      correlationId,
      userId,
      email: userData.email,
      operation: 'USER_DUPLICATE_CHECK',
    });
    
    const existingUser = await getUserByEmail(userData.email);
    if (existingUser) {
      logger.warn('User creation failed - email already exists', {
        correlationId,
        userId,
        email: userData.email,
        existingUserId: existingUser.userId,
        operation: 'USER_CREATE_DUPLICATE',
      });
      throw new Error('User with this email already exists');
    }

    logger.debug('No existing user found, proceeding with creation', {
      correlationId,
      userId,
      operation: 'USER_CREATE_PROCEED',
    });

    // Hash password
    logger.debug('Hashing user password', {
      correlationId,
      userId,
      operation: 'USER_PASSWORD_HASH',
    });
    
    const hashedPassword = await hashPassword(userData.password);
    const now = new Date().toISOString();

    const user: User = {
      userId,
      email: userData.email.toLowerCase(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      isActive: true,
      emailVerified: true, // Auto-verify for development
      hashedPassword,
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en',
      },
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    logger.debug('User object created, saving to database', {
      correlationId,
      userId,
      email: user.email,
      role: user.role,
      operation: 'USER_DB_SAVE',
    });

    // Save to DynamoDB
    const dbItem = {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      entityType: 'USER',
      ...user,
    };

    logger.dbOperation('PUT', config.database.tableName, { PK: dbItem.PK, SK: dbItem.SK }, {
      correlationId,
      userId,
    });

    const startTime = Date.now();
    await dynamodb.put({
      TableName: config.database.tableName,
      Item: dbItem,
      ConditionExpression: 'attribute_not_exists(PK)',
    }).promise();
    const duration = Date.now() - startTime;

    logger.performance('User saved to database', {
      correlationId,
      userId,
      duration,
      operation: 'USER_DB_SAVE',
    });

    logger.stateChange('USER', 'NON_EXISTENT', 'CREATED', {
      correlationId,
      userId,
      email: user.email,
      role: user.role,
    });

    logger.audit('User account created successfully', {
      correlationId,
      userId,
      email: user.email,
      role: user.role,
      operation: 'USER_CREATE_SUCCESS',
    });

    logger.functionExit('createUser', user, { correlationId, userId });
    return user;
  } catch (error) {
    logger.error('User creation failed', error as Error, {
      correlationId,
      userId,
      email: userData.email,
      operation: 'USER_CREATE_ERROR',
    });
    throw error;
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const correlationId = uuidv4();
  logger.functionEntry('getUserByEmail', { email }, { correlationId });
  
  try {
    logger.debug('🔍 Searching for user by email', {
      correlationId,
      email,
      operation: 'USER_LOOKUP_EMAIL',
    });

    logger.dbOperation('SCAN', config.database.tableName, { email }, { correlationId });

    // Since we don't have a GSI for email, we'll need to scan
    // In production, you'd want to create a GSI for email lookups
    const startTime = Date.now();
    const result = await dynamodb.scan({
      TableName: config.database.tableName,
      FilterExpression: 'entityType = :entityType AND email = :email',
      ExpressionAttributeValues: {
        ':entityType': 'USER',
        ':email': email.toLowerCase(),
      },
    }).promise();
    const duration = Date.now() - startTime;

    logger.performance('User email lookup completed', {
      correlationId,
      duration,
      scannedCount: result.ScannedCount,
      itemCount: result.Count,
      operation: 'USER_LOOKUP_EMAIL',
    });

    if (result.Items && result.Items.length > 0) {
      const user = result.Items[0] as User;
      logger.info('User found by email', {
        correlationId,
        userId: user.userId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        operation: 'USER_LOOKUP_EMAIL_FOUND',
      });
      
      logger.functionExit('getUserByEmail', user, { correlationId });
      return user;
    }

    logger.debug('No user found with email', {
      correlationId,
      email,
      operation: 'USER_LOOKUP_EMAIL_NOT_FOUND',
    });

    logger.functionExit('getUserByEmail', null, { correlationId });
    return null;
  } catch (error) {
    logger.error('Error getting user by email', error as Error, {
      correlationId,
      email,
      operation: 'USER_LOOKUP_EMAIL_ERROR',
    });
    return null;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  const correlationId = uuidv4();
  logger.functionEntry('getUserById', { userId }, { correlationId });
  
  try {
    logger.debug('🔍 Searching for user by ID', {
      correlationId,
      userId,
      operation: 'USER_LOOKUP_ID',
    });

    const key = {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    };

    logger.dbOperation('GET', config.database.tableName, key, { correlationId, userId });

    const startTime = Date.now();
    const result = await dynamodb.get({
      TableName: config.database.tableName,
      Key: key,
    }).promise();
    const duration = Date.now() - startTime;

    logger.performance('User ID lookup completed', {
      correlationId,
      userId,
      duration,
      found: !!result.Item,
      operation: 'USER_LOOKUP_ID',
    });

    if (result.Item) {
      const user = result.Item as User;
      logger.info('User found by ID', {
        correlationId,
        userId: user.userId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        operation: 'USER_LOOKUP_ID_FOUND',
      });
      
      logger.functionExit('getUserById', user, { correlationId });
      return user;
    }

    logger.debug('No user found with ID', {
      correlationId,
      userId,
      operation: 'USER_LOOKUP_ID_NOT_FOUND',
    });

    logger.functionExit('getUserById', null, { correlationId });
    return null;
  } catch (error) {
    logger.error('Error getting user by ID', error as Error, {
      correlationId,
      userId,
      operation: 'USER_LOOKUP_ID_ERROR',
    });
    return null;
  }
};

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (credentials: LoginCredentials): Promise<User | null> => {
  const correlationId = uuidv4();
  logger.functionEntry('authenticateUser', { email: credentials.email }, { correlationId });
  
  try {
    logger.info('🔐 Starting user authentication', {
      correlationId,
      email: credentials.email,
      operation: 'USER_AUTH_START',
    });

    // Get user by email
    logger.debug('Looking up user for authentication', {
      correlationId,
      email: credentials.email,
      operation: 'USER_AUTH_LOOKUP',
    });
    
    const user = await getUserByEmail(credentials.email);
    
    if (!user) {
      logger.security('Authentication failed - user not found', {
        correlationId,
        email: credentials.email,
        operation: 'USER_AUTH_USER_NOT_FOUND',
      });
      logger.functionExit('authenticateUser', null, { correlationId });
      return null;
    }

    logger.debug('User found, checking account status', {
      correlationId,
      userId: user.userId,
      email: user.email,
      isActive: user.isActive,
      operation: 'USER_AUTH_STATUS_CHECK',
    });

    if (!user.isActive) {
      logger.security('Authentication failed - account deactivated', {
        correlationId,
        userId: user.userId,
        email: user.email,
        operation: 'USER_AUTH_ACCOUNT_DEACTIVATED',
      });
      throw new Error('Account is deactivated');
    }

    logger.debug('Account is active, verifying password', {
      correlationId,
      userId: user.userId,
      operation: 'USER_AUTH_PASSWORD_VERIFY',
    });

    const isPasswordValid = await verifyPassword(credentials.password, user.hashedPassword);
    
    if (!isPasswordValid) {
      logger.security('Authentication failed - invalid password', {
        correlationId,
        userId: user.userId,
        email: user.email,
        operation: 'USER_AUTH_INVALID_PASSWORD',
      });
      logger.functionExit('authenticateUser', null, { correlationId });
      return null;
    }

    logger.security('User authentication successful', {
      correlationId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      operation: 'USER_AUTH_SUCCESS',
    });

    logger.audit('User successfully authenticated', {
      correlationId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      operation: 'USER_AUTH_SUCCESS',
    });

    logger.functionExit('authenticateUser', user, { correlationId });
    return user;
  } catch (error) {
    logger.error('User authentication error', error as Error, {
      correlationId,
      email: credentials.email,
      operation: 'USER_AUTH_ERROR',
    });
    throw error;
  }
};

/**
 * Update user's last login time
 */
export const updateLastLogin = async (userId: string): Promise<void> => {
  const correlationId = uuidv4();
  logger.functionEntry('updateLastLogin', { userId }, { correlationId });
  
  try {
    const now = new Date().toISOString();
    
    logger.debug('📝 Updating user last login time', {
      correlationId,
      userId,
      timestamp: now,
      operation: 'USER_LAST_LOGIN_UPDATE',
    });

    const key = {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    };

    logger.dbOperation('UPDATE', config.database.tableName, key, { correlationId, userId });

    const startTime = Date.now();
    await dynamodb.update({
      TableName: config.database.tableName,
      Key: key,
      UpdateExpression: 'SET lastLoginAt = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':now': now,
      },
    }).promise();
    const duration = Date.now() - startTime;

    logger.performance('Last login time updated', {
      correlationId,
      userId,
      duration,
      operation: 'USER_LAST_LOGIN_UPDATE',
    });

    logger.stateChange('USER_LAST_LOGIN', 'PREVIOUS_TIME', now, {
      correlationId,
      userId,
    });

    logger.audit('User last login time updated', {
      correlationId,
      userId,
      timestamp: now,
      operation: 'USER_LAST_LOGIN_UPDATE_SUCCESS',
    });

    logger.functionExit('updateLastLogin', undefined, { correlationId });
  } catch (error) {
    logger.error('Error updating last login', error as Error, {
      correlationId,
      userId,
      operation: 'USER_LAST_LOGIN_UPDATE_ERROR',
    });
    // Don't throw error as this is not critical
  }
};