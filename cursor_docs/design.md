# Design Document

## Overview

This design addresses the book submission workflow issues by implementing proper status validation, UI state management, and user feedback mechanisms. The solution focuses on preventing invalid state transitions at the UI level while providing clear feedback about available actions and workflow status.

## Architecture

The solution involves three main components:

1. **Frontend State Management**: Enhanced book status tracking and UI state synchronization
2. **Backend Validation**: Improved error messages and status validation
3. **User Experience**: Clear workflow indicators and action availability

## Components and Interfaces

### Frontend Components

#### BookStatusManager
- **Purpose**: Centralized management of book status state and valid actions
- **Responsibilities**:
  - Track current book status
  - Determine available actions based on status and user role
  - Sync status with backend after actions
  - Handle status change notifications

#### BookActionButton
- **Purpose**: Smart button component that shows/hides based on available actions
- **Props**:
  - `book: Book` - Current book object
  - `action: string` - Action type (submit, edit, delete)
  - `userRole: UserRole` - Current user's role
  - `onAction: (bookId: string, action: string) => Promise<void>` - Action handler

#### BookStatusIndicator
- **Purpose**: Visual indicator of current book status and workflow stage
- **Props**:
  - `status: BookStatus` - Current book status
  - `showWorkflow: boolean` - Whether to show workflow progression
  - `nextSteps: string[]` - Available next steps for user

### Backend Enhancements

#### Enhanced Error Responses
- **Purpose**: Provide user-friendly error messages for invalid transitions
- **Structure**:
```typescript
interface BookError {
  code: string;
  message: string;
  userMessage: string; // User-friendly message
  availableActions: string[]; // What the user can do instead
  currentStatus: BookStatus;
}
```

#### Status Validation Service
- **Purpose**: Centralized validation of status transitions with detailed feedback
- **Methods**:
  - `validateTransition(currentStatus, newStatus, userRole): ValidationResult`
  - `getAvailableActions(book, userRole): Action[]`
  - `getWorkflowInfo(status): WorkflowInfo`

## Data Models

### Enhanced Book Model (Frontend)
```typescript
interface BookWithActions extends Book {
  availableActions: BookAction[];
  workflowStage: WorkflowStage;
  nextSteps: string[];
}

interface BookAction {
  type: 'submit' | 'edit' | 'delete' | 'view';
  label: string;
  enabled: boolean;
  tooltip?: string;
}

interface WorkflowStage {
  current: BookStatus;
  displayName: string;
  description: string;
  isUserAction: boolean; // Whether user can take action
}
```

### Validation Result Model
```typescript
interface ValidationResult {
  isValid: boolean;
  errorCode?: string;
  userMessage?: string;
  availableActions: BookAction[];
  suggestedAction?: string;
}
```

## Error Handling

### Frontend Error Handling
1. **Optimistic Updates**: UI updates immediately, rolls back on error
2. **Status Sync**: Automatic refresh of book data when errors occur
3. **User Feedback**: Toast notifications for actions and errors
4. **Graceful Degradation**: Disable actions when status is uncertain

### Backend Error Handling
1. **Detailed Logging**: Log all transition attempts with context
2. **User-Friendly Messages**: Convert technical errors to user messages
3. **Action Suggestions**: Provide alternative actions when transitions fail
4. **Status Information**: Include current status and available actions in error responses

## Testing Strategy

### Unit Tests
- **BookStatusManager**: Test status tracking and action determination
- **BookActionButton**: Test button state based on book status and user role
- **Status Validation**: Test all valid and invalid transition scenarios
- **Error Handling**: Test error message generation and user feedback

### Integration Tests
- **Status Synchronization**: Test UI updates after backend status changes
- **Workflow Progression**: Test complete workflow from draft to published
- **Error Recovery**: Test UI recovery from invalid state attempts
- **Multi-User Scenarios**: Test status changes by different user roles

### End-to-End Tests
- **Author Workflow**: Complete book creation, editing, and submission flow
- **Editor Workflow**: Review, approve, and reject book scenarios
- **Publisher Workflow**: Publishing approved books
- **Error Scenarios**: Invalid transition attempts and recovery

## Implementation Approach

### Phase 1: Backend Enhancements
1. Enhance error responses with user-friendly messages
2. Add status validation service with detailed feedback
3. Update API endpoints to return available actions
4. Improve logging for debugging transition issues

### Phase 2: Frontend State Management
1. Implement BookStatusManager for centralized status tracking
2. Create BookActionButton component with smart enabling/disabling
3. Add BookStatusIndicator for workflow visualization
4. Implement optimistic updates with rollback capability

### Phase 3: User Experience Improvements
1. Add workflow progression indicators
2. Implement toast notifications for actions and errors
3. Add help text and tooltips for workflow stages
4. Create status-specific messaging and guidance

### Phase 4: Testing and Validation
1. Comprehensive unit test coverage
2. Integration tests for status synchronization
3. End-to-end workflow testing
4. Error scenario validation and recovery testing