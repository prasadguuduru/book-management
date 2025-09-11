/**
 * Workflow Transition Route Handlers
 * Handles workflow state transitions and validations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { RouteParams, UserContext } from '../../shared/http/router';
import { sharedResponseHandler } from '../../shared/http/response-utils';
import { SharedLogger } from '../../shared/logging/logger';
import { workflowDAO } from '../../shared/data/dao/workflow-dao';
import { bookDAO } from '../../shared/data/dao/book-dao';
import { getWorkflowEventService } from '../events/workflow-event-integration';
import { Book, BookStatus, UserRole, WorkflowAction } from '../../shared/types';

const logger = new SharedLogger('workflow-service');

/**
 * Validation interfaces
 */
interface ValidationResult {
    isValid: boolean;
    errorCode?: string;
    userMessage?: string;
    availableActions: any[];
    suggestedAction?: string;
}

interface TransitionRequest {
    action: WorkflowAction;
    comments?: string;
    metadata?: Record<string, any>;
}

interface ValidationRequest {
    action: WorkflowAction;
    fromStatus?: BookStatus;
}

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
 * Validate workflow transition
 */
function validateWorkflowTransition(
    book: Book,
    action: WorkflowAction,
    userContext: UserContext
): ValidationResult {
    const availableActions: any[] = [];

    // Check user permissions for the action
    switch (action) {
        case 'SUBMIT':
            if (book.status !== 'DRAFT') {
                return {
                    isValid: false,
                    errorCode: 'INVALID_STATUS',
                    userMessage: 'Book must be in DRAFT status to submit',
                    availableActions
                };
            }
            if (book.authorId !== userContext.userId) {
                return {
                    isValid: false,
                    errorCode: 'UNAUTHORIZED',
                    userMessage: 'Only the author can submit their book',
                    availableActions
                };
            }
            break;

        case 'APPROVE':
            if (book.status !== 'SUBMITTED_FOR_EDITING') {
                return {
                    isValid: false,
                    errorCode: 'INVALID_STATUS',
                    userMessage: 'Book must be in SUBMITTED_FOR_EDITING status to approve',
                    availableActions
                };
            }
            if (!['EDITOR', 'PUBLISHER'].includes(userContext.role)) {
                return {
                    isValid: false,
                    errorCode: 'UNAUTHORIZED',
                    userMessage: 'Only editors and publishers can approve books',
                    availableActions
                };
            }
            break;

        case 'REJECT':
            if (book.status !== 'SUBMITTED_FOR_EDITING') {
                return {
                    isValid: false,
                    errorCode: 'INVALID_STATUS',
                    userMessage: 'Book must be in SUBMITTED_FOR_EDITING status to reject',
                    availableActions
                };
            }
            if (!['EDITOR', 'PUBLISHER'].includes(userContext.role)) {
                return {
                    isValid: false,
                    errorCode: 'UNAUTHORIZED',
                    userMessage: 'Only editors and publishers can reject books',
                    availableActions
                };
            }
            break;

        case 'PUBLISH':
            if (book.status !== 'READY_FOR_PUBLICATION') {
                return {
                    isValid: false,
                    errorCode: 'INVALID_STATUS',
                    userMessage: 'Book must be in READY_FOR_PUBLICATION status to publish',
                    availableActions
                };
            }
            if (userContext.role !== 'PUBLISHER') {
                return {
                    isValid: false,
                    errorCode: 'UNAUTHORIZED',
                    userMessage: 'Only publishers can publish books',
                    availableActions
                };
            }
            break;

        default:
            return {
                isValid: false,
                errorCode: 'INVALID_ACTION',
                userMessage: `Unknown action: ${action}`,
                availableActions
            };
    }

    return {
        isValid: true,
        availableActions
    };
}

/**
 * Execute workflow transition
 */
