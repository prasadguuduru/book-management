/**
 * Workflow Tasks Route Handlers
 * Handles task lists and statistics for workflow management
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { RouteParams, UserContext } from '../../shared/http/router';
import { sharedResponseHandler } from '../../shared/http/response-utils';
import { SharedLogger } from '../../shared/logging/logger';
import { workflowDAO } from '../../shared/data/dao/workflow-dao';
import { bookDAO } from '../../shared/data/dao/book-dao';
import { UserRole, Book } from '../../shared/types';

const logger = new SharedLogger('workflow-service');

/**
 * Helper functions for calculating workflow metrics
 * These would be implemented with actual data analysis in a real system
 */
async function calculateAverageReviewTime(): Promise<string> {
    // TODO: Implement actual calculation from workflow history
    // For now, return a placeholder
    return 'N/A';
}

async function calculateAveragePublishTime(): Promise<string> {
    // TODO: Implement actual calculation from workflow history
    return 'N/A';
}

async function calculateAuthorAverageTimeToPublish(authorId: string): Promise<string> {
    // TODO: Implement actual calculation for specific author
    return 'N/A';
}

async function getAuthorTotalViews(authorId: string): Promise<number> {
    // TODO: Implement actual analytics data retrieval
    return 0;
}

async function getAuthorTotalDownloads(authorId: string): Promise<number> {
    // TODO: Implement actual analytics data retrieval
    return 0;
}

async function getBooksPublishedThisMonth(): Promise<number> {
    // TODO: Implement date-based query for books published this month
    return 0;
}

async function getTotalAuthorsCount(): Promise<number> {
    // TODO: Implement user statistics query
    return 0;
}

async function getTotalGenresCount(): Promise<number> {
    // TODO: Implement genre count query
    return 0;
}

/**
 * GET /tasks
 */
export const getTasks = async (
    event: APIGatewayProxyEvent,
    context: Context,
    params: RouteParams
): Promise<APIGatewayProxyResult> => {
    const requestId = context.awsRequestId;
    const userContext = params.userContext!;

    logger.functionEntry('getTasks', { userId: userContext.userId, role: userContext.role }, { requestId });

    try {
        // Parse query parameters
        const limit = parseInt(params.queryParams['limit'] || '20');
        const status = params.queryParams['status'];
        const priority = params.queryParams['priority'];

        let tasks: any[] = [];

        // Get tasks based on user role
        switch (userContext.role) {
            case 'EDITOR':
            case 'PUBLISHER':
                // Get books that need review/approval
                const booksForReviewResult = await bookDAO.getBooksByStatus('SUBMITTED_FOR_EDITING', limit);
                tasks = booksForReviewResult.books.map((book: Book) => ({
                    id: `review-${book.bookId}`,
                    type: 'review',
                    title: `Review: ${book.title}`,
                    description: `Review book by ${book.authorId}`,
                    bookId: book.bookId,
                    bookTitle: book.title,
                    author: book.authorId,
                    priority: 'medium',
                    status: 'pending',
                    createdAt: book.updatedAt || book.createdAt,
                    dueDate: null,
                    assignedTo: null,
                    actions: ['approve', 'reject']
                }));

                if (userContext.role === 'PUBLISHER') {
                    // Also get approved books that can be published
                    const approvedBooksResult = await bookDAO.getBooksByStatus('READY_FOR_PUBLICATION', limit);
                    const publishTasks = approvedBooksResult.books.map((book: Book) => ({
                        id: `publish-${book.bookId}`,
                        type: 'publish',
                        title: `Publish: ${book.title}`,
                        description: `Publish approved book by ${book.authorId}`,
                        bookId: book.bookId,
                        bookTitle: book.title,
                        author: book.authorId,
                        priority: 'high',
                        status: 'pending',
                        createdAt: book.updatedAt,
                        dueDate: null,
                        assignedTo: null,
                        actions: ['publish']
                    }));
                    tasks = [...tasks, ...publishTasks];
                }
                break;

            case 'AUTHOR':
                // Get author's books that need attention
                const authorBooksResult = await bookDAO.getBooksByAuthor(userContext.userId, limit);
                tasks = authorBooksResult.books
                    .filter((book: Book) => book.status === 'DRAFT')
                    .map((book: Book) => ({
                        id: `update-${book.bookId}`,
                        type: 'complete',
                        title: `Complete: ${book.title}`,
                        description: 'Complete and submit for review',
                        bookId: book.bookId,
                        bookTitle: book.title,
                        author: book.authorId,
                        priority: 'medium',
                        status: 'pending',
                        createdAt: book.createdAt,
                        dueDate: null,
                        assignedTo: userContext.userId,
                        actions: ['edit', 'submit']
                    }));
                break;

            default:
                // Readers don't have workflow tasks
                tasks = [];
        }

        // Apply filters
        if (status) {
            tasks = tasks.filter(task => task.status === status);
        }
        if (priority) {
            tasks = tasks.filter(task => task.priority === priority);
        }

        // Sort by priority and creation date
        tasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1;
            const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1;

            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }

            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Older first
        });

        const response = {
            tasks: tasks.slice(0, limit),
            totalCount: tasks.length,
            hasMore: tasks.length > limit,
            userRole: userContext.role,
            filters: {
                status,
                priority,
                limit
            }
        };

        logger.functionExit('getTasks', { taskCount: tasks.length }, { requestId });
        return sharedResponseHandler.success(response, 200, { requestId });

    } catch (error) {
        logger.error('Error getting tasks', error as Error, { requestId, userId: userContext.userId });
        return sharedResponseHandler.internalError('Failed to get tasks', { requestId });
    }
};

