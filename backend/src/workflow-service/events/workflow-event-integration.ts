/**
 * Workflow Event Integration
 * Handles integration of event publishing into workflow transitions
 */

import { logger } from '../../utils/logger';
import {
    BookEventPublisher,
    createSNSEventPublisher,
    MockBookEventPublisher
} from './book-event-publisher';
import { Book, BookStatus } from '../../types';
import {
    shouldTriggerNotification,
    getNotificationTypeForTransition
} from '../../shared/events/event-types';
import { BookStatusChangeEventData } from '../../shared/events/book-workflow-events';

/**
 * Workflow event integration service
 */
export class WorkflowEventService {
    private eventPublisher: BookEventPublisher;

    constructor(eventPublisher?: BookEventPublisher) {
        if (eventPublisher) {
            this.eventPublisher = eventPublisher;
        } else {
            // Create appropriate publisher based on environment
            if (process.env['NODE_ENV'] === 'test') {
                this.eventPublisher = new MockBookEventPublisher();
            } else {
                try {
                    logger.info('🔧 ATTEMPTING TO CREATE SNS EVENT PUBLISHER', {
                        nodeEnv: process.env['NODE_ENV'],
                        hasTopicArn: !!process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'],
                        topicArnValue: process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'] ? 'present' : 'missing',
                        awsRegion: process.env['AWS_REGION'] || 'not-set'
                    });

                    this.eventPublisher = createSNSEventPublisher();

                    logger.info('✅ SNS EVENT PUBLISHER CREATED SUCCESSFULLY', {
                        publisherType: 'SNSBookEventPublisher'
                    });
                } catch (error) {
                    logger.error('❌ FAILED TO CREATE SNS EVENT PUBLISHER - USING MOCK PUBLISHER', error instanceof Error ? error : new Error(String(error)), {
                        error: error instanceof Error ? error.message : String(error),
                        nodeEnv: process.env['NODE_ENV'],
                        hasTopicArn: !!process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'],
                        topicArnValue: process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'] ? 'present' : 'missing',
                        awsRegion: process.env['AWS_REGION'] || 'not-set',
                        fallbackPublisher: 'MockBookEventPublisher'
                    });
                    this.eventPublisher = new MockBookEventPublisher();
                }
            }
        }

        logger.info('Workflow Event Service initialized', {
            publisherType: this.eventPublisher.constructor.name
        });
    }

