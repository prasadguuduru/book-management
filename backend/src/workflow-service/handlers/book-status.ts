/**
 * Book Status Route Handlers
 * Handles book status-related workflow operations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { RouteParams, UserContext } from '../../shared/http/router';
import { sharedResponseHandler } from '../../shared/http/response-utils';
import { SharedLogger } from '../../shared/logging/logger';
import { workflowDAO } from '../../data/dao/workflow-dao';
import { bookDAO } from '../../data/dao/book-dao';
import { Book, BookStatus, UserRole } from '../../types';

const logger = new SharedLogger('workflow-service');

/**
 * Check if user can access book
 */
function canAccessBook(book: Book, userContext: UserContext): boolean {
  // Authors can access their own books
  if (book.authorId === userContext.userId) {
    return true;
  }

  // Editors and publishers can access all books
  if (['EDITOR', 'PUBLISHER'].includes(userContext.role)) {
    return true;
  }

  return false;
}

/**
 * Get available actions for a book based on status and user role
 */
function getAvailableActions(book: Book, userContext: UserContext): any[] {
  const actions: any[] = [];

  // Add actions based on book status and user role
  switch (book.status) {
    case 'DRAFT':
      if (book.authorId === userContext.userId) {
        actions.push({
          type: 'submit',
          label: 'Submit for Review',
          enabled: true
        });
        actions.push({
          type: 'edit',
          label: 'Edit Book',
          enabled: true
        });
      }
      break;

    case 'SUBMITTED_FOR_EDITING':
      if (['EDITOR', 'PUBLISHER'].includes(userContext.role)) {
        actions.push({
          type: 'approve',
          label: 'Approve Book',
          enabled: true
        });
        actions.push({
          type: 'reject',
          label: 'Reject Book',
          enabled: true
        });
      }
      break;

    case 'READY_FOR_PUBLICATION':
      if (userContext.role === 'PUBLISHER') {
        actions.push({
          type: 'publish',
          label: 'Publish Book',
          enabled: true
        });
      }
      break;
  }

  return actions;
}

/**
 * Get workflow stage information
 */
function getWorkflowStage(status: BookStatus): any {
  const stages: Record<BookStatus, any> = {
    'DRAFT': {
      current: 'DRAFT',
      displayName: 'Draft',
      description: 'Book is being written',
      isUserAction: true
    },
    'SUBMITTED_FOR_EDITING': {
      current: 'SUBMITTED_FOR_EDITING',
      displayName: 'Under Review',
      description: 'Book is being reviewed by editors',
      isUserAction: false
    },
    'READY_FOR_PUBLICATION': {
      current: 'READY_FOR_PUBLICATION',
      displayName: 'Ready for Publication',
      description: 'Book has been approved for publication',
      isUserAction: false
    },
    'PUBLISHED': {
      current: 'PUBLISHED',
      displayName: 'Published',
      description: 'Book is available to readers',
      isUserAction: false
    }
  };

  return stages[status] || stages['DRAFT'];
}

/**
 * Get next steps for workflow
 */
function getNextSteps(status: BookStatus, userRole: UserRole): string[] {
  const steps: Record<string, string[]> = {
    'DRAFT_AUTHOR': ['Submit book for review'],
    'SUBMITTED_FOR_EDITING_EDITOR': ['Review and approve/reject book'],
    'READY_FOR_PUBLICATION_PUBLISHER': ['Publish book'],
    'PUBLISHED_ALL': ['Book is live']
  };

  const key = `${status}_${userRole}`;
  return steps[key] || steps[`${status}_ALL`] || [];
}

/**
 * GET /books/{bookId}/status
 */
export const getBookStatus = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['bookId'];
  const userContext = params.userContext!;

  if (!bookId) {
    return sharedResponseHandler.validationError(['Book ID is required'], { requestId });
  }

  logger.functionEntry('getBookStatus', { bookId, userId: userContext.userId }, { requestId });

  try {
    // Get book details
    const book = await bookDAO.getBookById(bookId);
    if (!book) {
      return sharedResponseHandler.notFound('Book', { requestId });
    }

    // Check access permissions
    if (!canAccessBook(book, userContext)) {
      return sharedResponseHandler.forbidden('Access denied to this book', { requestId });
    }

    // Get workflow summary
    const workflowSummary = await workflowDAO.getBookWorkflowSummary(bookId);

    // Get available actions
    const availableActions = getAvailableActions(book, userContext);

    // Get workflow stage info
    const workflowStage = getWorkflowStage(book.status);

    // Get next steps
    const nextSteps = getNextSteps(book.status, userContext.role as UserRole);

    const response = {
      bookId: book.bookId,
      currentStatus: book.status,
      availableActions,
      workflowStage,
      nextSteps,
      timeInCurrentStatus: workflowSummary.timeInCurrentStatus
    };

    logger.functionExit('getBookStatus', response, { requestId });
    return sharedResponseHandler.success(response, 200, { requestId });

  } catch (error) {
    logger.error('Error getting book status', error as Error, { requestId, bookId });
    return sharedResponseHandler.internalError('Failed to get book status', { requestId });
  }
};

/**
 * GET /books/{bookId}/history
 */
export const getBookHistory = async (
  event: APIGatewayProxyEvent,
  context: Context,
  params: RouteParams
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  const bookId = params.pathParams['bookId'];
  const userContext = params.userContext!;

  if (!bookId) {
    return sharedResponseHandler.validationError(['Book ID is required'], { requestId });
  }

  logger.functionEntry('getBookHistory', { bookId, userId: userContext.userId }, { requestId });

  try {
    // Get book details for access control
    const book = await bookDAO.getBookById(bookId);
    if (!book) {
      return sharedResponseHandler.notFound('Book', { requestId });
    }

    // Check access permissions
    if (!canAccessBook(book, userContext)) {
      return sharedResponseHandler.forbidden('Access denied to this book', { requestId });
    }

    // Parse query parameters
    const limit = parseInt(params.queryParams['limit'] || '50');
    const lastEvaluatedKey = params.queryParams['lastEvaluatedKey'];

    // Get workflow history
    const result = await workflowDAO.getBookWorkflowHistory(bookId, limit, lastEvaluatedKey);

    const response = {
      bookId,
      history: result.history,
      hasMore: result.hasMore,
      lastEvaluatedKey: result.lastEvaluatedKey
    };

    logger.functionExit('getBookHistory', { historyCount: result.history.length }, { requestId });
    return sharedResponseHandler.success(response, 200, { requestId });

  } catch (error) {
    logger.error('Error getting book history', error as Error, { requestId, bookId });
    return sharedResponseHandler.internalError('Failed to get book history', { requestId });
  }
};