/**
 * GET /statistics
 */
export const getStatistics = async (
    event: APIGatewayProxyEvent,
    context: Context,
    params: RouteParams
): Promise<APIGatewayProxyResult> => {
    const requestId = context.awsRequestId;
    const userContext = params.userContext!;

    logger.functionEntry('getStatistics', { userId: userContext.userId, role: userContext.role }, { requestId });

    try {
        // Parse query parameters
        const timeframe = params.queryParams['timeframe'] || '30d'; // 7d, 30d, 90d
        const includeDetails = params.queryParams['includeDetails'] === 'true';

        let statistics: any = {
            timeframe,
            generatedAt: new Date().toISOString(),
            userRole: userContext.role
        };

        // Get statistics based on user role and permissions
        switch (userContext.role) {
            case 'PUBLISHER':
            case 'EDITOR':
                // Get comprehensive workflow statistics
                const [
                    draftBooksResult,
                    submittedBooksResult,
                    approvedBooksResult,
                    publishedBooksResult
                ] = await Promise.all([
                    bookDAO.getBooksByStatus('DRAFT', 1000),
                    bookDAO.getBooksByStatus('SUBMITTED_FOR_EDITING', 1000),
                    bookDAO.getBooksByStatus('READY_FOR_PUBLICATION', 1000),
                    bookDAO.getBooksByStatus('PUBLISHED', 1000)
                ]);

                const draftBooks = draftBooksResult.books.length;
                const submittedBooks = submittedBooksResult.books.length;
                const approvedBooks = approvedBooksResult.books.length;
                const publishedBooks = publishedBooksResult.books.length;
                const totalBooks = draftBooks + submittedBooks + approvedBooks + publishedBooks;

                statistics = {
                    ...statistics,
                    overview: {
                        totalBooks,
                        activeWorkflows: submittedBooks + approvedBooks,
                        completedWorkflows: publishedBooks,
                        pendingReview: submittedBooks,
                        readyToPublish: approvedBooks
                    },
                    statusBreakdown: {
                        draft: draftBooks,
                        submitted: submittedBooks,
                        approved: approvedBooks,
                        published: publishedBooks
                    },
                    workflowMetrics: {
                        averageReviewTime: await calculateAverageReviewTime(),
                        averagePublishTime: await calculateAveragePublishTime(),
                        rejectionRate: 0, // TODO: Implement rejection tracking
                        approvalRate: totalBooks > 0 ? Math.round((approvedBooks / totalBooks) * 100) : 0
                    }
                };

                if (includeDetails) {
                    // Get recent workflow activity
                    const recentActivity = await workflowDAO.getRecentWorkflowActivities(20);
                    statistics.recentActivity = recentActivity;
                }
                break;

            case 'AUTHOR':
                // Get author-specific statistics
                const authorBooksResult = await bookDAO.getBooksByAuthor(userContext.userId);
                const authorBooks = authorBooksResult.books;
                const authorStats = authorBooks.reduce((acc: Record<string, number>, book: Book) => {
                    acc[book.status] = (acc[book.status] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                statistics = {
                    ...statistics,
                    overview: {
                        totalBooks: authorBooks.length,
                        published: authorStats['PUBLISHED'] || 0,
                        inReview: authorStats['SUBMITTED'] || 0,
                        drafts: authorStats['DRAFT'] || 0,
                        needsRevision: authorStats['REJECTED'] || 0
                    },
                    statusBreakdown: authorStats,
                    personalMetrics: {
                        publishedRate: authorBooks.length > 0
                            ? Math.round(((authorStats['PUBLISHED'] || 0) / authorBooks.length) * 100)
                            : 0,
                        averageTimeToPublish: await calculateAuthorAverageTimeToPublish(userContext.userId),
                        totalViews: await getAuthorTotalViews(userContext.userId),
                        totalDownloads: await getAuthorTotalDownloads(userContext.userId)
                    }
                };
                break;

            default:
                // Readers get limited statistics
                statistics = {
                    ...statistics,
                    overview: {
                        availableBooks: (await bookDAO.getBooksByStatus('PUBLISHED', 1000)).books.length,
                        newThisMonth: await getBooksPublishedThisMonth(),
                        totalAuthors: await getTotalAuthorsCount(),
                        totalGenres: await getTotalGenresCount()
                    }
                };
        }

        logger.functionExit('getStatistics', { role: userContext.role }, { requestId });
        return sharedResponseHandler.success(statistics, 200, { requestId });

    } catch (error) {
        logger.error('Error getting statistics', error as Error, { requestId, userId: userContext.userId });
        return sharedResponseHandler.internalError('Failed to get statistics', { requestId });
    }
};