    /**
     * Publishes a book status change event if the transition should trigger a notification
     */
    async publishBookStatusChangeEvent(
        book: Book,
        previousStatus: BookStatus | null,
        newStatus: BookStatus,
        changedBy: string,
        changeReason?: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        logger.info('🔄 PUBLISH BOOK STATUS CHANGE EVENT - ENTRY', {
            bookId: book.bookId,
            previousStatus,
            newStatus,
            changedBy,
            hasChangeReason: !!changeReason,
            hasMetadata: !!metadata,
            eventPublisherType: this.eventPublisher.constructor.name
        });

        // Critical warning if using mock publisher in non-test environment
        if (this.eventPublisher.constructor.name === 'MockBookEventPublisher' &&
            process.env['NODE_ENV'] !== 'test') {
            logger.error('🚨 CRITICAL: USING MOCK PUBLISHER IN PRODUCTION', new Error('Mock publisher detected in production'), {
                bookId: book.bookId,
                environment: process.env['NODE_ENV'] || 'unknown',
                eventPublisherType: this.eventPublisher.constructor.name,
                hasTopicArn: !!process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'],
                topicArnValue: process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'] ? 'present' : 'missing',
                impact: 'NO NOTIFICATIONS WILL BE SENT',
                solution: 'Check BOOK_WORKFLOW_EVENTS_TOPIC_ARN environment variable in Lambda'
            });
        }

        try {
            // Check if this transition should trigger a notification
            const shouldTrigger = shouldTriggerNotification(previousStatus, newStatus);
            logger.info('🔍 NOTIFICATION TRIGGER CHECK', {
                bookId: book.bookId,
                previousStatus,
                newStatus,
                shouldTrigger,
                reason: shouldTrigger ? 'transition configured for notifications' : 'transition not configured for notifications'
            });

            if (!shouldTrigger) {
                logger.debug('Status transition does not trigger notification', {
                    bookId: book.bookId,
                    previousStatus,
                    newStatus,
                    reason: 'transition not configured for notifications'
                });
                return;
            }

            // Get the notification type for this transition
            const notificationType = getNotificationTypeForTransition(previousStatus, newStatus);
            logger.info('🏷️ NOTIFICATION TYPE MAPPING', {
                bookId: book.bookId,
                previousStatus,
                newStatus,
                notificationType,
                hasMappedType: !!notificationType
            });

            if (!notificationType) {
                logger.debug('No notification type mapped for transition', {
                    bookId: book.bookId,
                    previousStatus,
                    newStatus
                });
                return;
            }

            // Create event data
            const eventData: BookStatusChangeEventData = {
                bookId: book.bookId,
                title: book.title,
                author: book.authorId, // Use authorId as author for now
                previousStatus,
                newStatus,
                changedBy,
                ...(changeReason && { changeReason }),
                metadata: {
                    ...metadata,
                    notificationType,
                    bookGenre: book.genre,
                    bookDescription: book.description?.substring(0, 200) // Truncate for event size
                }
            };

            logger.info('🚀 PUBLISHING BOOK STATUS CHANGE EVENT', {
                bookId: book.bookId,
                title: book.title,
                previousStatus,
                newStatus,
                notificationType,
                changedBy,
                eventPublisherType: this.eventPublisher.constructor.name,
                shouldTrigger: shouldTriggerNotification(previousStatus, newStatus),
                mappedNotificationType: getNotificationTypeForTransition(previousStatus, newStatus)
            });

            // Publish the event asynchronously with timeout
            logger.info('📤 CALLING EVENT PUBLISHER', {
                bookId: book.bookId,
                eventPublisherType: this.eventPublisher.constructor.name,
                eventDataKeys: Object.keys(eventData)
            });

            const publishStartTime = Date.now();

            // Retry configuration - adjusted for Lambda timeout constraints
            const maxRetries = 2; // Reduced from 3 to 2 to fit within Lambda timeout
            const timeoutMs = 6000; // Reduced to 6 seconds per attempt
            const retryDelayMs = 1000; // 1 second delay between retries

            let lastError: Error | null = null;
            let attempt = 0;
            let success = false;

            while (attempt < maxRetries && !success) {
                attempt++;

                try {
                    logger.info('📤 EVENT PUBLISHING ATTEMPT', {
                        bookId: book.bookId,
                        attempt,
                        maxRetries,
                        timeoutMs,
                        eventPublisherType: this.eventPublisher.constructor.name
                    });

                    // Use Promise.race to implement a timeout for each attempt
                    const publishPromise = this.eventPublisher.publishStatusChange(eventData);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Event publishing timeout after ${timeoutMs}ms`)), timeoutMs);
                    });

                    await Promise.race([publishPromise, timeoutPromise]);

                    const publishDuration = Date.now() - publishStartTime;
                    success = true;

                    logger.info('✅ SUCCESSFULLY PUBLISHED BOOK STATUS CHANGE EVENT', {
                        bookId: book.bookId,
                        notificationType,
                        newStatus,
                        publishDuration,
                        attempt,
                        totalAttempts: attempt
                    });

                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    const attemptDuration = Date.now() - publishStartTime;

                    logger.warn('⚠️ EVENT PUBLISHING ATTEMPT FAILED', {
                        bookId: book.bookId,
                        notificationType,
                        newStatus,
                        attempt,
                        maxRetries,
                        attemptDuration,
                        error: lastError.message,
                        willRetry: attempt < maxRetries
                    });

                    // If not the last attempt, wait before retrying
                    if (attempt < maxRetries) {
                        logger.info('⏳ WAITING BEFORE RETRY', {
                            bookId: book.bookId,
                            retryDelayMs,
                            nextAttempt: attempt + 1
                        });
                        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                    }
                }
            }

            // Final result handling
            if (!success && lastError) {
                const totalDuration = Date.now() - publishStartTime;
                logger.error('❌ EVENT PUBLISHING FAILED AFTER ALL RETRIES', lastError, {
                    bookId: book.bookId,
                    notificationType,
                    newStatus,
                    totalAttempts: attempt,
                    totalDuration,
                    willContinueWorkflow: true
                });

                // Don't re-throw the error - let the workflow continue
            }

        } catch (error) {
            // Log error but don't fail the workflow transition
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isTimeout = errorMessage.includes('timeout');

            logger.error('❌ FAILED TO PUBLISH BOOK STATUS CHANGE EVENT', error instanceof Error ? error : new Error(String(error)), {
                bookId: book.bookId,
                previousStatus,
                newStatus,
                changedBy,
                operation: 'publishBookStatusChangeEvent',
                errorType: isTimeout ? 'TIMEOUT' : 'UNKNOWN',
                isTimeout,
                willContinueWorkflow: true
            });

            // In production, you might want to add this to a retry queue
            // For now, we just log and continue - the workflow should not fail due to notification issues
        }
    }

    /**
     * Get the event publisher (useful for testing)
     */
    getEventPublisher(): BookEventPublisher {
        return this.eventPublisher;
    }
}

/**
 * Singleton instance of the workflow event service
 */
let workflowEventService: WorkflowEventService | null = null;

/**
 * Get the singleton workflow event service instance
 */
export function getWorkflowEventService(): WorkflowEventService {
    if (!workflowEventService) {
        workflowEventService = new WorkflowEventService();
    }
    return workflowEventService;
}

/**
 * Initialize the workflow event service with a custom publisher (useful for testing)
 */
export function initializeWorkflowEventService(eventPublisher: BookEventPublisher): void {
    workflowEventService = new WorkflowEventService(eventPublisher);
}

/**
 * Reset the workflow event service (useful for testing)
 */
export function resetWorkflowEventService(): void {
    workflowEventService = null;
}