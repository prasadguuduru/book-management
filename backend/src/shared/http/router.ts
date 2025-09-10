/**
 * Shared Request Router Utility
 * 
 * This module provides consistent request routing across all Lambda services.
 * It supports path parameter extraction, query string handling, and middleware support.
 * 
 * Usage:
 * import { Router } from '../shared/http/router';
 * 
 * const router = new Router();
 * router.get('/books/{id}', handleGetBook);
 * router.post('/books', handleCreateBook);
 * 
 * export const handler = async (event, context) => {
 *   return await router.route(event, context);
 * };
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { sharedResponseHandler } from './response-utils';
import { sharedCorsHandler } from './cors-utils';

/**
 * Route handler function signature
 */
export type RouteHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
) => Promise<APIGatewayProxyResult>;

/**
 * Middleware function signature
 */
export type Middleware = (
  event: APIGatewayProxyEvent,
  context: Context,
  next: () => Promise<APIGatewayProxyResult>
) => Promise<APIGatewayProxyResult>;

/**
 * Authentication middleware function signature
 */
export type AuthMiddleware = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<UserContext | null>;

/**
 * Route parameters extracted from path
 */
export interface RouteParams {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  userContext?: UserContext;
}

/**
 * User context from authentication
 */
export interface UserContext {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
}

/**
 * Route configuration
 */
export interface RouteConfig {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middleware?: Middleware[];
  requireAuth?: boolean;
  requiredRoles?: string[];
  pathPattern?: RegExp;
  paramNames?: string[];
}

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

/**
 * Router configuration options
 */
export interface RouterOptions {
  corsEnabled?: boolean;
  authMiddleware?: AuthMiddleware;
  globalMiddleware?: Middleware[];
  defaultHeaders?: Record<string, string>;
}

/**
 * Request Router class
 */
export class Router {
  private routes: RouteConfig[] = [];
  private options: RouterOptions;

  constructor(options: RouterOptions = {}) {
    this.options = {
      corsEnabled: true,
      globalMiddleware: [],
      defaultHeaders: {},
      ...options
    };
  }

  /**
   * Add a GET route
   */
  get(path: string, handler: RouteHandler, options?: Partial<RouteConfig>): Router {
    return this.addRoute('GET', path, handler, options);
  }

  /**
   * Add a POST route
   */
  post(path: string, handler: RouteHandler, options?: Partial<RouteConfig>): Router {
    return this.addRoute('POST', path, handler, options);
  }

  /**
   * Add a PUT route
   */
  put(path: string, handler: RouteHandler, options?: Partial<RouteConfig>): Router {
    return this.addRoute('PUT', path, handler, options);
  }

  /**
   * Add a PATCH route
   */
  patch(path: string, handler: RouteHandler, options?: Partial<RouteConfig>): Router {
    return this.addRoute('PATCH', path, handler, options);
  }

  /**
   * Add a DELETE route
   */
  delete(path: string, handler: RouteHandler, options?: Partial<RouteConfig>): Router {
    return this.addRoute('DELETE', path, handler, options);
  }

