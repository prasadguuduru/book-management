# Current Workflow Endpoints Documentation

## Overview

This document provides comprehensive documentation of all existing workflow endpoints in the current book-service implementation. This serves as the baseline specification for the workflow service refactoring.

## Service Architecture (Current State)

### Service: book-service
- **Location**: `backend/src/book-service/index.ts`
- **Responsibilities**: CRUD operations + Workflow operations
- **Database**: DynamoDB single table design
- **Authentication**: JWT via custom authorizer

## Workflow State Machine

### States
```
DRAFT → SUBMITTED_FOR_EDITING → READY_FOR_PUBLICATION → PUBLISHED
   ↑           ↓
   └───────────┘ (rejection path)
```

### State Transitions Matrix
| From State | To State | Allowed Roles | Action |
|------------|----------|---------------|---------|
| DRAFT | SUBMITTED_FOR_EDITING | AUTHOR (own books) | submit |
| SUBMITTED_FOR_EDITING | DRAFT | EDITOR | reject |
| SUBMITTED_FOR_EDITING | READY_FOR_PUBLICATION | EDITOR | approve |
| READY_FOR_PUBLICATION | SUBMITTED_FOR_EDITING | EDITOR | send back |
| READY_FOR_PUBLICATION | PUBLISHED | PUBLISHER | publish |
| PUBLISHED | (none) | (none) | (final state) |

## Workflow Endpoints

### 1. Book Creation (Initial Workflow State)

**Endpoint**: `POST /api/books`
**Purpose**: Creates a new book in DRAFT state
**Role**: AUTHOR only

#### Request
```http
POST /api/books
Authorization: Bearer {author-jwt-token}
Content-Type: application/json

{
  "title": "Book Title",
  "description": "Book description",
  "content": "Book content text",
  "genre": "fiction|non-fiction|science-fiction|mystery|romance|fantasy",
  "tags": ["tag1", "tag2"]
}
```

#### Success Response (201 Created)
```json
{
  "message": "Book created successfully",
  "book": {
    "bookId": "uuid-string",
    "authorId": "author-user-id",
    "title": "Book Title",
    "description": "Book description",
    "content": "Book content text",
    "genre": "fiction",
    "status": "DRAFT",
    "tags": ["tag1", "tag2"],
    "wordCount": 123,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "version": 1
  },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "requestId": "req-123"
}
```

#### Error Responses
- **403 Forbidden**: Non-author tries to create book
- **400 Bad Request**: Invalid book data
- **500 Internal Server Error**: Server error

### 2. Submit Book for Editing

**Endpoint**: `POST /api/books/{bookId}/submit`
**Purpose**: Author submits book for editorial review
**Role**: AUTHOR (own books only)
**State Transition**: DRAFT → SUBMITTED_FOR_EDITING

#### Request
```http
POST /api/books/{bookId}/submit
Authorization: Bearer {author-jwt-token}
Content-Type: application/json
```

#### Success Response (200 OK)
```json
{
  "message": "Book submitted for editing successfully",
  "book": {
    "bookId": "uuid-string",
    "authorId": "author-user-id",
    "title": "Book Title",
    "status": "SUBMITTED_FOR_EDITING",
    "updatedAt": "2024-01-01T12:05:00.000Z",
    "version": 2
  },
  "timestamp": "2024-01-01T12:05:00.000Z",
  "requestId": "req-124"
}
```

#### Error Responses
- **403 Forbidden**: Non-author or not book owner
- **400 Bad Request**: Invalid state transition (book not in DRAFT)
- **404 Not Found**: Book doesn't exist
- **500 Internal Server Error**: Server error

#### Validation Rules
- Only book author can submit
- Book must be in DRAFT state
- Book must have valid content

### 3. Approve Book

**Endpoint**: `POST /api/books/{bookId}/approve`
**Purpose**: Editor approves book for publication
**Role**: EDITOR only
**State Transition**: SUBMITTED_FOR_EDITING → READY_FOR_PUBLICATION

#### Request
```http
POST /api/books/{bookId}/approve
Authorization: Bearer {editor-jwt-token}
Content-Type: application/json

{
  "comments": "Optional approval comments"
}
```

#### Success Response (200 OK)
```json
{
  "message": "Book approved for publication successfully",
  "book": {
    "bookId": "uuid-string",
    "authorId": "author-user-id",
    "title": "Book Title",
    "status": "READY_FOR_PUBLICATION",
    "updatedAt": "2024-01-01T12:10:00.000Z",
    "version": 3
  },
  "timestamp": "2024-01-01T12:10:00.000Z",
  "requestId": "req-125"
}
```