async function executeWorkflowTransition(
    book: Book,
    action: WorkflowAction,
    userContext: UserContext,
    comments?: string,
    metadata?: Record<string, any>
): Promise<Book> {
    const previousStatus = book.status;
    let newStatus: BookStatus;

    // Determine new status based on action
    switch (action) {
        case 'SUBMIT':
            newStatus = 'SUBMITTED_FOR_EDITING';
            break;
        case 'APPROVE':
            newStatus = 'READY_FOR_PUBLICATION';
            break;
        case 'REJECT':
            newStatus = 'DRAFT';
            break;
        case 'PUBLISH':
            newStatus = 'PUBLISHED';
            break;
        default:
            throw new Error(`Invalid action: ${action}`);
    }

    // Update book status
    const updatedBook = await bookDAO.updateBookStatus(
        book.bookId,
        newStatus,
        userContext.role as UserRole,
        userContext.userId,
        book.version
    );

    // Record workflow transition
    await workflowDAO.recordTransition(
        book.bookId,
        previousStatus,
        newStatus,
        userContext.userId,
        action,
        comments,
        metadata
    );

    // Publish workflow event for notifications
    try {
        const workflowEventService = getWorkflowEventService();
        await workflowEventService.publishBookStatusChangeEvent(
            updatedBook,
            previousStatus,
            newStatus,
            userContext.userId,
            comments,
            metadata
        );
    } catch (error) {
        logger.error('Failed to publish workflow event', error as Error, {
            bookId: book.bookId,
            previousStatus,
            newStatus,
            action
        });
        // Don't fail the transition if event publishing fails
    }

    return updatedBook;
}

/**
 * POST /books/{bookId}/transition
 */
export const executeTransition = async (
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

    logger.functionEntry('executeTransition', { bookId, userId: userContext.userId }, { requestId });

    try {
        // Parse request body
        if (!event.body) {
            return sharedResponseHandler.validationError(['Request body is required'], { requestId });
        }

        const transitionRequest: TransitionRequest = JSON.parse(event.body);

        if (!transitionRequest.action) {
            return sharedResponseHandler.validationError(['Action is required'], { requestId });
        }

        // Get book details
        const book = await bookDAO.getBookById(bookId);
        if (!book) {
            return sharedResponseHandler.notFound('Book', { requestId });
        }

        // Check access permissions
        if (!canAccessBook(book, userContext)) {
            return sharedResponseHandler.forbidden('Access denied to this book', { requestId });
        }

        // Validate transition
        const validation = validateWorkflowTransition(book, transitionRequest.action, userContext);
        if (!validation.isValid) {
            return sharedResponseHandler.error(
                validation.errorCode || 'VALIDATION_FAILED',
                validation.userMessage || 'Transition validation failed',
                400,
                { requestId }
            );
        }

        // Execute transition
        const updatedBook = await executeWorkflowTransition(
            book,
            transitionRequest.action,
            userContext,
            transitionRequest.comments,
            transitionRequest.metadata
        );

        const response = {
            bookId: updatedBook.bookId,
            previousStatus: book.status,
            newStatus: updatedBook.status,
            action: transitionRequest.action,
            success: true
        };

        logger.functionExit('executeTransition', response, { requestId });
        return sharedResponseHandler.success(response, 200, { requestId });

    } catch (error) {
        logger.error('Error executing transition', error as Error, { requestId, bookId });
        return sharedResponseHandler.internalError('Failed to execute transition', { requestId });
    }
};

/**
 * POST /books/{bookId}/validate-transition
 */
