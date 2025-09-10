# Shared Authentication System

This module provides a comprehensive authentication and authorization system for Lambda functions, including token validation, user context extraction, and role-based access control.

## Features

- **Token Validation**: JWT token verification with fallback to API Gateway authorizer
- **User Context Extraction**: Standardized user context across all services
- **Role-Based Access Control**: Middleware for role and permission-based access
- **Audit Logging**: Comprehensive security event logging
- **Permission System**: Granular permission checking utilities

## Components

### Authentication Middleware (`auth-middleware.ts`)

Provides core authentication functionality:

- `extractUserContext()` - Extract user context from request
- `authenticateRequest()` - Authenticate and return user context or error
- `requireAuth()` - Middleware requiring authentication
- `requireRole()` - Middleware requiring specific roles
- `requirePermission()` - Middleware requiring specific permissions

### User Context Utilities (`user-context.ts`)

Provides permission checking and user context utilities:

- `hasPermission()` - Check if user has specific permission
- `canAccessResource()` - Check resource-level access
- `canPerformWorkflowAction()` - Check workflow action permissions
- `getUserCapabilities()` - Get all user capabilities
- `validateUserContext()` - Validate user context integrity
- `auditAuthenticationEvent()` - Log authentication events
- `auditAuthorizationEvent()` - Log authorization events

## Usage Examples

### Basic Authentication

```typescript
import { requireAuth } from '../shared/auth';

const handler = requireAuth(async (event, userContext) => {
  // Handler has access to authenticated user context
  console.log(`User ${userContext.userId} with role ${userContext.role}`);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' })
  };
});
```

### Role-Based Access

```typescript
import { requireRole } from '../shared/auth';

// Only allow AUTHORS and EDITORS
const handler = requireRole(['AUTHOR', 'EDITOR'], async (event, userContext) => {
  // Handler logic for authors and editors
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Access granted' })
  };
});
```

### Permission-Based Access

```typescript
import { requirePermission } from '../shared/auth';

// Require specific permissions
const handler = requirePermission(['book:create', 'book:update'], false, async (event, userContext) => {
  // Handler logic for users with book creation or update permissions
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Permission granted' })
  };
});
```

### Manual Permission Checking

```typescript
import { hasPermission, canAccessResource } from '../shared/auth';

const handler = requireAuth(async (event, userContext) => {
  // Check specific permission
  if (hasPermission(userContext, 'book:delete')) {
    // User can delete books
  }
  
  // Check resource access with ownership
  const bookId = event.pathParameters?.bookId;
  const book = await getBook(bookId);
  
  if (canAccessResource(userContext, 'book', 'update', book.authorId)) {
    // User can update this specific book
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' })
  };
});
```

## Permission System

The system uses a hierarchical permission model:

### Roles and Permissions

- **READER**: Basic read access to books and reviews
- **AUTHOR**: Can create, update, and submit books
- **EDITOR**: Can approve/reject books and moderate reviews
- **PUBLISHER**: Full access including publishing and user management

### Permission Format

Permissions follow the format `resource:action`:

- `book:create`, `book:read`, `book:update`, `book:delete`
- `book:submit`, `book:approve`, `book:reject`, `book:publish`
- `review:create`, `review:read`, `review:moderate`
- `user:read`, `user:update`, `user:manage`
- `workflow:read`, `workflow:manage`
- `analytics:read`, `analytics:manage`
- `system:admin`

## Security Features

### Audit Logging

All authentication and authorization events are logged with:

- User identification (ID, email, role)
- Action performed
- Resource accessed
- Result (granted/denied)
- Timestamp and correlation ID

### User Context Validation

The system validates user context integrity:

- Required fields presence
- User account status
- Role validity
- Permission consistency

### Error Handling

Comprehensive error handling with:

- Standardized error responses
- Security event logging
- Graceful degradation
- No sensitive data exposure

## Testing

The module includes comprehensive tests:

- Unit tests for all functions
- Integration tests for middleware
- Mock implementations for dependencies
- Edge case coverage

Run tests with:

```bash
npm test -- --testPathPattern="shared/auth"
```

## Integration

To integrate with existing Lambda functions:

1. Import the required middleware or utilities
2. Wrap your handler with authentication middleware
3. Use user context for business logic
4. Add permission checks as needed

The system is designed to be backward compatible and can be gradually adopted across services.