  /**
   * Add middleware to all routes
   */
  use(middleware: Middleware): Router {
    this.options.globalMiddleware = this.options.globalMiddleware || [];
    this.options.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Set authentication middleware
   */
  setAuthMiddleware(authMiddleware: AuthMiddleware): Router {
    this.options.authMiddleware = authMiddleware;
    return this;
  }

  /**
   * Main routing method
   */
  async route(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    try {
      // Handle CORS preflight requests
      if (event.httpMethod === 'OPTIONS' && this.options.corsEnabled) {
        return sharedCorsHandler.createOptionsResponse(
          event.headers?.['origin'] || event.headers?.['Origin']
        );
      }

      // Find matching route
      const matchedRoute = this.findMatchingRoute(event);
      if (!matchedRoute) {
        return sharedResponseHandler.error(
          'NOT_FOUND',
          `Endpoint not found: ${event.httpMethod} ${event.path}`,
          404,
          { requestId: context.awsRequestId }
        );
      }

      const { route, params } = matchedRoute;

      // Handle authentication if required
      if (route.requireAuth && this.options.authMiddleware) {
        const userContext = await this.options.authMiddleware(event, context);
        if (!userContext) {
          return sharedResponseHandler.unauthorized(
            'Authentication required',
            { requestId: context.awsRequestId }
          );
        }

        // Check role requirements
        if (route.requiredRoles && route.requiredRoles.length > 0) {
          if (!route.requiredRoles.includes(userContext.role)) {
            return sharedResponseHandler.forbidden(
              'Insufficient permissions',
              { requestId: context.awsRequestId }
            );
          }
        }

        params.userContext = userContext;
      }

      // Build middleware chain
      const middlewareChain = [
        ...(this.options.globalMiddleware || []),
        ...(route.middleware || [])
      ];

      // Execute middleware chain and route handler
      const executeHandler = async (): Promise<APIGatewayProxyResult> => {
        return await route.handler(event, context, params);
      };

      const result = await this.executeMiddlewareChain(
        middlewareChain,
        event,
        context,
        executeHandler
      );

      // Add CORS headers if enabled
      if (this.options.corsEnabled && result.headers) {
        const corsHeaders = sharedCorsHandler.getHeaders(
          event.headers?.['origin'] || event.headers?.['Origin']
        );
        result.headers = {
          ...corsHeaders,
          ...this.options.defaultHeaders,
          ...result.headers
        };
      }

      return result;

    } catch (error) {
      console.error('Router error:', error);
      return sharedResponseHandler.internalError(
        'Internal server error',
        { requestId: context.awsRequestId }
      );
    }
  }

  /**
   * Add a route to the router
   */
  private addRoute(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    options?: Partial<RouteConfig>
  ): Router {
    const { pathPattern, paramNames } = this.compilePath(path);
    
    const route: RouteConfig = {
      method,
      path,
      handler,
      pathPattern,
      paramNames,
      middleware: [],
      requireAuth: false,
      requiredRoles: [],
      ...options
    };

    this.routes.push(route);
    return this;
  }

  /**
   * Find matching route for the request
   */
  private findMatchingRoute(event: APIGatewayProxyEvent): {
    route: RouteConfig;
    params: RouteParams;
  } | null {
    const method = event.httpMethod as HttpMethod;
    const path = this.normalizePath(event.path);

    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }

      if (route.pathPattern) {
        const match = path.match(route.pathPattern);
        if (match) {
          const pathParams = this.extractPathParams(match, route.paramNames || []);
          const queryParams = this.extractQueryParams(event.queryStringParameters);
          
          return {
            route,
            params: {
              pathParams,
              queryParams
            }
          };
        }
      } else if (route.path === path) {
        // Exact match
        const queryParams = this.extractQueryParams(event.queryStringParameters);
        
        return {
          route,
          params: {
            pathParams: {},
            queryParams
          }
        };
      }
    }

