/**
 * Authentication routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { generateTokenPair, verifyToken } from '../utils/auth';
import { createUser, authenticateUser, updateLastLogin } from '../services/userService';
import { createError } from '../middleware/errorHandler';

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
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw createError('Invalid request data', 400, 'VALIDATION_ERROR', error.details);
    }

    const { email, password } = value;
    logger.info('Login attempt', { email });

    // Authenticate user
    const user = await authenticateUser({ email, password });
    if (!user) {
      throw createError('Invalid email or password', 401, 'AUTHENTICATION_FAILED');
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    // Update last login
    await updateLastLogin(user.userId);

    // Return user data and tokens (excluding password)
    const { hashedPassword, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      timestamp: new Date().toISOString(),
    });

    logger.info('Login successful', { userId: user.userId, email: user.email });
  } catch (error) {
    logger.error('Login failed', error instanceof Error ? error : new Error('Unknown error'), { email: req.body?.email });
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw createError('Invalid request data', 400, 'VALIDATION_ERROR', error.details);
    }

    const { email, password, firstName, lastName, role } = value;
    logger.info('Registration attempt', { email, role });

    // Create user
    const user = await createUser({
      email,
      password,
      firstName,
      lastName,
      role,
    });

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    // Return user data and tokens (excluding password)
    const { hashedPassword, ...userWithoutPassword } = user;
    
    res.status(201).json({
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      timestamp: new Date().toISOString(),
    });

    logger.info('Registration successful', { userId: user.userId, email: user.email });
  } catch (error) {
    logger.error('Registration failed', error instanceof Error ? error : new Error('Unknown error'), { email: req.body?.email });
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      throw createError('Invalid request data', 400, 'VALIDATION_ERROR', error.details);
    }

    const { refreshToken } = value;
    logger.info('Token refresh attempt');

    // Verify refresh token
    const payload = verifyToken(refreshToken);
    
    // Generate new tokens
    const tokens = generateTokenPair({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      timestamp: new Date().toISOString(),
    });

    logger.info('Token refresh successful', { userId: payload.userId });
  } catch (error) {
    logger.error('Token refresh failed', error instanceof Error ? error : new Error('Unknown error'));
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', async (_req, res, next) => {
  try {
    logger.info('Logout attempt');
    
    // In a production system, you'd want to blacklist the token
    // For now, we'll just return success
    res.json({
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
    });

    logger.info('Logout successful');
  } catch (error) {
    logger.error('Logout failed', error instanceof Error ? error : new Error('Unknown error'));
    next(error);
  }
});

export { router as authRoutes };