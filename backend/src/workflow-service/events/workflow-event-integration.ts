/**
 * Workflow Event Integration
 * Handles integration of event publishing into workflow transitions
 */

import { SharedLogger } from '../../shared/logging/logger';
import {
    BookEventPublisher,
    createSNSEventPublisher,
    MockBookEventPublisher
} from './book-event-publisher';
import { getWorkflowServiceConfig, isTestEnvironment, isProductionEnvironment } from '../config/environment';

const logger = new SharedLogger('workflow-event-service');
import { Book, BookStatus } from '../../shared/types';
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
            const config = getWorkflowServiceConfig();
            
            // Create appropriate publisher based on environment
            if (isTestEnvironment()) {
                this.eventPublisher = new MockBookEventPublisher();
            } else {
                try {
                    logger.info('Creating SNS event publisher', {
                        nodeEnv: config.nodeEnv,
                        hasTopicArn: !!config.bookWorkflowEventsTopicArn,
                        awsRegion: config.awsRegion
                    });

                    this.eventPublisher = createSNSEventPublisher();

                    logger.info('SNS event publisher created successfully', {
                        publisherType: 'SNSBookEventPublisher'
                    });
                } catch (error) {
                    logger.error('Failed to create SNS event publisher - using mock publisher', error instanceof Error ? error : new Error(String(error)), {
                        error: error instanceof Error ? error.message : String(error),
                        nodeEnv: config.nodeEnv,
                        hasTopicArn: !!config.bookWorkflowEventsTopicArn,
                        awsRegion: config.awsRegion,
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
        logger.info('Publishing book status change event', {
            bookId: book.bookId,
            previousStatus,
            newStatus,
            changedBy,
            eventPublisherType: this.eventPublisher.constructor.name
        });

        // Critical warning if using mock publisher in non-test environment
        if (this.eventPublisher.constructor.name === 'MockBookEventPublisher' && !isTestEnvironment()) {
            const config = getWorkflowServiceConfig();
            logger.error('CRITICAL: Using mock publisher in production', new Error('Mock publisher detected in production'), {
                bookId: book.bookId,
                environment: config.nodeEnv,
                eventPublisherType: this.eventPublisher.constructor.name,
                hasTopicArn: !!config.bookWorkflowEventsTopicArn,
                impact: 'NO NOTIFICATIONS WILL BE SENT',
                solution: 'Check BOOK_WORKFLOW_EVENTS_TOPIC_ARN environment variable in Lambda'
            });
        }

        try {
            // Check if this transition should trigger a notification
            const shouldTrigger = shouldTriggerNotification(previousStatus, newStatus);
            
            if (!shouldTrigger) {
                logger.debug('Status transition does not trigger notification', {
                    bookId: book.bookId,
                    previousStatus,
                    newStatus
                });
                return;
            }

            // Get the notification type for this transition
            const notificationType = getNotificationTypeForTransition(previousStatus, newStatus);
            
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

            logger.info('Publishing book status change event', {
                bookId: book.bookId,
                title: book.title,
                previousStatus,
                newStatus,
                notificationType,
                changedBy
            });

            // Publish the event with built-in retry logic
            await this.eventPublisher.publishStatusChange(eventData);
            
            logger.info('Successfully published book status change event', {
                bookId: book.bookId,
                notificationType,
                newStatus
            });

        } catch (error) {
            // Log error but don't fail the workflow transition
            logger.error('Failed to publish book status change event', error instanceof Error ? error : new Error(String(error)), {
                bookId: book.bookId,
                previousStatus,
                newStatus,
                changedBy,
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