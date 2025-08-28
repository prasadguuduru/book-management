/**
 * Enhanced Authentication Service with Role Management
 * Implements JWT-based authentication with role-based access control
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { userDAO } from '../data/dao/user-dao';
import { generateTokenPair, verifyToken } from '../utils/auth';
import { logger } from '../utils/logger';
import { getCorsHeaders } from '../utils/cors';
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  User, 
  UserRole
} from '../types';

// JWT Payload interface for this service
interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// CORS headers are now handled by the cors utility

// Mock development users for easy testing
const MOCK_USERS = {
  'author@test.com': { password: 'password123', role: 'AUTHOR' as UserRole },
  'editor@test.com': { password: 'password123', role: 'EDITOR' as UserRole },
  'publisher@test.com': { password: 'password123', role: 'PUBLISHER' as UserRole },
  'reader@test.com': { password: 'password123', role: 'READER' as UserRole },
  'author1@example.com': { password: 'password123', role: 'AUTHOR' as UserRole },
  'author2@example.com': { password: 'password123', role: 'AUTHOR' as UserRole },
  'editor1@example.com': { password: 'password123', role: 'EDITOR' as UserRole },
  'publisher1@example.com': { password: 'password123', role: 'PUBLISHER' as UserRole },
  'reader1@example.com': { password: 'password123', role: 'READER' as UserRole },
  'reader2@example.com': { password: 'password123', role: 'READER' as UserRole },
};

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = context.awsRequestId;
  
  logger.functionEntry('auth-service-handler', {
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters
  }, { correlationId });

  try {
    const httpMethod = event.httpMethod;
    const path = event.path || '';

    // Enhanced logging for debugging
    logger.info('Processing request', {
      httpMethod,
      path,
      headers: event.headers,
      queryStringParameters: event.queryStringParameters,
      pathParameters: event.pathParameters,
      correlationId
    });

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS') {
      logger.info('Handling CORS preflight request', { correlationId });
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Route requests based on path and method
    if (path.includes('/health')) {
      logger.info('Routing to health check', { path, correlationId });
      return await handleHealthCheck(correlationId);
    } else if (path.includes('/login') && httpMethod === 'POST') {
      logger.info('Routing to login', { path, correlationId });
      return await handleLogin(event, correlationId);
    } else if (path.includes('/register') && httpMethod === 'POST') {
      logger.info('Routing to register', { path, correlationId });
      return await handleRegister(event, correlationId);
    } else if (path.includes('/refresh') && httpMethod === 'POST') {
      logger.info('Routing to refresh token', { path, correlationId });
      return await handleRefreshToken(event, correlationId);
    } else if (path.includes('/profile') && httpMethod === 'GET') {
      logger.info('Routing to get profile', { path, correlationId });
      return await handleGetProfile(event, correlationId);
    } else if (path.includes('/profile') && httpMethod === 'PUT') {
      logger.info('Routing to update profile', { path, correlationId });
      return await handleUpdateProfile(event, correlationId);
    } else if (path.includes('/logout') && httpMethod === 'POST') {
      logger.info('Routing to logout', { path, correlationId });
      return await handleLogout(event, correlationId);
    } else if (path.includes('/validate') && httpMethod === 'POST') {
      logger.info('Routing to validate token', { path, correlationId });
      return await handleValidateToken(event, correlationId);
    } else if ((path === '/api/auth' || path.endsWith('/auth')) && httpMethod === 'POST') {
      logger.info('Routing POST /api/auth to login (frontend compatibility)', { path, correlationId });
      return await handleLogin(event, correlationId);
    } else if (path === '/api/auth' || path.endsWith('/auth')) {
      logger.info('Routing to auth service info', { path, correlationId });
      return handleAuthServiceInfo();
    } else {
      logger.warn('No matching route found', { httpMethod, path, correlationId });
      return createErrorResponse(404, 'NOT_FOUND', `Endpoint not found: ${httpMethod} ${path}`);
    }

  } catch (error) {
    logger.error('Unhandled error in auth service', error as Error, { correlationId });
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
};

/**
 * Health check endpoint with DynamoDB diagnostics
 */
