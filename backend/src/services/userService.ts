/**
 * User service for managing user data
 */

import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment';
import { hashPassword, verifyPassword } from '../utils/auth';

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
  const userId = uuidv4();
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

  // Check if user already exists
  const existingUser = await getUserByEmail(userData.email);
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Save to DynamoDB
  await dynamodb.put({
    TableName: config.database.tableName,
    Item: {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      entityType: 'USER',
      ...user,
    },
    ConditionExpression: 'attribute_not_exists(PK)',
  }).promise();

  return user;
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    // Since we don't have a GSI for email, we'll need to scan
    // In production, you'd want to create a GSI for email lookups
    const result = await dynamodb.scan({
      TableName: config.database.tableName,
      FilterExpression: 'entityType = :entityType AND email = :email',
      ExpressionAttributeValues: {
        ':entityType': 'USER',
        ':email': email.toLowerCase(),
      },
    }).promise();

    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as User;
    }

    return null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const result = await dynamodb.get({
      TableName: config.database.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    }).promise();

    if (result.Item) {
      return result.Item as User;
    }

    return null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
};

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (credentials: LoginCredentials): Promise<User | null> => {
  const user = await getUserByEmail(credentials.email);
  
  if (!user) {
    return null;
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  const isPasswordValid = await verifyPassword(credentials.password, user.hashedPassword);
  
  if (!isPasswordValid) {
    return null;
  }

  return user;
};

/**
 * Update user's last login time
 */
export const updateLastLogin = async (userId: string): Promise<void> => {
  try {
    await dynamodb.update({
      TableName: config.database.tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET lastLoginAt = :now, updatedAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
      },
    }).promise();
  } catch (error) {
    console.error('Error updating last login:', error);
    // Don't throw error as this is not critical
  }
};