export const validateTransition = async (
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

    logger.functionEntry('validateTransition', { bookId, userId: userContext.userId }, { requestId });

    try {
        // Parse request body
        if (!event.body) {
            return sharedResponseHandler.validationError(['Request body is required'], { requestId });
        }

        const validationRequest: ValidationRequest = JSON.parse(event.body);

        if (!validationRequest.action) {
            return sharedResponseHandler.validationError(['Action is required'], { requestId });
        }

        // Get book details
        const book = await bookDAO.getBookById(bookId);
        if (!book) {
            return sharedResponseHandler.notFound('Book', { requestId });
        }

        // Check access permissions
        if (!canAccessBook(book, userContext)) {
            return sharedResponseHandler.forbidden('Access denied to this book', { requestId });
        }

        // Validate transition
        const validation = validateWorkflowTransition(book, validationRequest.action, userContext);

        const response = {
            bookId,
            action: validationRequest.action,
            currentStatus: book.status,
            isValid: validation.isValid,
            ...(validation.errorCode && { errorCode: validation.errorCode }),
            ...(validation.userMessage && { message: validation.userMessage }),
            availableActions: validation.availableActions
        };

        logger.functionExit('validateTransition', { isValid: validation.isValid }, { requestId });
        return sharedResponseHandler.success(response, 200, { requestId });

    } catch (error) {
        logger.error('Error validating transition', error as Error, { requestId, bookId });
        return sharedResponseHandler.internalError('Failed to validate transition', { requestId });
    }
};

/**
 * Legacy workflow action handlers for backward compatibility
 */
export const executeWorkflowAction = async (
    bookId: string,
    action: WorkflowAction,
    event: APIGatewayProxyEvent,
    userContext: UserContext,
    requestId: string
): Promise<{ statusCode: number; body: any; }> => {
    logger.functionEntry('executeWorkflowAction', { bookId, action, userId: userContext.userId }, { requestId });

    try {
        // Get book details
        const book = await bookDAO.getBookById(bookId);
        if (!book) {
            return {
                statusCode: 404,
                body: {
                    error: {
                        code: 'BOOK_NOT_FOUND',
                        message: 'Book not found',
                        timestamp: new Date().toISOString(),
                        requestId
                    }
                }
            };
        }

        // Check access permissions
        if (!canAccessBook(book, userContext)) {
            return {
                statusCode: 403,
                body: {
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Access denied to this book',
                        timestamp: new Date().toISOString(),
                        requestId
                    }
                }
            };
        }

        // Smart action mapping: If author tries to "approve" their own DRAFT book, treat as "submit"
        let finalAction = action;
        if (action === 'APPROVE' && userContext.role === 'AUTHOR' && book.authorId === userContext.userId && book.status === 'DRAFT') {
            logger.info('Author approve on DRAFT book - mapping to SUBMIT', {
                bookId,
                userId: userContext.userId,
                bookStatus: book.status,
                originalAction: action,
                mappedAction: 'SUBMIT'
            });
            finalAction = 'SUBMIT';
        }

        // Parse comments from request body if present
        let comments: string | undefined;
        if (event.body) {
            try {
                const body = JSON.parse(event.body);
                comments = body.comments;
            } catch (error) {
                // Ignore JSON parse errors for backward compatibility
            }
        }

        // Validate transition using the final action
        const validation = validateWorkflowTransition(book, finalAction, userContext);
        if (!validation.isValid) {
            return {
                statusCode: 400,
                body: {
                    error: {
                        code: validation.errorCode || 'VALIDATION_FAILED',
                        message: validation.userMessage || 'Transition validation failed',
                        timestamp: new Date().toISOString(),
                        requestId
                    }
                }
            };
        }

        // Execute transition using the final action
        const updatedBook = await executeWorkflowTransition(
            book,
            finalAction,
            userContext,
            comments
        );

        const response = {
            bookId: updatedBook.bookId,
            previousStatus: book.status,
            newStatus: updatedBook.status,
            action: finalAction, // Return the actual action that was executed
            originalAction: action !== finalAction ? action : undefined, // Include original if mapped
            success: true,
            timestamp: new Date().toISOString()
        };

        logger.functionExit('executeWorkflowAction', response, { requestId });
        return {
            statusCode: 200,
            body: response
        };

    } catch (error) {
        logger.error('Error executing workflow action', error as Error, { requestId, bookId, action });
        return {
            statusCode: 500,
            body: {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to execute workflow action',
                    timestamp: new Date().toISOString(),
                    requestId
                }
            }
        };
    }
};