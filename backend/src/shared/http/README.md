# Shared HTTP Utilities

This directory contains shared HTTP utilities for consistent request handling across all Lambda services.

## Router Utility

The Router utility provides a consistent way to handle HTTP routing, authentication, and middleware in Lambda functions.

### Features

- **Path Parameter Extraction**: Supports both `{param}` and `:param` syntax
- **Query String Handling**: Automatic extraction and parsing of query parameters
- **Authentication Middleware**: Built-in support for JWT-based authentication
- **Role-Based Access Control**: Route-level role requirements
- **Middleware Support**: Global and route-specific middleware
- **CORS Handling**: Automatic CORS headers and preflight requests
- **Error Handling**: Consistent error responses and error handling
- **Path Normalization**: Handles trailing slashes and path variations

### Basic Usage

```typescript
import { Router, routerUtils } from '../shared/http/router';
import { sharedResponseHandler } from '../shared/http/response-utils';

// Create router with authentication
const router = new Router({
  corsEnabled: true,
  authMiddleware: routerUtils.createAuthMiddleware(),
  globalMiddleware: [routerUtils.createLoggingMiddleware()]
});

// Define route handlers
const getBooks = async (event, context, params) => {
  const { queryParams, userContext } = params;
  
  // Use query parameters
  const limit = parseInt(queryParams.limit || '10');
  
  // Access user context
  console.log('User:', userContext?.userId);
  
  return sharedResponseHandler.success({ books: [] });
};

// Add routes
router
  .get('/books', getBooks, { requireAuth: true })
  .post('/books', createBook, { 
    requireAuth: true, 
    requiredRoles: ['AUTHOR'] 
  });

// Lambda handler
export const handler = async (event, context) => {
  return await router.route(event, context);
};
```

### Path Parameters

The router supports both API Gateway path parameter syntaxes:

```typescript
// Curly brace syntax (API Gateway style)
router.get('/books/{id}', handler);

// Colon syntax (Express style)
router.get('/books/:id', handler);

// Multiple parameters
router.get('/users/{userId}/books/{bookId}', handler);

// Access in handler
const handler = async (event, context, params) => {
  const { id } = params.pathParams;
  const { userId, bookId } = params.pathParams;
};
```

### Query Parameters

Query parameters are automatically extracted and provided to handlers:

```typescript
const handler = async (event, context, params) => {
  const { queryParams } = params;
  
  const limit = parseInt(queryParams.limit || '10');
  const offset = parseInt(queryParams.offset || '0');
  const search = queryParams.q || '';
};
```

### Authentication

The router provides built-in authentication support:

```typescript
// Set up authentication middleware
const router = new Router({
  authMiddleware: routerUtils.createAuthMiddleware()
});

// Require authentication for a route
router.get('/protected', handler, { requireAuth: true });

// Require specific roles
router.post('/admin', handler, {
  requireAuth: true,
  requiredRoles: ['ADMIN', 'MODERATOR']
});

// Access user context in handler
const handler = async (event, context, params) => {
  const { userContext } = params;
  
  console.log('User ID:', userContext?.userId);
  console.log('User Role:', userContext?.role);
  console.log('Permissions:', userContext?.permissions);
};
```

### Middleware

The router supports both global and route-specific middleware:

```typescript
// Global middleware (applies to all routes)
router.use(routerUtils.createLoggingMiddleware());

// Route-specific middleware
const validationMiddleware = routerUtils.createValidationMiddleware(validator);

router.post('/books', handler, {
  middleware: [validationMiddleware]
});

// Custom middleware
const customMiddleware = async (event, context, next) => {
  console.log('Before handler');
  const result = await next();
  console.log('After handler');
  return result;
};

router.use(customMiddleware);
```

### Built-in Middleware

#### Logging Middleware

Logs request start and completion with timing information:

```typescript
router.use(routerUtils.createLoggingMiddleware());
```

#### Validation Middleware

Validates request body and attaches validated data to the event:

```typescript
const validator = (data) => {
  const errors = [];
  if (!data.title) errors.push('Title is required');
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    data
  };
};

const validationMiddleware = routerUtils.createValidationMiddleware(validator);

router.post('/books', handler, {
  middleware: [validationMiddleware]
});

// Access validated data in handler
const handler = async (event, context, params) => {
  const validatedData = (event as any).validatedBody;
};
```

### Error Handling

The router automatically handles errors and returns consistent error responses:

```typescript
// Automatic error handling for unhandled exceptions
const handler = async (event, context, params) => {
  throw new Error('Something went wrong'); // Returns 500 error
};

// Manual error responses
const handler = async (event, context, params) => {
  if (!params.pathParams.id) {
    return sharedResponseHandler.error(
      'MISSING_PARAMETER',
      'ID parameter is required',
      400,
      { requestId: context.awsRequestId }
    );
  }
};
```

### CORS Support

CORS is enabled by default and handles preflight requests automatically:

```typescript
// CORS enabled by default
const router = new Router(); // CORS enabled

// Disable CORS if needed
const router = new Router({ corsEnabled: false });

// CORS headers are automatically added to all responses
```

### Advanced Configuration

```typescript
const router = new Router({
  corsEnabled: true,
  authMiddleware: customAuthMiddleware,
  globalMiddleware: [
    routerUtils.createLoggingMiddleware(),
    customMiddleware
  ],
  defaultHeaders: {
    'X-Service': 'book-service',
    'X-Version': '1.0.0'
  }
});
```

### Migration from Existing Code

The router is designed to work alongside existing code patterns:

```typescript
// Before (existing pattern)
if (event.httpMethod === 'GET' && event.path === '/books') {
  return handleGetBooks(event);
} else if (event.httpMethod === 'POST' && event.path === '/books') {
  return handleCreateBook(event);
}

// After (using router)
router
  .get('/books', handleGetBooks)
  .post('/books', handleCreateBook);

export const handler = async (event, context) => {
  return await router.route(event, context);
};
```

### Testing

The router is fully tested and includes utilities for testing route handlers:

```typescript
import { Router } from '../shared/http/router';

describe('My Service', () => {
  let router: Router;
  
  beforeEach(() => {
    router = new Router();
    router.get('/test', myHandler);
  });
  
  it('should handle GET requests', async () => {
    const event = createMockEvent('GET', '/test');
    const context = createMockContext();
    
    const result = await router.route(event, context);
    
    expect(result.statusCode).toBe(200);
  });
});
```

## Response Utilities

See `response-utils.ts` for consistent response formatting.

## CORS Utilities

See `cors-utils.ts` for CORS configuration and handling.

## Examples

See the `examples/` directory for complete usage examples and patterns.