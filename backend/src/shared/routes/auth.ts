/**
 * Authentication routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { generateTokenPair, verifyToken } from '../utils/auth';
import { createUser, authenticateUser, updateLastLogin } from '../services/userService';
import { createError } from '../middleware/errorHandler';

// Helper function to create safe log context
const createLogContext = (req: any, additionalContext: any = {}) => ({
  ...additionalContext,
  ip: req.ip || 'unknown',
  userAgent: req.get('User-Agent') || 'unknown',
});

const router = Router();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('AUTHOR', 'EDITOR', 'PUBLISHER', 'READER').required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  logger.httpRequest('POST', '/api/auth/login', req.headers, req.body, createLogContext(req, {
    requestId,
  }));

  try {
    logger.info('🔐 LOGIN_REQUEST_START', createLogContext(req, {
      requestId,
      operation: 'LOGIN_START',
    }));

    // Validate request body
    logger.debug('Validating login request', {
      requestId,
      hasEmail: !!req.body?.email,
      hasPassword: !!req.body?.password,
      operation: 'LOGIN_VALIDATION',
    });

    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      logger.validation('LOGIN_REQUEST', false, error.details, { requestId });
      throw createError('Invalid request data', 400, 'VALIDATION_ERROR', error.details);
    }

    logger.validation('LOGIN_REQUEST', true, undefined, { requestId });

    const { email, password } = value;
    logger.info('🔐 LOGIN_ATTEMPT', {
      requestId,
      email,
      operation: 'LOGIN_ATTEMPT',
    });

    // Authenticate user
    logger.debug('Starting user authentication', {
      requestId,
      email,
      operation: 'LOGIN_AUTH_START',
    });

    const user = await authenticateUser({ email, password });
    if (!user) {
      const duration = Date.now() - startTime;
      logger.security('Login failed - invalid credentials', {
        requestId,
        email,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        operation: 'LOGIN_AUTH_FAILED',
      });
      throw createError('Invalid email or password', 401, 'AUTHENTICATION_FAILED');
    }

    logger.security('User authentication successful', {
      requestId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      operation: 'LOGIN_AUTH_SUCCESS',
    });

    // Generate tokens
    logger.debug('Generating authentication tokens', {
      requestId,
      userId: user.userId,
      operation: 'LOGIN_TOKEN_GENERATE',
    });

    const tokens = generateTokenPair({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    logger.security('Authentication tokens generated', {
      requestId,
      userId: user.userId,
      accessTokenLength: tokens.accessToken.length,
      refreshTokenLength: tokens.refreshToken.length,
      operation: 'LOGIN_TOKEN_SUCCESS',
    });

    // Update last login
    logger.debug('Updating user last login time', {
      requestId,
      userId: user.userId,
      operation: 'LOGIN_LAST_LOGIN_UPDATE',
    });

    await updateLastLogin(user.userId);

    // Return user data and tokens (excluding password)
    const { hashedPassword: _hashedPassword, ...userWithoutPassword } = user;
    
    const responseData = {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      timestamp: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;
    
    logger.httpResponse(200, res.getHeaders(), responseData, {
      requestId,
      duration,
    });

    res.json(responseData);

    logger.audit('User login completed successfully', {
      requestId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'LOGIN_SUCCESS',
    });

    logger.info('🎉 LOGIN_SUCCESS', {
      requestId,
      userId: user.userId,
      email: user.email,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Login request failed', error instanceof Error ? error : new Error('Unknown error'), {
      requestId,
      email: req.body?.email,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'LOGIN_ERROR',
    });
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  logger.httpRequest('POST', '/api/auth/register', req.headers, req.body, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  try {
    logger.info('🆕 REGISTER_REQUEST_START', {
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'REGISTER_START',
    });

    // Validate request body
    logger.debug('Validating registration request', {
      requestId,
      hasEmail: !!req.body?.email,
      hasPassword: !!req.body?.password,
      hasFirstName: !!req.body?.firstName,
      hasLastName: !!req.body?.lastName,
      hasRole: !!req.body?.role,
      role: req.body?.role,
      operation: 'REGISTER_VALIDATION',
    });

    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      logger.validation('REGISTER_REQUEST', false, error.details, { requestId });
      throw createError('Invalid request data', 400, 'VALIDATION_ERROR', error.details);
    }

    logger.validation('REGISTER_REQUEST', true, undefined, { requestId });

    const { email, password, firstName, lastName, role } = value;
    logger.info('🆕 REGISTER_ATTEMPT', {
      requestId,
      email,
      firstName,
      lastName,
      role,
      operation: 'REGISTER_ATTEMPT',
    });

    // Create user
    logger.debug('Starting user creation', {
      requestId,
      email,
      role,
      operation: 'REGISTER_USER_CREATE_START',
    });

    const user = await createUser({
      email,
      password,
      firstName,
      lastName,
      role,
    });

    logger.security('User account created successfully', {
      requestId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      operation: 'REGISTER_USER_CREATED',
    });

    // Generate tokens
    logger.debug('Generating authentication tokens for new user', {
      requestId,
      userId: user.userId,
      operation: 'REGISTER_TOKEN_GENERATE',
    });

    const tokens = generateTokenPair({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    logger.security('Authentication tokens generated for new user', {
      requestId,
      userId: user.userId,
      accessTokenLength: tokens.accessToken.length,
      refreshTokenLength: tokens.refreshToken.length,
      operation: 'REGISTER_TOKEN_SUCCESS',
    });

    // Return user data and tokens (excluding password)
    const { hashedPassword: _hashedPassword, ...userWithoutPassword } = user;
    
    const responseData = {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      timestamp: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;
    
    logger.httpResponse(201, res.getHeaders(), responseData, {
      requestId,
      duration,
    });

    res.status(201).json(responseData);

    logger.audit('User registration completed successfully', {
      requestId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'REGISTER_SUCCESS',
    });

    logger.info('🎉 REGISTER_SUCCESS', {
      requestId,
      userId: user.userId,
      email: user.email,
      role: user.role,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Registration request failed', error instanceof Error ? error : new Error('Unknown error'), {
      requestId,
      email: req.body?.email,
      role: req.body?.role,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'REGISTER_ERROR',
    });
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  logger.httpRequest('POST', '/api/auth/refresh', req.headers, req.body, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  try {
    logger.info('🔄 REFRESH_REQUEST_START', {
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'REFRESH_START',
    });

    // Validate request body
    logger.debug('Validating token refresh request', {
      requestId,
      hasRefreshToken: !!req.body?.refreshToken,
      refreshTokenLength: req.body?.refreshToken?.length,
      operation: 'REFRESH_VALIDATION',
    });

    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      logger.validation('REFRESH_REQUEST', false, error.details, { requestId });
      throw createError('Invalid request data', 400, 'VALIDATION_ERROR', error.details);
    }

    logger.validation('REFRESH_REQUEST', true, undefined, { requestId });

    const { refreshToken } = value;
    logger.info('🔄 REFRESH_ATTEMPT', {
      requestId,
      refreshTokenLength: refreshToken.length,
      operation: 'REFRESH_ATTEMPT',
    });

    // Verify refresh token
    logger.debug('Verifying refresh token', {
      requestId,
      operation: 'REFRESH_TOKEN_VERIFY',
    });

    const payload = verifyToken(refreshToken);
    
    logger.security('Refresh token verified successfully', {
      requestId,
      userId: payload.userId,
      tokenId: payload.jti,
      operation: 'REFRESH_TOKEN_VERIFIED',
    });

    // Generate new tokens
    logger.debug('Generating new token pair', {
      requestId,
      userId: payload.userId,
      operation: 'REFRESH_NEW_TOKENS_GENERATE',
    });

    const tokens = generateTokenPair({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    logger.security('New token pair generated successfully', {
      requestId,
      userId: payload.userId,
      accessTokenLength: tokens.accessToken.length,
      refreshTokenLength: tokens.refreshToken.length,
      operation: 'REFRESH_NEW_TOKENS_SUCCESS',
    });

    const responseData = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      timestamp: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;
    
    logger.httpResponse(200, res.getHeaders(), responseData, {
      requestId,
      duration,
    });

    res.json(responseData);

    logger.audit('Token refresh completed successfully', {
      requestId,
      userId: payload.userId,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'REFRESH_SUCCESS',
    });

    logger.info('🎉 REFRESH_SUCCESS', {
      requestId,
      userId: payload.userId,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Token refresh request failed', error instanceof Error ? error : new Error('Unknown error'), {
      requestId,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'REFRESH_ERROR',
    });
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  logger.httpRequest('POST', '/api/auth/logout', req.headers, req.body, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  try {
    logger.info('🚪 LOGOUT_REQUEST_START', {
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'LOGOUT_START',
    });

    // In a production system, you'd want to blacklist the token
    // For now, we'll just return success
    logger.debug('Processing logout request', {
      requestId,
      operation: 'LOGOUT_PROCESS',
    });

    const responseData = {
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
    };

    const duration = Date.now() - startTime;
    
    logger.httpResponse(200, res.getHeaders(), responseData, {
      requestId,
      duration,
    });

    res.json(responseData);

    logger.audit('User logout completed successfully', {
      requestId,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'LOGOUT_SUCCESS',
    });

    logger.info('🎉 LOGOUT_SUCCESS', {
      requestId,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Logout request failed', error instanceof Error ? error : new Error('Unknown error'), {
      requestId,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      operation: 'LOGOUT_ERROR',
    });
    next(error);
  }
});

export { router as authRoutes };