#### Error Responses
- **403 Forbidden**: Non-editor tries to approve
- **400 Bad Request**: Invalid state transition (book not in SUBMITTED_FOR_EDITING)
- **404 Not Found**: Book doesn't exist
- **500 Internal Server Error**: Server error

#### Validation Rules
- Only EDITOR role can approve
- Book must be in SUBMITTED_FOR_EDITING state
- Comments are optional but recommended

### 4. Reject Book

**Endpoint**: `POST /api/books/{bookId}/reject`
**Purpose**: Editor rejects book back to draft
**Role**: EDITOR only
**State Transition**: SUBMITTED_FOR_EDITING → DRAFT

#### Request
```http
POST /api/books/{bookId}/reject
Authorization: Bearer {editor-jwt-token}
Content-Type: application/json

{
  "comments": "Rejection reason and feedback"
}
```

#### Success Response (200 OK)
```json
{
  "message": "Book rejected and returned to draft successfully",
  "book": {
    "bookId": "uuid-string",
    "authorId": "author-user-id",
    "title": "Book Title",
    "status": "DRAFT",
    "updatedAt": "2024-01-01T12:15:00.000Z",
    "version": 4
  },
  "timestamp": "2024-01-01T12:15:00.000Z",
  "requestId": "req-126"
}
```

#### Error Responses
- **403 Forbidden**: Non-editor tries to reject
- **400 Bad Request**: Invalid state transition (book not in SUBMITTED_FOR_EDITING)
- **404 Not Found**: Book doesn't exist
- **500 Internal Server Error**: Server error

#### Validation Rules
- Only EDITOR role can reject
- Book must be in SUBMITTED_FOR_EDITING state
- Comments should explain rejection reason

### 5. Publish Book

**Endpoint**: `POST /api/books/{bookId}/publish`
**Purpose**: Publisher publishes book to production
**Role**: PUBLISHER only
**State Transition**: READY_FOR_PUBLICATION → PUBLISHED

#### Request
```http
POST /api/books/{bookId}/publish
Authorization: Bearer {publisher-jwt-token}
Content-Type: application/json
```

#### Success Response (200 OK)
```json
{
  "message": "Book published successfully",
  "book": {
    "bookId": "uuid-string",
    "authorId": "author-user-id",
    "title": "Book Title",
    "status": "PUBLISHED",
    "publishedAt": "2024-01-01T12:20:00.000Z",
    "updatedAt": "2024-01-01T12:20:00.000Z",
    "version": 5
  },
  "timestamp": "2024-01-01T12:20:00.000Z",
  "requestId": "req-127"
}
```

#### Error Responses
- **403 Forbidden**: Non-publisher tries to publish
- **400 Bad Request**: Invalid state transition (book not in READY_FOR_PUBLICATION)
- **404 Not Found**: Book doesn't exist
- **500 Internal Server Error**: Server error

#### Validation Rules
- Only PUBLISHER role can publish
- Book must be in READY_FOR_PUBLICATION state
- Sets publishedAt timestamp

## Supporting Endpoints

### Get Book Details (with Workflow Info)

**Endpoint**: `GET /api/books/{bookId}`
**Purpose**: Retrieve book details including workflow state
**Role**: Based on access control rules

#### Success Response (200 OK)
```json
{
  "book": {
    "bookId": "uuid-string",
    "authorId": "author-user-id",
    "title": "Book Title",
    "description": "Book description",
    "content": "Book content",
    "genre": "fiction",
    "status": "DRAFT",
    "tags": ["tag1", "tag2"],
    "wordCount": 123,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "version": 1
  },
  "validTransitions": ["SUBMITTED_FOR_EDITING"],
  "permissions": {
    "canEdit": true,
    "canDelete": true
  },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "requestId": "req-123"
}
```

### Get Books by Status

**Endpoint**: `GET /api/books/status/{status}`
**Purpose**: List books by workflow status
**Role**: Based on access control rules

#### Valid Status Values
- `DRAFT`
- `SUBMITTED_FOR_EDITING`
- `READY_FOR_PUBLICATION`
- `PUBLISHED`

## Access Control Rules

### AUTHOR Role
- **Can Access**: Own books (all states) + Published books by others
- **Can Create**: Books (initial DRAFT state)
- **Can Edit**: Own books in DRAFT state
- **Can Delete**: Own books in DRAFT state
- **Can Submit**: Own books from DRAFT to SUBMITTED_FOR_EDITING
- **Cannot**: Approve, reject, or publish books

