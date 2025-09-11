/**
 * Custom JWT Authorizer for API Gateway
 * Validates JWT tokens for protected endpoints
 * Migrated from custom-authorizer directory and adapted to use shared utilities
 */

import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

// JWT verification using jsonwebtoken
const jwt = require('jsonwebtoken');


/**
 * Custom authorizer handler for API Gateway TOKEN authorizer
 * Follows established Lambda patterns and error handling
 */
export const customAuthorizerHandler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  const correlationId = context.awsRequestId;

  logger.info('custom-authorizer-handler', {
    methodArn: event.methodArn,
    type: event.type || 'TOKEN',
    correlationId
  });

  try {
    // Environment validation
    const environment = process.env['NODE_ENV'] || 'development';
    const jwtSecret = process.env['JWT_SECRET'];

    if (!jwtSecret && environment !== 'development') {
      logger.error('JWT_SECRET not configured - Missing JWT configuration', undefined, { 
        correlationId 
      });
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    // Extract and validate token
    const token = event.authorizationToken;
    if (!token) {
      logger.info('Custom authorizer failed - no token provided', {
        methodArn: event.methodArn,
        correlationId
      });
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    if (!cleanToken || cleanToken.trim().length === 0) {
      logger.info('Custom authorizer failed - empty token', { correlationId });
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    logger.info('Processing token', {
      tokenLength: cleanToken.length,
      environment,
      correlationId
    });

    // Verify the JWT token
    const payload = verifyJWTToken(cleanToken);

    // Validate payload structure
    if (!payload.userId || !payload.email || !payload.role) {
      logger.info('Custom authorizer failed - invalid token payload', {
        hasUserId: !!payload.userId,
        hasEmail: !!payload.email,
        hasRole: !!payload.role,
        correlationId
      });
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    // Validate role
    const validRoles: UserRole[] = ['AUTHOR', 'EDITOR', 'PUBLISHER', 'READER'];
    if (!validRoles.includes(payload.role as UserRole)) {
      logger.info('Custom authorizer failed - invalid role', {
        role: payload.role,
        correlationId
      });
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    logger.info('Custom authorizer token verified', {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      methodArn: event.methodArn,
      correlationId
    });

    // Generate Allow policy with user context
    const policy = generatePolicy(payload.userId, 'Allow', event.methodArn, payload);

    logger.info('Custom authorizer policy generated', {
      principalId: payload.userId,
      effect: 'Allow',
      resource: event.methodArn,
      correlationId
    });

    return policy;

  } catch (error) {
    logger.error('Custom authorizer failed', error as Error, {
      methodArn: event.methodArn,
      correlationId
    });

    // Return deny policy for any error
    const policy = generatePolicy('unauthorized', 'Deny', event.methodArn);

    logger.info('Custom authorizer denied access', {
      error: (error as Error).message,
      methodArn: event.methodArn,
      correlationId
    });

    return policy;
  }
};

/**
 * Generate IAM policy for API Gateway
 * Creates appropriate Allow/Deny policies with user context
 */
const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: any
): APIGatewayAuthorizerResult => {
  // Create base resource pattern for the API
  // This allows access to all methods in the same API
  const baseResource = resource.split('/').slice(0, 4).join('/') + '/*';

  const policy: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: [
            resource,      // Specific resource
            baseResource   // Allow access to other endpoints in same API
          ]
        }
      ]
    }
  };

  // Add context if provided (user info for downstream lambdas)
  if (context && effect === 'Allow') {
    policy.context = {
      userId: String(context.userId),
      email: String(context.email),
      role: String(context.role),
      tokenId: String(context.jti || context.tokenId || 'unknown'),
      // Add timestamp for debugging
      authorizedAt: new Date().toISOString()
    };
  }

  return policy;
};

/**
 * Verify JWT token using jsonwebtoken library
 */
const verifyJWTToken = (token: string): any => {
  const environment = process.env['NODE_ENV'] || 'development';
  const jwtSecret = process.env['JWT_SECRET'];

  logger.info('Verifying token', {
    tokenLength: token.length,
    environment,
    hasJwtSecret: !!jwtSecret,
    isTestToken: token === 'test-token'
  });

  // For development, allow a simple test token FIRST
  if (token === 'test-token' && environment === 'development') {
    logger.info('Using development test token');
    return {
      userId: 'test-user-123',
      email: 'test@example.com',
      role: 'AUTHOR',
      jti: 'test-token-id'
    };
  }

  try {
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    // For QA/dev, use relaxed verification (no issuer/audience check)
    const verifyOptions: any = {
      algorithms: ['HS256']
    };

    // Only add issuer/audience for production
    if (environment === 'production') {
      verifyOptions.issuer = 'ebook-auth-service';
      verifyOptions.audience = 'ebook-platform-api';
    }

    logger.info('JWT verification options', {
      algorithms: verifyOptions.algorithms,
      hasIssuer: !!verifyOptions.issuer,
      hasAudience: !!verifyOptions.audience,
      environment
    });

    // Verify the token with the shared secret using HS256
    const decoded = jwt.verify(token, jwtSecret, verifyOptions);

    logger.info('JWT verification successful', {
      userId: decoded.userId,
      role: decoded.role,
      environment
    });

    return decoded;
  } catch (error) {
    logger.error('JWT verification failed', error as Error, {
      tokenLength: token.length,
      environment: process.env['NODE_ENV']
    });
    throw new Error('Invalid or expired token');
  }
};

/**
 * Health check handler for direct Lambda invocation
 * Useful for testing and monitoring
 */
export const healthCheck = async (): Promise<any> => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      service: 'custom-authorizer',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      configuration: {
        jwtConfigured: !!process.env['JWT_SECRET'],
        logLevel: process.env['LOG_LEVEL'] || 'info'
      }
    })
  };
};