const handleHealthCheck = async (correlationId: string): Promise<APIGatewayProxyResult> => {
  logger.info('Starting health check', { correlationId });
  
  const healthData: any = {
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development',
    version: '2.0.0',
    features: {
      registration: true,
      mockLogin: true,
      jwtTokens: true,
      roleBasedAuth: true,
      profileManagement: true
    },
    diagnostics: {
      tableName: process.env['TABLE_NAME'] || 'not-set',
      region: process.env['AWS_REGION'] || 'not-set'
    }
  };

  // Test DynamoDB connection and check for existing users
  try {
    logger.info('Testing DynamoDB connection', { 
      tableName: healthData.diagnostics.tableName,
      correlationId 
    });

    // Try to get users by role to verify table access
    const authorUsers = await userDAO.getUsersByRole('AUTHOR', 5);
    const readerUsers = await userDAO.getUsersByRole('READER', 5);
    
    healthData.diagnostics.dynamodb = {
      status: 'connected',
      authorCount: authorUsers.length,
      readerCount: readerUsers.length,
      sampleUsers: [...authorUsers, ...readerUsers].slice(0, 5).map(user => ({
        userId: user.userId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }))
    };

    logger.info('DynamoDB diagnostics completed', {
      authorCount: authorUsers.length,
      readerCount: readerUsers.length,
      correlationId
    });

  } catch (error) {
    logger.error('DynamoDB connection test failed', error as Error, { correlationId });
    
    healthData.diagnostics.dynamodb = {
      status: 'error',
      error: (error as Error).message
    };
    
    // Still return healthy status but with error details
    healthData.status = 'degraded';
  }

  logger.info('Health check completed', { 
    status: healthData.status,
    diagnostics: healthData.diagnostics,
    correlationId 
  });

  return createResponse(200, healthData);
};

/**
 * Auth service info endpoint - shows available endpoints
 */
const handleAuthServiceInfo = (): APIGatewayProxyResult => {
  return createResponse(200, {
    service: 'auth-service',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development',
    endpoints: {
      'GET /health': 'Health check endpoint',
      'POST /login': 'User login with email/password',
      'POST /register': 'User registration',
      'POST /refresh': 'Refresh JWT token',
      'GET /profile': 'Get user profile (requires auth)',
      'PUT /profile': 'Update user profile (requires auth)',
      'POST /logout': 'User logout (requires auth)',
      'POST /validate': 'Validate JWT token'
    },
    usage: {
      baseUrl: 'https://d2xg2iv1qaydac.cloudfront.net/api/auth',
      examples: {
        health: 'GET /api/auth/health',
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register'
      }
    }
  });
};

/**
 * Handle user login
 */
const handleLogin = async (
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'MISSING_BODY', 'Request body is required');
    }

    const loginRequest: LoginRequest = JSON.parse(event.body);
    
    // Validate input
    if (!loginRequest.email || !loginRequest.password) {
      return createErrorResponse(400, 'MISSING_CREDENTIALS', 'Email and password are required');
    }

    logger.info('Login attempt', { 
      email: loginRequest.email,
      correlationId 
    });

    // Log environment info for debugging
    logger.info('Environment info', {
      tableName: process.env['TABLE_NAME'],
      nodeEnv: process.env['NODE_ENV'],
      region: process.env['AWS_REGION'],
      correlationId
    });

    // Check if this is a mock user for development
    const mockUser = MOCK_USERS[loginRequest.email.toLowerCase() as keyof typeof MOCK_USERS];
    if (mockUser && mockUser.password === loginRequest.password) {
      logger.info('Mock user login successful', { 
        email: loginRequest.email,
        role: mockUser.role,
        correlationId 
      });

      // Try to get existing user from database first
      let user: Omit<User, 'version'> | null = null;
      
      try {
        const existingUser = await userDAO.getUserByEmail(loginRequest.email.toLowerCase());
        if (existingUser) {
          logger.info('Found existing seeded user', { 
            userId: existingUser.userId,
            email: existingUser.email,
            correlationId 
          });
          user = existingUser;
        }
      } catch (error) {
        logger.warn('Could not fetch existing user, will create mock user', { 
          email: loginRequest.email,
          error: error instanceof Error ? error.message : String(error),
          correlationId 
        });
      }

      // If no existing user found, create a mock user object
      if (!user) {
        logger.info('Creating new mock user', { email: loginRequest.email, correlationId });
        user = {
          userId: `mock-${mockUser.role.toLowerCase()}-${Date.now()}`,
          email: loginRequest.email.toLowerCase(),
          firstName: mockUser.role.charAt(0) + mockUser.role.slice(1).toLowerCase(),
          lastName: 'User',
          role: mockUser.role,
          isActive: true,
          emailVerified: true,
          preferences: {
            notifications: true,
            theme: 'light',
            language: 'en'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Generate JWT tokens
      const jwtPayload: JWTPayload = {
        userId: user.userId,
        email: user.email,
        role: user.role
      };

      const tokens = generateTokenPair(jwtPayload);

      const response: LoginResponse = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user
      };

      logger.security('Mock login successful', {
        userId: user.userId,
        email: user.email,
        role: user.role,
        correlationId
      });

      return createResponse(200, response);
    }

    // Try to authenticate with real user data
    const user = await userDAO.getUserByEmail(loginRequest.email);
    
    if (!user) {
      logger.security('Login failed - user not found', { 
        email: loginRequest.email,
        correlationId 
      });
      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.isActive) {
      logger.security('Login failed - user inactive', { 
        userId: user.userId,
        email: loginRequest.email,
        correlationId 
      });
      return createErrorResponse(401, 'ACCOUNT_INACTIVE', 'Account is inactive');
    }

    // Verify password
    const isPasswordValid = await userDAO.verifyPassword(user.userId, loginRequest.password);
    
    if (!isPasswordValid) {
      logger.security('Login failed - invalid password', { 
        userId: user.userId,
        email: loginRequest.email,
        correlationId 
      });
      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate JWT tokens
    const jwtPayload: JWTPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role
    };

    const tokens = generateTokenPair(jwtPayload);

    // Remove version from user object for response
    const { version, ...userResponse } = user;

    const response: LoginResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResponse
    };

    logger.security('Login successful', {
      userId: user.userId,
      email: user.email,
      role: user.role,
      correlationId
    });

    return createResponse(200, response);

  } catch (error) {
    logger.error('Login error', error as Error, { correlationId });
    return createErrorResponse(500, 'LOGIN_ERROR', 'Login failed due to server error');
  }
};

