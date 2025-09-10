/**
 * Lightweight User Context Extractor
 * Extracts user context from API Gateway authorizer without heavy dependencies
 * Designed for services that don't need full JWT validation or database access
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * User roles enum - duplicated here to avoid circular dependencies
 */
export type UserRole = 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';

/**
 * Lightweight user context interface
 */
export interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Extract user context from API Gateway authorizer
 * This is a lightweight version that doesn't require JWT validation or database access
 * 
 * @param event - API Gateway event
 * @param correlationId - Optional correlation ID for logging
 * @returns User context or null if extraction fails
 */
export async function extractUserContext(
  event: APIGatewayProxyEvent,
  correlationId?: string
): Promise<UserContext | null> {
  try {
    // Enhanced null safety checks
    if (!event || typeof event !== 'object') {
      return null;
    }

    const requestContext = event.requestContext;
    if (!requestContext || typeof requestContext !== 'object') {
      return null;
    }

    const authContext = requestContext.authorizer;
    if (!authContext || typeof authContext !== 'object') {
      return null;
    }

    // Primary extraction: direct authorizer properties
    const directUserId = authContext['userId'];
    const directRole = authContext['role'];
    const directEmail = authContext['email'];

    if (directUserId && typeof directUserId === 'string' && directUserId.trim() !== '' &&
        directRole && typeof directRole === 'string' && directRole.trim() !== '') {
      
      const userContext: UserContext = {
        userId: directUserId.trim(),
        role: directRole.trim() as UserRole,
        email: (directEmail && typeof directEmail === 'string') ? directEmail.trim() : ''
      };

      return userContext;
    }

    // Fallback extraction: JWT claims
    const claims = authContext['claims'];
    if (claims && typeof claims === 'object' && claims !== null) {
      const claimsUserId = claims['sub'];
      const claimsRole = claims['role'];
      const claimsEmail = claims['email'];

      if (claimsUserId && typeof claimsUserId === 'string' && claimsUserId.trim() !== '' &&
          claimsRole && typeof claimsRole === 'string' && claimsRole.trim() !== '') {
        
        const userContext: UserContext = {
          userId: claimsUserId.trim(),
          role: claimsRole.trim() as UserRole,
          email: (claimsEmail && typeof claimsEmail === 'string') ? claimsEmail.trim() : ''
        };

        return userContext;
      }
    }

    return null;

  } catch (error) {
    // Silent failure - let the calling service handle logging
    return null;
  }
}

/**
 * Synchronous version for cases where async is not needed
 */
export function extractUserContextSync(event: APIGatewayProxyEvent): UserContext | null {
  try {
    if (!event?.requestContext?.authorizer) {
      return null;
    }

    const authContext = event.requestContext.authorizer;

    // Try direct properties first
    const directUserId = authContext['userId'];
    const directRole = authContext['role'];
    const directEmail = authContext['email'];

    if (directUserId && directRole && typeof directUserId === 'string' && typeof directRole === 'string') {
      return {
        userId: directUserId.trim(),
        role: directRole.trim() as UserRole,
        email: (directEmail && typeof directEmail === 'string') ? directEmail.trim() : ''
      };
    }

    // Try JWT claims
    const claims = authContext['claims'];
    if (claims && typeof claims === 'object') {
      const claimsUserId = claims['sub'];
      const claimsRole = claims['role'];
      const claimsEmail = claims['email'];

      if (claimsUserId && claimsRole && typeof claimsUserId === 'string' && typeof claimsRole === 'string') {
        return {
          userId: claimsUserId.trim(),
          role: claimsRole.trim() as UserRole,
          email: (claimsEmail && typeof claimsEmail === 'string') ? claimsEmail.trim() : ''
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}