    return null;
  }

  /**
   * Compile path pattern to regex and extract parameter names
   */
  private compilePath(path: string): { pathPattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    
    // Handle both {param} and :param syntax
    const pattern = path
      .replace(/\{([^}]+)\}/g, (_, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      })
      .replace(/:([^/]+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)';
      })
      .replace(/\*/g, '.*'); // Support wildcard matching

    // Ensure exact match by anchoring the pattern
    const pathPattern = new RegExp(`^${pattern}$`);

    return { pathPattern, paramNames };
  }

  /**
   * Extract path parameters from regex match
   */
  private extractPathParams(match: RegExpMatchArray, paramNames: string[]): Record<string, string> {
    const params: Record<string, string> = {};
    
    for (let i = 0; i < paramNames.length; i++) {
      const value = match[i + 1]; // Skip the full match at index 0
      const paramName = paramNames[i];
      if (value !== undefined && paramName) {
        params[paramName] = decodeURIComponent(value);
      }
    }

    return params;
  }

  /**
   * Extract query parameters
   */
  private extractQueryParams(queryStringParameters: { [key: string]: string | undefined } | null): Record<string, string> {
    if (!queryStringParameters) {
      return {};
    }
    
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryStringParameters)) {
      if (value !== undefined) {
        params[key] = value;
      }
    }
    
    return params;
  }

  /**
   * Normalize path by removing trailing slashes and ensuring leading slash
   */
  private normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Remove trailing slash unless it's the root path
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    return path;
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(
    middlewareChain: Middleware[],
    event: APIGatewayProxyEvent,
    context: Context,
    finalHandler: () => Promise<APIGatewayProxyResult>
  ): Promise<APIGatewayProxyResult> {
    if (middlewareChain.length === 0) {
      return await finalHandler();
    }

    let index = 0;

    const next = async (): Promise<APIGatewayProxyResult> => {
      if (index >= middlewareChain.length) {
        return await finalHandler();
      }

      const middleware = middlewareChain[index++];
      if (middleware) {
        return await middleware(event, context, next);
      }
      return await finalHandler();
    };

    return await next();
  }
}

/**
 * Utility functions for common routing patterns
 */
export const routerUtils = {
  /**
   * Extract user context from API Gateway authorizer
   */
  extractUserContext: (event: APIGatewayProxyEvent): UserContext | null => {
    try {
      const authContext = event.requestContext.authorizer;
      if (!authContext || !authContext['userId'] || !authContext['role']) {
        return null;
      }

      return {
        userId: authContext['userId'],
        email: authContext['email'] || '',
        role: authContext['role'],
        permissions: authContext['permissions'] ? JSON.parse(authContext['permissions']) : []
      };
    } catch (error) {
      console.error('Error extracting user context:', error);
      return null;
    }
  },

  /**
   * Create authentication middleware
   */
  createAuthMiddleware: (): AuthMiddleware => {
    return async (event: APIGatewayProxyEvent, _context: Context): Promise<UserContext | null> => {
      return routerUtils.extractUserContext(event);
    };
  },

  /**
   * Create logging middleware
   */
  createLoggingMiddleware: (): Middleware => {
    return async (event: APIGatewayProxyEvent, context: Context, next: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> => {
      const startTime = Date.now();
      
      console.log('Request started:', {
        requestId: context.awsRequestId,
        method: event.httpMethod,
        path: event.path,
        timestamp: new Date().toISOString()
      });

      try {
        const result = await next();
        
        console.log('Request completed:', {
          requestId: context.awsRequestId,
          statusCode: result.statusCode,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });

        return result;
      } catch (error) {
        console.error('Request failed:', {
          requestId: context.awsRequestId,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      }
    };
  },

  /**
   * Create validation middleware
   */
  createValidationMiddleware: <T>(
    validator: (data: unknown) => { valid: boolean; errors?: string[]; data?: T }
  ): Middleware => {
    return async (event: APIGatewayProxyEvent, context: Context, next: () => Promise<APIGatewayProxyResult>): Promise<APIGatewayProxyResult> => {
      if (event.body && ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
        try {
          const bodyData = JSON.parse(event.body);
          const validation = validator(bodyData);
          
          if (!validation.valid) {
            return sharedResponseHandler.validationError(
              validation.errors || ['Validation failed'],
              { requestId: context.awsRequestId }
            );
          }
          
          // Attach validated data to event for use in handler
          (event as any).validatedBody = validation.data;
        } catch (error) {
          return sharedResponseHandler.error(
            'INVALID_JSON',
            'Invalid JSON in request body',
            400,
            { requestId: context.awsRequestId }
          );
        }
      }

      return await next();
    };
  }
};

// Export types for TypeScript support - using individual exports to avoid conflicts