/**
 * Handle user registration
 */
const handleRegister = async (
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'MISSING_BODY', 'Request body is required');
    }

    const registerRequest: RegisterRequest = JSON.parse(event.body);
    
    // Validate input
    const validation = validateRegistrationRequest(registerRequest);
    if (!validation.valid) {
      return createErrorResponse(400, 'VALIDATION_FAILED', 'Registration validation failed', validation.errors);
    }

    logger.info('Registration attempt', { 
      email: registerRequest.email,
      role: registerRequest.role,
      correlationId 
    });

    // Check if user already exists
    const existingUser = await userDAO.getUserByEmail(registerRequest.email);
    if (existingUser) {
      logger.security('Registration failed - user already exists', { 
        email: registerRequest.email,
        correlationId 
      });
      return createErrorResponse(409, 'USER_EXISTS', 'User with this email already exists');
    }

    // Create new user
    const userId = await userDAO.createUser(registerRequest);
    
    // Get the created user
    const newUser = await userDAO.getUserById(userId);
    if (!newUser) {
      throw new Error('Failed to retrieve created user');
    }

    // Generate JWT tokens
    const jwtPayload: JWTPayload = {
      userId: newUser.userId,
      email: newUser.email,
      role: newUser.role
    };

    const tokens = generateTokenPair(jwtPayload);

    // Remove version from user object for response
    const { version, ...userResponse } = newUser;

    const response: LoginResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResponse
    };

    logger.security('Registration successful', {
      userId: newUser.userId,
      email: newUser.email,
      role: newUser.role,
      correlationId
    });

    return createResponse(201, response);

  } catch (error) {
    logger.error('Registration error', error as Error, { correlationId });
    
    if ((error as Error).message === 'User already exists') {
      return createErrorResponse(409, 'USER_EXISTS', 'User with this email already exists');
    }
    
    return createErrorResponse(500, 'REGISTRATION_ERROR', 'Registration failed due to server error');
  }
};

/**
 * Handle token refresh
 */
const handleRefreshToken = async (
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'MISSING_BODY', 'Request body is required');
    }

    const { refreshToken } = JSON.parse(event.body);
    
    if (!refreshToken) {
      return createErrorResponse(400, 'MISSING_REFRESH_TOKEN', 'Refresh token is required');
    }

    // Verify refresh token
    const payload = verifyToken(refreshToken);
    
    // Get current user data
    const user = await userDAO.getUserById(payload.userId);
    if (!user || !user.isActive) {
      return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    // Generate new token pair
    const jwtPayload: JWTPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role
    };

    const tokens = generateTokenPair(jwtPayload);

    logger.security('Token refresh successful', {
      userId: user.userId,
      correlationId
    });

    return createResponse(200, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });

  } catch (error) {
    logger.error('Token refresh error', error as Error, { correlationId });
    return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
  }
};

/**
 * Handle get user profile
 */
const handleGetProfile = async (
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    const authResult = await authenticateRequest(event);
    if (!authResult.success || !authResult.userId) {
      return authResult.response!;
    }

    const user = await userDAO.getUserById(authResult.userId);
    if (!user) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Remove sensitive information
    const { version, ...userProfile } = user;

    logger.info('Profile retrieved', {
      userId: user.userId,
      correlationId
    });

    return createResponse(200, { user: userProfile });

  } catch (error) {
    logger.error('Get profile error', error as Error, { correlationId });
    return createErrorResponse(500, 'PROFILE_ERROR', 'Failed to retrieve profile');
  }
};

/**
 * Handle update user profile
 */
