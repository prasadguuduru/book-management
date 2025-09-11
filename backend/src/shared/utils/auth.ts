/**
 * Authentication utilities with comprehensive logging
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/environment';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for tracking
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const correlationId = uuidv4();
  logger.functionEntry('hashPassword', { passwordLength: password?.length }, { correlationId });
  
  try {
    const saltRounds = 12;
    logger.debug('🔐 Starting password hashing', {
      correlationId,
      saltRounds,
      operation: 'PASSWORD_HASH',
    });
    
    const startTime = Date.now();
    const hash = await bcrypt.hash(password, saltRounds);
    const duration = Date.now() - startTime;
    
    logger.performance('Password hashing completed', {
      correlationId,
      duration,
      operation: 'PASSWORD_HASH',
    });
    
    logger.security('Password successfully hashed', {
      correlationId,
      hashLength: hash.length,
      operation: 'PASSWORD_HASH_SUCCESS',
    });
    
    logger.functionExit('hashPassword', { hashLength: hash.length }, { correlationId });
    return hash;
  } catch (error) {
    logger.error('Password hashing failed', error as Error, {
      correlationId,
      operation: 'PASSWORD_HASH_ERROR',
    });
    throw error;
  }
};

/**
 * Verify a password against a hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const correlationId = uuidv4();
  logger.functionEntry('verifyPassword', { 
    passwordLength: password?.length, 
    hashLength: hash?.length 
  }, { correlationId });
  
  try {
    logger.debug('🔐 Starting password verification', {
      correlationId,
      operation: 'PASSWORD_VERIFY',
    });
    
    const startTime = Date.now();
    const isValid = await bcrypt.compare(password, hash);
    const duration = Date.now() - startTime;
    
    logger.performance('Password verification completed', {
      correlationId,
      duration,
      operation: 'PASSWORD_VERIFY',
    });
    
    if (isValid) {
      logger.security('Password verification successful', {
        correlationId,
        operation: 'PASSWORD_VERIFY_SUCCESS',
      });
    } else {
      logger.security('Password verification failed - invalid password', {
        correlationId,
        operation: 'PASSWORD_VERIFY_FAILED',
      });
    }
    
    logger.functionExit('verifyPassword', { isValid }, { correlationId });
    return isValid;
  } catch (error) {
    logger.error('Password verification error', error as Error, {
      correlationId,
      operation: 'PASSWORD_VERIFY_ERROR',
    });
    throw error;
  }
};

/**
 * Generate JWT access token
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  const correlationId = uuidv4();
  const tokenId = uuidv4();
  
  logger.functionEntry('generateAccessToken', payload, { correlationId, tokenId });
  
  try {
    const enhancedPayload = {
      ...payload,
      jti: tokenId,
      type: 'access',
    };
    
    const options: SignOptions = {
      algorithm: 'HS256',
      expiresIn: config.jwt.accessTokenExpiry as any,
      issuer: 'ebook-auth-service',
      audience: 'ebook-platform-api',
    };
    
    logger.debug('🔐 Generating access token', {
      correlationId,
      tokenId,
      userId: payload.userId,
      role: payload.role,
      expiresIn: config.jwt.accessTokenExpiry,
      operation: 'ACCESS_TOKEN_GENERATE',
    });
    
    const startTime = Date.now();
    const token = jwt.sign(enhancedPayload, config.jwt.privateKey, options);
    const duration = Date.now() - startTime;
    
    logger.performance('Access token generation completed', {
      correlationId,
      tokenId,
      duration,
      operation: 'ACCESS_TOKEN_GENERATE',
    });
    
    logger.tokenOperation('GENERATED', 'ACCESS_TOKEN', enhancedPayload, {
      correlationId,
      tokenId,
      userId: payload.userId,
    });
    
    logger.functionExit('generateAccessToken', { tokenLength: token.length }, { correlationId, tokenId });
    return token;
  } catch (error) {
    logger.error('Access token generation failed', error as Error, {
      correlationId,
      tokenId,
      userId: payload.userId,
      operation: 'ACCESS_TOKEN_GENERATE_ERROR',
    });
    throw error;
  }
};

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  const correlationId = uuidv4();
  const tokenId = uuidv4();
  
  logger.functionEntry('generateRefreshToken', payload, { correlationId, tokenId });
  
  try {
    const enhancedPayload = {
      ...payload,
      jti: tokenId,
      type: 'refresh',
    };
    
    const options: SignOptions = {
      algorithm: 'HS256',
      expiresIn: config.jwt.refreshTokenExpiry as any,
      issuer: 'ebook-auth-service',
      audience: 'ebook-platform-refresh',
    };
    
    logger.debug('🔐 Generating refresh token', {
      correlationId,
      tokenId,
      userId: payload.userId,
      role: payload.role,
      expiresIn: config.jwt.refreshTokenExpiry,
      operation: 'REFRESH_TOKEN_GENERATE',
    });
    
    const startTime = Date.now();
    const token = jwt.sign(enhancedPayload, config.jwt.privateKey, options);
    const duration = Date.now() - startTime;
    
    logger.performance('Refresh token generation completed', {
      correlationId,
      tokenId,
      duration,
      operation: 'REFRESH_TOKEN_GENERATE',
    });
    
    logger.tokenOperation('GENERATED', 'REFRESH_TOKEN', enhancedPayload, {
      correlationId,
      tokenId,
      userId: payload.userId,
    });
    
    logger.functionExit('generateRefreshToken', { tokenLength: token.length }, { correlationId, tokenId });
    return token;
  } catch (error) {
    logger.error('Refresh token generation failed', error as Error, {
      correlationId,
      tokenId,
      userId: payload.userId,
      operation: 'REFRESH_TOKEN_GENERATE_ERROR',
    });
    throw error;
  }
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (payload: JWTPayload): TokenPair => {
  const correlationId = uuidv4();
  logger.functionEntry('generateTokenPair', payload, { correlationId });
  
  try {
    logger.info('🔐 Generating token pair', {
      correlationId,
      userId: payload.userId,
      role: payload.role,
      operation: 'TOKEN_PAIR_GENERATE',
    });
    
    const startTime = Date.now();
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const duration = Date.now() - startTime;
    
    logger.performance('Token pair generation completed', {
      correlationId,
      duration,
      operation: 'TOKEN_PAIR_GENERATE',
    });
    
    logger.security('Token pair successfully generated', {
      correlationId,
      userId: payload.userId,
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length,
      operation: 'TOKEN_PAIR_SUCCESS',
    });
    
    const tokenPair = { accessToken, refreshToken };
    logger.functionExit('generateTokenPair', { 
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length 
    }, { correlationId });
    
    return tokenPair;
  } catch (error) {
    logger.error('Token pair generation failed', error as Error, {
      correlationId,
      userId: payload.userId,
      operation: 'TOKEN_PAIR_GENERATE_ERROR',
    });
    throw error;
  }
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  const correlationId = uuidv4();
  logger.functionEntry('verifyToken', { tokenLength: token?.length }, { correlationId });
  
  try {
    logger.debug('🔐 Starting token verification', {
      correlationId,
      tokenLength: token?.length,
      operation: 'TOKEN_VERIFY',
    });
    
    const startTime = Date.now();
    const decoded = jwt.verify(token, config.jwt.privateKey, {
      algorithms: ['HS256']
    }) as JWTPayload;
    const duration = Date.now() - startTime;
    
    logger.performance('Token verification completed', {
      correlationId,
      duration,
      operation: 'TOKEN_VERIFY',
    });
    
    logger.tokenOperation('VERIFIED', 'JWT_TOKEN', decoded, {
      correlationId,
      tokenId: decoded.jti,
      userId: decoded.userId,
    });
    
    logger.security('Token verification successful', {
      correlationId,
      tokenId: decoded.jti,
      userId: decoded.userId,
      role: decoded.role,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined,
      operation: 'TOKEN_VERIFY_SUCCESS',
    });
    
    logger.functionExit('verifyToken', decoded, { correlationId });
    return decoded;
  } catch (error) {
    logger.error('Token verification failed', error as Error, {
      correlationId,
      tokenLength: token?.length,
      operation: 'TOKEN_VERIFY_ERROR',
    });
    
    logger.security('Token verification failed - invalid or expired token', {
      correlationId,
      tokenLength: token?.length,
      errorType: (error as Error).name,
      operation: 'TOKEN_VERIFY_FAILED',
    });
    
    throw new Error('Invalid token');
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  const correlationId = uuidv4();
  logger.functionEntry('extractTokenFromHeader', { 
    hasAuthHeader: !!authHeader,
    headerLength: authHeader?.length 
  }, { correlationId });
  
  try {
    logger.debug('🔐 Extracting token from header', {
      correlationId,
      hasAuthHeader: !!authHeader,
      headerPrefix: authHeader?.substring(0, 10),
      operation: 'TOKEN_EXTRACT',
    });
    
    if (!authHeader) {
      logger.warn('No authorization header provided', {
        correlationId,
        operation: 'TOKEN_EXTRACT_NO_HEADER',
      });
      logger.functionExit('extractTokenFromHeader', null, { correlationId });
      return null;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Invalid authorization header format', {
        correlationId,
        headerPrefix: authHeader.substring(0, 20),
        operation: 'TOKEN_EXTRACT_INVALID_FORMAT',
      });
      logger.functionExit('extractTokenFromHeader', null, { correlationId });
      return null;
    }
    
    const token = authHeader.substring(7);
    
    logger.debug('Token successfully extracted from header', {
      correlationId,
      tokenLength: token.length,
      operation: 'TOKEN_EXTRACT_SUCCESS',
    });
    
    logger.functionExit('extractTokenFromHeader', { tokenLength: token.length }, { correlationId });
    return token;
  } catch (error) {
    logger.error('Token extraction failed', error as Error, {
      correlationId,
      operation: 'TOKEN_EXTRACT_ERROR',
    });
    throw error;
  }
};