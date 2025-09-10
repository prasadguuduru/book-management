/**
 * Tests for Authentication Middleware
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  extractUserContext,
  authenticateRequest,
  requireAuth,
  requireRole,
  requirePermission,
  UserContext,
  AuthenticatedHandler
} from '../auth-middleware';
import { verifyToken, extractTokenFromHeader } from '../../../utils/auth';
import { userDAO } from '../../../data/dao/user-dao';
import { logger } from '../../../utils/logger';
import { sharedResponseHandler } from '../../http/response-utils';

// Mock dependencies
jest.mock('../../../utils/auth');
jest.mock('../../../data/dao/user-dao');
jest.mock('../../../utils/logger');
jest.mock('../../http/response-utils');

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockExtractTokenFromHeader = extractTokenFromHeader as jest.MockedFunction<typeof extractTokenFromHeader>;
const mockUserDAO = userDAO as jest.Mocked<typeof userDAO>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockResponseHandler = sharedResponseHandler as jest.Mocked<typeof sharedResponseHandler>;

describe('Authentication Middleware', () => {
  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'AUTHOR' as const,
    isActive: true,
    emailVerified: true,
    preferences: {
      notifications: true,
      theme: 'light' as const,
      language: 'en'
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    version: 1
  };

  const mockJWTPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'AUTHOR'
  };

  const mockEvent: APIGatewayProxyEvent = {
    httpMethod: 'GET',
    path: '/api/test',
    headers: {
      Authorization: 'Bearer valid-token'
    },
    requestContext: {
      requestId: 'test-request-id'
    } as any,
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    pathParameters: null,
    queryStringParameters: null,
    resource: '',
    stageVariables: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockLogger.functionEntry = jest.fn();
    mockLogger.functionExit = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.security = jest.fn();
    
    mockUserDAO.getUserPermissions = jest.fn().mockReturnValue([
      { resource: 'book', action: 'create' },
      { resource: 'book', action: 'read' },
      { resource: 'book', action: 'update' },
      { resource: 'book', action: 'delete' },
      { resource: 'book', action: 'submit' }
    ]);
  });

  describe('extractUserContext', () => {
    it('should extract user context from API Gateway authorizer', async () => {
      const eventWithAuthorizer = {
        ...mockEvent,
        requestContext: {
          ...mockEvent.requestContext,
          authorizer: {
            principalId: 'user-123',
            email: 'test@example.com',
            role: 'AUTHOR',
            permissions: ['book:create', 'book:read'],
            isActive: true,
            sessionId: 'session-123'
          }
        }
      };

      const result = await extractUserContext(eventWithAuthorizer, 'test-correlation-id');

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR',
        permissions: ['book:create', 'book:read'],
        isActive: true,
        sessionId: 'session-123',
        correlationId: 'test-correlation-id'
      });
    });

    it('should extract user context from JWT token when no authorizer', async () => {
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);

      const result = await extractUserContext(mockEvent, 'test-correlation-id');

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR',
        permissions: [
          'book:create',
          'book:read',
          'book:update',
          'book:delete',
          'book:submit'
        ],
        isActive: true,
        correlationId: 'test-correlation-id'
      });

      expect(mockExtractTokenFromHeader).toHaveBeenCalledWith('Bearer valid-token');
      expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockUserDAO.getUserById).toHaveBeenCalledWith('user-123');
    });

    it('should return null when no token is provided', async () => {
      const eventWithoutAuth = {
        ...mockEvent,
        headers: {}
      };

      mockExtractTokenFromHeader.mockReturnValue(null);

      const result = await extractUserContext(eventWithoutAuth, 'test-correlation-id');

      expect(result).toBeNull();
    });

    it('should return null when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };

      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(inactiveUser);

      const result = await extractUserContext(mockEvent, 'test-correlation-id');

      expect(result).toBeNull();
    });

    it('should return null when user is not found', async () => {
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(null);

      const result = await extractUserContext(mockEvent, 'test-correlation-id');

      expect(result).toBeNull();
    });

    it('should handle token verification errors', async () => {
      mockExtractTokenFromHeader.mockReturnValue('invalid-token');
      mockVerifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await extractUserContext(mockEvent, 'test-correlation-id');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to extract user context',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('authenticateRequest', () => {
    it('should return success with user context for valid authentication', async () => {
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);

      const result = await authenticateRequest(mockEvent, 'test-correlation-id');

      expect(result.success).toBe(true);
      expect(result.userContext).toBeDefined();
      expect(result.userContext?.userId).toBe('user-123');
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid authentication', async () => {
      const unauthorizedResponse = { statusCode: 401, body: 'Unauthorized' } as APIGatewayProxyResult;
      
      mockExtractTokenFromHeader.mockReturnValue(null);
      mockResponseHandler.unauthorized.mockReturnValue(unauthorizedResponse);

      const result = await authenticateRequest(mockEvent, 'test-correlation-id');

      expect(result.success).toBe(false);
      expect(result.userContext).toBeUndefined();
      expect(result.error).toEqual(unauthorizedResponse);
    });
  });

  describe('requireAuth middleware', () => {
    const mockHandler: AuthenticatedHandler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' })
    } as APIGatewayProxyResult);

    it('should call handler with user context for authenticated request', async () => {
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);

      const wrappedHandler = requireAuth(mockHandler);
      const result = await wrappedHandler(mockEvent);

      expect(mockHandler).toHaveBeenCalledWith(mockEvent, expect.objectContaining({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AUTHOR'
      }));
      expect(result.statusCode).toBe(200);
    });

    it('should return unauthorized for unauthenticated request', async () => {
      const unauthorizedResponse = { statusCode: 401, body: 'Unauthorized' } as APIGatewayProxyResult;
      
      mockExtractTokenFromHeader.mockReturnValue(null);
      mockResponseHandler.unauthorized.mockReturnValue(unauthorizedResponse);

      const wrappedHandler = requireAuth(mockHandler);
      const result = await wrappedHandler(mockEvent);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toEqual(unauthorizedResponse);
    });

    it('should handle handler errors gracefully', async () => {
      const errorResponse = { statusCode: 500, body: 'Internal Server Error' } as APIGatewayProxyResult;
      const mockHandlerWithError = jest.fn().mockRejectedValue(new Error('Handler error'));
      
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);
      mockResponseHandler.internalError.mockReturnValue(errorResponse);

      const wrappedHandler = requireAuth(mockHandlerWithError);
      const result = await wrappedHandler(mockEvent);

      expect(result).toEqual(errorResponse);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Handler error in authenticated request',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('requireRole middleware', () => {
    const mockHandler: AuthenticatedHandler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' })
    } as APIGatewayProxyResult);

    it('should allow access for user with required role', async () => {
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);

      const wrappedHandler = requireRole(['AUTHOR', 'EDITOR'], mockHandler);
      const result = await wrappedHandler(mockEvent);

      expect(mockHandler).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
    });

    it('should deny access for user without required role', async () => {
      const forbiddenResponse = { statusCode: 403, body: 'Forbidden' } as APIGatewayProxyResult;
      
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);
      mockResponseHandler.forbidden.mockReturnValue(forbiddenResponse);

      const wrappedHandler = requireRole(['PUBLISHER'], mockHandler);
      const result = await wrappedHandler(mockEvent);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toEqual(forbiddenResponse);
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Role middleware blocked request - insufficient permissions',
        expect.objectContaining({
          userRole: 'AUTHOR',
          requiredRoles: ['PUBLISHER']
        })
      );
    });
  });

  describe('requirePermission middleware', () => {
    const mockHandler: AuthenticatedHandler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' })
    } as APIGatewayProxyResult);

    it('should allow access for user with required permission', async () => {
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);

      const wrappedHandler = requirePermission(['book:create'], false, mockHandler);
      const result = await wrappedHandler(mockEvent);

      expect(mockHandler).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
    });

    it('should deny access for user without required permission', async () => {
      const forbiddenResponse = { statusCode: 403, body: 'Forbidden' } as APIGatewayProxyResult;
      
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);
      mockResponseHandler.forbidden.mockReturnValue(forbiddenResponse);

      const wrappedHandler = requirePermission(['system:admin'], false, mockHandler);
      const result = await wrappedHandler(mockEvent);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toEqual(forbiddenResponse);
    });

    it('should require all permissions when requireAll is true', async () => {
      const forbiddenResponse = { statusCode: 403, body: 'Forbidden' } as APIGatewayProxyResult;
      
      mockExtractTokenFromHeader.mockReturnValue('valid-token');
      mockVerifyToken.mockReturnValue(mockJWTPayload);
      mockUserDAO.getUserById.mockResolvedValue(mockUser);
      mockResponseHandler.forbidden.mockReturnValue(forbiddenResponse);

      const wrappedHandler = requirePermission(['book:create', 'system:admin'], true, mockHandler);
      const result = await wrappedHandler(mockEvent);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toEqual(forbiddenResponse);
    });
  });
});