const handleUpdateProfile = async (
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    const authResult = await authenticateRequest(event);
    if (!authResult.success || !authResult.userId) {
      return authResult.response!;
    }

    if (!event.body) {
      return createErrorResponse(400, 'MISSING_BODY', 'Request body is required');
    }

    const updates = JSON.parse(event.body);
    const { version, ...allowedUpdates } = updates;

    // Validate allowed fields
    const validFields = ['firstName', 'lastName', 'preferences', 'emailVerified'];
    const updateFields = Object.keys(allowedUpdates).filter(key => validFields.includes(key));
    
    if (updateFields.length === 0) {
      return createErrorResponse(400, 'NO_VALID_FIELDS', 'No valid fields to update');
    }

    const filteredUpdates = Object.fromEntries(
      updateFields.map(key => [key, allowedUpdates[key]])
    );

    // Get current user to get version
    const currentUser = await userDAO.getUserById(authResult.userId);
    if (!currentUser) {
      return createErrorResponse(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Update user
    const updatedUser = await userDAO.updateUser(
      authResult.userId,
      filteredUpdates,
      currentUser.version
    );

    // Remove version from response
    const { version: _, ...userResponse } = updatedUser;

    logger.info('Profile updated', {
      userId: authResult.userId!,
      updatedFields: updateFields,
      correlationId
    });

    return createResponse(200, { user: userResponse });

  } catch (error) {
    logger.error('Update profile error', error as Error, { correlationId });
    
    if ((error as Error).message.includes('version mismatch')) {
      return createErrorResponse(409, 'VERSION_MISMATCH', 'Profile was updated by another request. Please refresh and try again.');
    }
    
    return createErrorResponse(500, 'UPDATE_ERROR', 'Failed to update profile');
  }
};

/**
 * Handle logout
 */
const handleLogout = async (
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    const authResult = await authenticateRequest(event);
    if (!authResult.success || !authResult.userId) {
      return authResult.response!;
    }

    // In a full implementation, we would invalidate the refresh token
    // For now, we'll just log the logout
    logger.security('User logged out', {
      userId: authResult.userId,
      correlationId
    });

    return createResponse(200, { message: 'Logged out successfully' });

  } catch (error) {
    logger.error('Logout error', error as Error, { correlationId });
    return createErrorResponse(500, 'LOGOUT_ERROR', 'Logout failed');
  }
};

/**
 * Handle token validation (for other services)
 */
const handleValidateToken = async (
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    const authResult = await authenticateRequest(event);
    if (!authResult.success || !authResult.userId) {
      return authResult.response!;
    }

    const user = await userDAO.getUserById(authResult.userId);
    if (!user || !user.isActive) {
      return createErrorResponse(401, 'INVALID_TOKEN', 'Token is invalid or user is inactive');
    }

    // Get user permissions
    const permissions = userDAO.getUserPermissions(user.role);

    return createResponse(200, {
      valid: true,
      user: {
        userId: user.userId,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      },
      permissions
    });

  } catch (error) {
    logger.error('Token validation error', error as Error, { correlationId });
    return createErrorResponse(401, 'INVALID_TOKEN', 'Token validation failed');
  }
};

/**
 * Authenticate request and extract user information
 */
const authenticateRequest = async (event: APIGatewayProxyEvent): Promise<{
  success: boolean;
  userId?: string;
  response?: APIGatewayProxyResult;
}> => {
  try {
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        response: createErrorResponse(401, 'MISSING_TOKEN', 'Authorization token is required')
      };
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    return {
      success: true,
      userId: payload.userId
    };

  } catch (error) {
    return {
      success: false,
      response: createErrorResponse(401, 'INVALID_TOKEN', 'Invalid or expired token')
    };
  }
};

/**
 * Validate registration request
 */
const validateRegistrationRequest = (request: RegisterRequest): {
  valid: boolean;
  errors?: string[];
} => {
  const errors: string[] = [];

  if (!request.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
    errors.push('Valid email is required');
  }

  if (!request.password || request.password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!request.firstName || request.firstName.trim().length === 0) {
    errors.push('First name is required');
  }

  if (!request.lastName || request.lastName.trim().length === 0) {
    errors.push('Last name is required');
  }

  if (!request.role || !['AUTHOR', 'EDITOR', 'PUBLISHER', 'READER'].includes(request.role)) {
    errors.push('Valid role is required (AUTHOR, EDITOR, PUBLISHER, or READER)');
  }

  return {
    valid: errors.length === 0,
    ...(errors.length > 0 && { errors })
  };
};

/**
 * Create successful response
 */
const createResponse = (statusCode: number, body: any): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: getCorsHeaders(),
    body: JSON.stringify(body)
  };
};

/**
 * Create error response
 */
const createErrorResponse = (
  statusCode: number,
  code: string,
  message: string,
  details?: any[]
): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: getCorsHeaders(),
    body: JSON.stringify({
      error: {
        code,
        message,
        details
      },
      timestamp: new Date().toISOString(),
      requestId: `auth-${Date.now()}`
    })
  };
};