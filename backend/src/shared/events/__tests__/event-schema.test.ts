/**
 * Test suite for event schema and validation
 */

import {
    createBookStatusChangeEvent,
    validateBookStatusChangeEvent,
    serializeBookEvent,
    deserializeBookEvent,
    getNotificationTypeForTransition,
    shouldTriggerNotification,
    BookNotificationType,
    BookStatusEnum
} from '../index';

describe('Event Schema and Validation', () => {
    describe('createBookStatusChangeEvent', () => {
        it('should create a valid book status change event', () => {
            const event = createBookStatusChangeEvent({
                bookId: 'book-123',
                title: 'Test Book',
                author: 'Test Author',
                previousStatus: null,
                newStatus: 'SUBMITTED_FOR_EDITING',
                changedBy: 'user-456',
                changeReason: 'Initial submission'
            });

            expect(event.eventType).toBe('book_status_changed');
            expect(event.source).toBe('workflow-service');
            expect(event.version).toBe('1.0');
            expect(event.data.bookId).toBe('book-123');
            expect(event.data.newStatus).toBe('SUBMITTED_FOR_EDITING');
        });
    });

    describe('validateBookStatusChangeEvent', () => {
        it('should validate a correct event', () => {
            const event = createBookStatusChangeEvent({
                bookId: 'book-123',
                title: 'Test Book',
                author: 'Test Author',
                previousStatus: 'DRAFT',
                newStatus: 'SUBMITTED_FOR_EDITING',
                changedBy: 'user-456'
            });

            const validation = validateBookStatusChangeEvent(event);
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should reject invalid event structure', () => {
            const invalidEvent = {
                eventType: 'wrong_type',
                data: {}
            };

            const validation = validateBookStatusChangeEvent(invalidEvent);
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    describe('serialization', () => {
        it('should serialize and deserialize events correctly', () => {
            const originalEvent = createBookStatusChangeEvent({
                bookId: 'book-123',
                title: 'Test Book',
                author: 'Test Author',
                previousStatus: 'DRAFT',
                newStatus: 'SUBMITTED_FOR_EDITING',
                changedBy: 'user-456'
            });

            const serialized = serializeBookEvent(originalEvent);
            const deserialized = deserializeBookEvent(serialized);

            expect(deserialized).toEqual(originalEvent);
        });
    });

    describe('notification type mappings', () => {
        it('should return correct notification type for submission', () => {
            const notificationType = getNotificationTypeForTransition(
                BookStatusEnum.DRAFT,
                BookStatusEnum.SUBMITTED_FOR_EDITING
            );
            expect(notificationType).toBe(BookNotificationType.BOOK_SUBMITTED);
        });

        it('should return correct notification type for approval', () => {
            const notificationType = getNotificationTypeForTransition(
                BookStatusEnum.SUBMITTED_FOR_EDITING,
                BookStatusEnum.READY_FOR_PUBLICATION
            );
            expect(notificationType).toBe(BookNotificationType.BOOK_APPROVED);
        });

        it('should return rejection notification for backward transition', () => {
            const notificationType = getNotificationTypeForTransition(
                BookStatusEnum.READY_FOR_PUBLICATION,
                BookStatusEnum.SUBMITTED_FOR_EDITING
            );
            expect(notificationType).toBe(BookNotificationType.BOOK_REJECTED);
        });

        it('should return published notification', () => {
            const notificationType = getNotificationTypeForTransition(
                BookStatusEnum.READY_FOR_PUBLICATION,
                BookStatusEnum.PUBLISHED
            );
            expect(notificationType).toBe(BookNotificationType.BOOK_PUBLISHED);
        });
    });

    describe('notification triggers', () => {
        it('should trigger notification for submission', () => {
            const shouldTrigger = shouldTriggerNotification(
                BookStatusEnum.DRAFT,
                BookStatusEnum.SUBMITTED_FOR_EDITING
            );
            expect(shouldTrigger).toBe(true);
        });

        it('should not trigger notification for draft status', () => {
            const shouldTrigger = shouldTriggerNotification(null, BookStatusEnum.DRAFT);
            expect(shouldTrigger).toBe(false);
        });

        it('should trigger notification for rejection', () => {
            const shouldTrigger = shouldTriggerNotification(
                BookStatusEnum.READY_FOR_PUBLICATION,
                BookStatusEnum.SUBMITTED_FOR_EDITING
            );
            expect(shouldTrigger).toBe(true);
        });
    });
});