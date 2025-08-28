/**
 * Tests for role validation middleware
 */
import { validateToken, requireRoles, requirePermission, requireOwnership, requireBookAccess, combineMiddleware, extractors, withAuth } from '../roleValidation';
import { verifyToken } from '../../utils/auth';
import { userDAO } from '../../data/dao/user-dao';
// Mock dependencies
jest.mock('../../utils/auth');
jest.mock('../../data/dao/user-dao');
jest.mock('../../utils/logger');
const mockVerifyToken = verifyToken;
const mockUserDAO = userDAO;
describe('Role Validation Middleware', () => {
    const mockEvent = {
        httpMethod: 'GET',
        path: '/test',
        headers: {
            Authorization: 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {},
        resource: '',
        body: null,
        isBase64Encoded: false
    };
    const mockTokenPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'AUTHOR'
    };
    const mockPermissions = [
        { resource: 'books', action: 'create' },
        { resource: 'books', action: 'read', conditions: ['own'] },
        { resource: 'books', action: 'update', conditions: ['own', 'draft'] }
    ];
    beforeEach(() => {
        jest.clearAllMocks();
        mockVerifyToken.mockReturnValue(mockTokenPayload);
        mockUserDAO.getUserPermissions.mockReturnValue(mockPermissions);
    });
    describe('validateToken', () => {
        it('should validate token successfully', async () => {
            const result = await validateToken(mockEvent);
            expect(result.success).toBe(true);
            expect(result.user).toEqual({
                userId: mockTokenPayload.userId,
                email: mockTokenPayload.email,
                role: mockTokenPayload.role,
                permissions: mockPermissions
            });
            expect(mockVerifyToken).toHaveBeenCalledWith('valid-token');
            expect(mockUserDAO.getUserPermissions).toHaveBeenCalledWith('AUTHOR');
        });
        it('should reject request without authorization header', async () => {
            const eventWithoutAuth = { ...mockEvent, headers: {} };
            const result = await validateToken(eventWithoutAuth);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(401);
            const body = JSON.parse(result.error.body);
            expect(body.error.code).toBe('MISSING_TOKEN');
        });
        it('should reject request with invalid authorization format', async () => {
            const eventWithInvalidAuth = {
                ...mockEvent,
                headers: { Authorization: 'InvalidFormat token' }
            };
            const result = await validateToken(eventWithInvalidAuth);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(401);
            const body = JSON.parse(result.error.body);
            expect(body.error.code).toBe('MISSING_TOKEN');
        });
        it('should reject invalid token', async () => {
            mockVerifyToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            const result = await validateToken(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(401);
            const body = JSON.parse(result.error.body);
            expect(body.error.code).toBe('INVALID_TOKEN');
        });
    });
    describe('requireRoles', () => {
        it('should allow access for authorized role', async () => {
            const middleware = requireRoles(['AUTHOR', 'EDITOR']);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
            expect(result.user?.role).toBe('AUTHOR');
        });
        it('should deny access for unauthorized role', async () => {
            const middleware = requireRoles(['EDITOR', 'PUBLISHER']);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(403);
            const body = JSON.parse(result.error.body);
            expect(body.error.code).toBe('INSUFFICIENT_ROLE');
            expect(body.error.message).toContain('EDITOR, PUBLISHER');
        });
        it('should handle token validation failure', async () => {
            mockVerifyToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            const middleware = requireRoles(['AUTHOR']);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(401);
        });
    });
    describe('requirePermission', () => {
        it('should allow access with required permission', async () => {
            const middleware = requirePermission('books', 'create');
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
            expect(result.user?.permissions).toContainEqual(expect.objectContaining({ resource: 'books', action: 'create' }));
        });
        it('should deny access without required permission', async () => {
            const middleware = requirePermission('books', 'delete');
            const result = await middleware(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(403);
            const body = JSON.parse(result.error.body);
            expect(body.error.code).toBe('INSUFFICIENT_PERMISSION');
            expect(body.error.message).toContain('delete on books');
        });
        it('should handle token validation failure', async () => {
            mockVerifyToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            const middleware = requirePermission('books', 'create');
            const result = await middleware(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(401);
        });
    });
    describe('requireOwnership', () => {
        it('should allow access for resource owner', async () => {
            const extractor = () => 'test-user-id'; // Same as token user ID
            const middleware = requireOwnership(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
        });
        it('should allow access for admin roles', async () => {
            mockVerifyToken.mockReturnValue({
                ...mockTokenPayload,
                role: 'EDITOR'
            });
            mockUserDAO.getUserPermissions.mockReturnValue([]);
            const extractor = () => 'different-user-id';
            const middleware = requireOwnership(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
        });
        it('should deny access for non-owner without admin role', async () => {
            const extractor = () => 'different-user-id';
            const middleware = requireOwnership(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(403);
            const body = JSON.parse(result.error.body);
            expect(body.error.code).toBe('ACCESS_DENIED');
        });
    });
    describe('requireBookAccess', () => {
        it('should allow author access to draft books', async () => {
            const extractor = () => 'DRAFT';
            const middleware = requireBookAccess(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
        });
        it('should allow editor access to submitted books', async () => {
            mockVerifyToken.mockReturnValue({
                ...mockTokenPayload,
                role: 'EDITOR'
            });
            const extractor = () => 'SUBMITTED_FOR_EDITING';
            const middleware = requireBookAccess(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
        });
        it('should allow publisher access to ready books', async () => {
            mockVerifyToken.mockReturnValue({
                ...mockTokenPayload,
                role: 'PUBLISHER'
            });
            const extractor = () => 'READY_FOR_PUBLICATION';
            const middleware = requireBookAccess(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
        });
        it('should allow everyone access to published books', async () => {
            mockVerifyToken.mockReturnValue({
                ...mockTokenPayload,
                role: 'READER'
            });
            const extractor = () => 'PUBLISHED';
            const middleware = requireBookAccess(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(true);
        });
        it('should deny reader access to draft books', async () => {
            mockVerifyToken.mockReturnValue({
                ...mockTokenPayload,
                role: 'READER'
            });
            const extractor = () => 'DRAFT';
            const middleware = requireBookAccess(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(403);
            const body = JSON.parse(result.error.body);
            expect(body.error.code).toBe('BOOK_ACCESS_DENIED');
        });
        it('should deny access to unknown status', async () => {
            const extractor = () => 'UNKNOWN_STATUS';
            const middleware = requireBookAccess(extractor);
            const result = await middleware(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(403);
        });
    });
    describe('combineMiddleware', () => {
        it('should pass when all middleware succeed', async () => {
            const middleware1 = requireRoles(['AUTHOR']);
            const middleware2 = requirePermission('books', 'create');
            const combined = combineMiddleware(middleware1, middleware2);
            const result = await combined(mockEvent);
            expect(result.success).toBe(true);
        });
        it('should fail when first middleware fails', async () => {
            const middleware1 = requireRoles(['EDITOR']); // Will fail for AUTHOR
            const middleware2 = requirePermission('books', 'create');
            const combined = combineMiddleware(middleware1, middleware2);
            const result = await combined(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(403);
        });
        it('should fail when second middleware fails', async () => {
            const middleware1 = requireRoles(['AUTHOR']);
            const middleware2 = requirePermission('books', 'delete'); // Will fail
            const combined = combineMiddleware(middleware1, middleware2);
            const result = await combined(mockEvent);
            expect(result.success).toBe(false);
            expect(result.error?.statusCode).toBe(403);
        });
    });
    describe('extractors', () => {
        it('should extract user ID from path parameters', () => {
            const event = {
                ...mockEvent,
                pathParameters: { userId: 'path-user-id' }
            };
            const result = extractors.userIdFromPath(event);
            expect(result).toBe('path-user-id');
        });
        it('should extract user ID from id parameter', () => {
            const event = {
                ...mockEvent,
                pathParameters: { id: 'path-id' }
            };
            const result = extractors.userIdFromPath(event);
            expect(result).toBe('path-id');
        });
        it('should extract book status from body', () => {
            const event = {
                ...mockEvent,
                body: JSON.stringify({ status: 'DRAFT' })
            };
            const result = extractors.bookStatusFromBody(event);
            expect(result).toBe('DRAFT');
        });
        it('should handle invalid JSON in body', () => {
            const event = {
                ...mockEvent,
                body: 'invalid-json'
            };
            const result = extractors.bookStatusFromBody(event);
            expect(result).toBe('');
        });
        it('should handle null body', () => {
            const event = {
                ...mockEvent,
                body: null
            };
            const result = extractors.userIdFromBody(event);
            expect(result).toBe('');
        });
    });
    describe('withAuth', () => {
        it('should call handler with authenticated user', async () => {
            const mockHandler = jest.fn().mockResolvedValue({
                statusCode: 200,
                headers: {},
                body: JSON.stringify({ success: true })
            });
            const middleware = requireRoles(['AUTHOR']);
            const wrappedHandler = withAuth(mockHandler, middleware);
            const result = await wrappedHandler(mockEvent);
            expect(result.statusCode).toBe(200);
            expect(mockHandler).toHaveBeenCalledWith(mockEvent, expect.objectContaining({
                userId: mockTokenPayload.userId,
                email: mockTokenPayload.email,
                role: mockTokenPayload.role,
                permissions: mockPermissions
            }));
        });
        it('should return error when middleware fails', async () => {
            const mockHandler = jest.fn();
            const middleware = requireRoles(['EDITOR']); // Will fail for AUTHOR
            const wrappedHandler = withAuth(mockHandler, middleware);
            const result = await wrappedHandler(mockEvent);
            expect(result.statusCode).toBe(403);
            expect(mockHandler).not.toHaveBeenCalled();
        });
        it('should handle handler errors', async () => {
            const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
            const middleware = requireRoles(['AUTHOR']);
            const wrappedHandler = withAuth(mockHandler, middleware);
            const result = await wrappedHandler(mockEvent);
            expect(result.statusCode).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
