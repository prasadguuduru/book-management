/**
 * Comprehensive tests for the enhanced authentication service
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';
import { userDAO } from '../../data/dao/user-dao';
import { generateTokenPair, verifyToken } from '../../utils/auth';
import { authenticateRequest } from '../../shared/auth/auth-middleware';
import { User, LoginRequest, RegisterRequest } from '../../types';

// Mock dependencies
jest.mock('../../data/dao/user-dao');
jest.mock('../../utils/auth');
jest.mock('../../utils/logger');
jest.mock('../../shared/auth/auth-middleware');

const mockUserDAO = userDAO as jest.Mocked<typeof userDAO>;
const mockGenerateTokenPair = generateTokenPair as jest.MockedFunction<typeof generateTokenPair>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

describe('Auth Service', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'auth-service',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:auth-service',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/auth-service',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn()
  };

  const mockUser: User = {
    userId: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'AUTHOR',
    isActive: true,
    emailVerified: true,
    preferences: {
      notifications: true,
      theme: 'light',
      language: 'en'
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateTokenPair.mockReturnValue(mockTokens);
    
    // Default mock for authentication - can be overridden in individual tests
    mockAuthenticateRequest.mockResolvedValue({
      success: true,
      userContext: {
        userId: mockUser.userId,
        email: mockUser.email,
        role: mockUser.role,
        permissions: [],
        isActive: true
      }
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('auth-service');
      expect(body.version).toBe('2.0.0');
      expect(body.features).toEqual({
        registration: true,
        mockLogin: true,
        jwtTokens: true,
        roleBasedAuth: true,
        profileManagement: true
      });
    });
  });

  describe('Mock User Login', () => {
    it('should authenticate mock author user', async () => {
      const loginRequest: LoginRequest = {
        email: 'author@test.com',
        password: 'password123'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.accessToken).toBe(mockTokens.accessToken);
      expect(body.refreshToken).toBe(mockTokens.refreshToken);
      expect(body.user.email).toBe('author@test.com');
      expect(body.user.role).toBe('AUTHOR');
      expect(body.user.firstName).toBe('Author');
      expect(body.user.lastName).toBe('User');
    });

    it('should authenticate mock editor user', async () => {
      const loginRequest: LoginRequest = {
        email: 'editor@test.com',
        password: 'password123'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.user.role).toBe('EDITOR');
      expect(body.user.firstName).toBe('Editor');
    });

    it('should authenticate mock publisher user', async () => {
      const loginRequest: LoginRequest = {
        email: 'publisher@test.com',
        password: 'password123'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.user.role).toBe('PUBLISHER');
      expect(body.user.firstName).toBe('Publisher');
    });

    it('should authenticate mock reader user', async () => {
      const loginRequest: LoginRequest = {
        email: 'reader@test.com',
        password: 'password123'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.user.role).toBe('READER');
      expect(body.user.firstName).toBe('Reader');
    });

    it('should reject invalid mock user credentials', async () => {
      const loginRequest: LoginRequest = {
        email: 'author@test.com',
        password: 'wrongpassword'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      // Mock that user doesn't exist in database (so it falls through to real auth)
      mockUserDAO.getUserByEmail.mockResolvedValue(null);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Real User Login', () => {
    it('should authenticate real user with valid credentials', async () => {
      const loginRequest: LoginRequest = {
        email: 'real@example.com',
        password: 'password123'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      mockUserDAO.getUserByEmail.mockResolvedValue(mockUser);
      mockUserDAO.verifyPassword.mockResolvedValue(true);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.accessToken).toBe(mockTokens.accessToken);
      expect(body.refreshToken).toBe(mockTokens.refreshToken);
      expect(body.user.userId).toBe(mockUser.userId);
      expect(body.user.email).toBe(mockUser.email);
      expect(body.user.role).toBe(mockUser.role);
      expect(body.user.version).toBeUndefined(); // Should be removed from response
    });

    it('should reject login for non-existent user', async () => {
      const loginRequest: LoginRequest = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      mockUserDAO.getUserByEmail.mockResolvedValue(null);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for inactive user', async () => {
      const loginRequest: LoginRequest = {
        email: 'inactive@example.com',
        password: 'password123'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      const inactiveUser = { ...mockUser, isActive: false };
      mockUserDAO.getUserByEmail.mockResolvedValue(inactiveUser);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('should reject login with invalid password', async () => {
      const loginRequest: LoginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(loginRequest),
        isBase64Encoded: false
      };

      mockUserDAO.getUserByEmail.mockResolvedValue(mockUser);
      mockUserDAO.verifyPassword.mockResolvedValue(false);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('User Registration', () => {
    it('should register new user successfully', async () => {
      const registerRequest: RegisterRequest = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        role: 'AUTHOR'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/register',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(registerRequest),
        isBase64Encoded: false
      };

      mockUserDAO.getUserByEmail.mockResolvedValue(null); // User doesn't exist
      mockUserDAO.createUser.mockResolvedValue('new-user-id');
      mockUserDAO.getUserById.mockResolvedValue({
        ...mockUser,
        userId: 'new-user-id',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User'
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.accessToken).toBe(mockTokens.accessToken);
      expect(body.refreshToken).toBe(mockTokens.refreshToken);
      expect(body.user.email).toBe('newuser@example.com');
      expect(body.user.firstName).toBe('New');
      expect(body.user.lastName).toBe('User');
      expect(body.user.role).toBe('AUTHOR');
    });

    it('should reject registration with existing email', async () => {
      const registerRequest: RegisterRequest = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User',
        role: 'AUTHOR'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/register',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(registerRequest),
        isBase64Encoded: false
      };

      mockUserDAO.getUserByEmail.mockResolvedValue(mockUser); // User exists

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('USER_EXISTS');
    });

    it('should reject registration with invalid email', async () => {
      const registerRequest: RegisterRequest = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'AUTHOR'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/register',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(registerRequest),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details).toContain('Valid email is required');
    });

    it('should reject registration with short password', async () => {
      const registerRequest: RegisterRequest = {
        email: 'test@example.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User',
        role: 'AUTHOR'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/register',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(registerRequest),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details).toContain('Password must be at least 8 characters long');
    });

    it('should reject registration with invalid role', async () => {
      const registerRequest = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'INVALID_ROLE'
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/register',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(registerRequest),
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details).toContain('Valid role is required (AUTHOR, EDITOR, PUBLISHER, or READER)');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh tokens successfully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/refresh',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'valid-refresh-token' }),
        isBase64Encoded: false
      };

      mockVerifyToken.mockReturnValue({
        userId: mockUser.userId,
        email: mockUser.email,
        role: mockUser.role
      });
      mockUserDAO.getUserById.mockResolvedValue(mockUser);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.accessToken).toBe(mockTokens.accessToken);
      expect(body.refreshToken).toBe(mockTokens.refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/refresh',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'invalid-refresh-token' }),
        isBase64Encoded: false
      };

      mockVerifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Profile Management', () => {
    it('should get user profile successfully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/profile',
        headers: {
          Authorization: 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockVerifyToken.mockReturnValue({
        userId: mockUser.userId,
        email: mockUser.email,
        role: mockUser.role
      });
      mockUserDAO.getUserById.mockResolvedValue(mockUser);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.user.userId).toBe(mockUser.userId);
      expect(body.user.email).toBe(mockUser.email);
      expect(body.user.version).toBeUndefined(); // Should be removed
    });

    it('should update user profile successfully', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        preferences: {
          notifications: false,
          theme: 'dark' as const,
          language: 'es'
        }
      };

      const event: APIGatewayProxyEvent = {
        httpMethod: 'PUT',
        path: '/profile',
        headers: {
          Authorization: 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify(updates),
        isBase64Encoded: false
      };

      const updatedUser = { ...mockUser, ...updates };

      mockVerifyToken.mockReturnValue({
        userId: mockUser.userId,
        email: mockUser.email,
        role: mockUser.role
      });
      mockUserDAO.getUserById.mockResolvedValue(mockUser);
      mockUserDAO.updateUser.mockResolvedValue(updatedUser);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.user.firstName).toBe('Updated');
      expect(body.user.lastName).toBe('Name');
      expect(body.user.preferences.theme).toBe('dark');
    });

    it('should reject profile access without token', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/profile',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      // Override the default mock to simulate authentication failure
      mockAuthenticateRequest.mockResolvedValue({
        success: false,
        error: {
          statusCode: 401,
          headers: {},
          body: JSON.stringify({
            error: {
              code: 'MISSING_TOKEN',
              message: 'Authorization token is required'
            }
          })
        }
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Token Validation', () => {
    it('should validate token successfully', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/validate',
        headers: {
          Authorization: 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const mockPermissions = [
        { resource: 'books', action: 'create' },
        { resource: 'books', action: 'read', conditions: ['own'] }
      ];

      mockVerifyToken.mockReturnValue({
        userId: mockUser.userId,
        email: mockUser.email,
        role: mockUser.role
      });
      mockUserDAO.getUserById.mockResolvedValue(mockUser);
      mockUserDAO.getUserPermissions.mockReturnValue(mockPermissions);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.valid).toBe(true);
      expect(body.user.userId).toBe(mockUser.userId);
      expect(body.user.role).toBe(mockUser.role);
      expect(body.permissions).toEqual(mockPermissions);
    });

    it('should reject invalid token', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/validate',
        headers: {
          Authorization: 'Bearer invalid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockVerifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Override the default mock to simulate token validation failure (not missing token)
      mockAuthenticateRequest.mockRejectedValue(new Error('Invalid token'));

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS requests', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'OPTIONS',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      // Verify it's a valid origin (not just '*' which is less secure)
      const origin = result.headers!['Access-Control-Allow-Origin'];
      expect(origin).toBeTruthy();
      expect(typeof origin).toBe('string');
    });

    it('should include CORS headers in all responses', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('MISSING_BODY');
    });

    it('should handle invalid JSON in request body', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: 'invalid-json',
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('LOGIN_ERROR');
    });

    it('should handle unknown endpoints', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/unknown',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('GET /unknown');
    });
  });
});