### EDITOR Role
- **Can Access**: Books in SUBMITTED_FOR_EDITING + Published books
- **Can Approve**: Books from SUBMITTED_FOR_EDITING to READY_FOR_PUBLICATION
- **Can Reject**: Books from SUBMITTED_FOR_EDITING to DRAFT
- **Can Send Back**: Books from READY_FOR_PUBLICATION to SUBMITTED_FOR_EDITING
- **Cannot**: Create, edit content, delete, or publish books

### PUBLISHER Role
- **Can Access**: Books in READY_FOR_PUBLICATION + Published books
- **Can Publish**: Books from READY_FOR_PUBLICATION to PUBLISHED
- **Cannot**: Create, edit, delete, submit, approve, or reject books

### READER Role
- **Can Access**: Published books only
- **Cannot**: Perform any workflow operations

## Error Response Format

All workflow endpoints use consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req-123"
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` (401): Missing or invalid authentication
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Book doesn't exist
- `INVALID_TRANSITION` (400): Invalid state transition
- `VALIDATION_FAILED` (400): Request data validation failed
- `CREATION_FAILED` (500): Book creation failed
- `SUBMISSION_FAILED` (500): Book submission failed
- `APPROVAL_FAILED` (500): Book approval failed
- `REJECTION_FAILED` (500): Book rejection failed
- `PUBLICATION_FAILED` (500): Book publication failed

## Workflow History Tracking

### Current Implementation
- Workflow transitions are recorded in `workflow_entries` table
- Each transition creates a new entry with:
  - `bookId`: Book identifier
  - `fromState`: Previous status (null for creation)
  - `toState`: New status
  - `actionBy`: User who performed the action
  - `action`: Type of action (CREATE, SUBMIT, APPROVE, REJECT, PUBLISH)
  - `comments`: Optional comments
  - `timestamp`: When the action occurred

### Workflow Entry Structure
```json
{
  "bookId": "uuid-string",
  "fromState": "DRAFT",
  "toState": "SUBMITTED_FOR_EDITING",
  "actionBy": "user-id",
  "action": "SUBMIT",
  "comments": "Ready for review",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Performance Characteristics

### Current Performance Metrics
- **Book Creation**: ~200-500ms
- **State Transitions**: ~150-300ms
- **Book Retrieval**: ~100-200ms
- **Concurrent Operations**: Handles 10+ concurrent requests

### Database Operations
- **Create Book**: 2 DynamoDB operations (book + workflow entry)
- **State Transition**: 2 DynamoDB operations (update book + create workflow entry)
- **Get Book**: 1 DynamoDB operation

## CORS Configuration

All workflow endpoints support CORS with:
- **Allowed Origins**: Configured frontend domains
- **Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers**: Authorization, Content-Type
- **Preflight Support**: OPTIONS requests handled

## Rate Limiting

Current implementation has no explicit rate limiting but relies on:
- API Gateway throttling
- Lambda concurrency limits
- DynamoDB capacity limits

## Monitoring and Logging

### Current Logging
- All workflow operations logged with:
  - Request ID for tracing
  - User ID and role
  - Book ID and state transition
  - Timestamp and duration
  - Success/failure status

### Log Levels
- **INFO**: Successful operations
- **WARN**: Permission denials, invalid transitions
- **ERROR**: System errors, failures

## Security Considerations

### Authentication
- JWT tokens required for all operations
- Token validation via custom authorizer
- User context extracted from token claims

### Authorization
- Role-based access control (RBAC)
- Resource ownership validation
- State-based permissions

### Data Validation
- Input sanitization
- Business rule validation
- State transition validation

## Testing Requirements

### Test Coverage Areas
1. **Happy Path Workflows**
   - Complete DRAFT → PUBLISHED flow
   - Rejection and resubmission flow

2. **Permission Validation**
   - Each role's allowed/denied operations
   - Cross-user access attempts

3. **Error Scenarios**
   - Invalid state transitions
   - Missing authentication
   - Non-existent books
   - Malformed requests

4. **Edge Cases**
   - Concurrent state changes
   - Version conflicts
   - Network timeouts

5. **Performance**
   - Response time validation
   - Concurrent user handling
   - Load testing

This documentation serves as the complete specification for current workflow functionality and will be used to validate that the refactored workflow service maintains identical behavior.