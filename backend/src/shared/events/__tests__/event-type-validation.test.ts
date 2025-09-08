/**
 * Comprehensive Unit Tests for Event Type Validation
 * Tests status transitions, notification mappings, and error scenarios
 */

import {
  validateStatusTransition,
  validateNotificationForTransition,
  validateEventTypeConfiguration,
  EventTypeValidationResult
} from '../event-type-validation';
import {
  BookStatusEnum,
  BookNotificationType,
  shouldTriggerNotification,
  getNotificationTypeForTransition,
  isValidBookStatus,
  isValidNotificationType
} from '../event-types';
import { BookStatus } from '../../../types';
import { logger } from '../../../utils/logger';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('Event Type Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateStatusTransition', () => {
    describe('valid transitions', () => {
      it('should validate transition from null to DRAFT', () => {
        const result = validateStatusTransition(null, BookStatusEnum.DRAFT);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate transition from DRAFT to SUBMITTED_FOR_EDITING', () => {
        const result = validateStatusTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate transition from SUBMITTED_FOR_EDITING to READY_FOR_PUBLICATION', () => {
        const result = validateStatusTransition(
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookStatusEnum.READY_FOR_PUBLICATION
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate transition from READY_FOR_PUBLICATION to PUBLISHED', () => {
        const result = validateStatusTransition(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.PUBLISHED
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate staying in same status', () => {
        const statuses = Object.values(BookStatusEnum);
        statuses.forEach(status => {
          const result = validateStatusTransition(status, status);
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('rejection transitions', () => {
      it('should validate rejection from READY_FOR_PUBLICATION to SUBMITTED_FOR_EDITING', () => {
        const result = validateStatusTransition(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.SUBMITTED_FOR_EDITING
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate rejection from SUBMITTED_FOR_EDITING to DRAFT', () => {
        const result = validateStatusTransition(
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookStatusEnum.DRAFT
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });
    });

    describe('invalid transitions', () => {
      it('should reject transition from DRAFT to READY_FOR_PUBLICATION', () => {
        const result = validateStatusTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.READY_FOR_PUBLICATION
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Invalid transition from DRAFT to READY_FOR_PUBLICATION'
        );
      });

      it('should reject transition from DRAFT to PUBLISHED', () => {
        const result = validateStatusTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.PUBLISHED
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Invalid transition from DRAFT to PUBLISHED'
        );
      });

      it('should reject transition from SUBMITTED_FOR_EDITING to PUBLISHED', () => {
        const result = validateStatusTransition(
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookStatusEnum.PUBLISHED
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Invalid transition from SUBMITTED_FOR_EDITING to PUBLISHED'
        );
      });
    });

    describe('unusual transitions with warnings', () => {
      it('should warn when transitioning from PUBLISHED', () => {
        const result = validateStatusTransition(
          BookStatusEnum.PUBLISHED,
          BookStatusEnum.READY_FOR_PUBLICATION
        );
        expect(result.isValid).toBe(false); // Invalid transition
        expect(result.warnings).toContain(
          'Transitioning from PUBLISHED status is unusual'
        );
      });

      it('should warn when transitioning from READY_FOR_PUBLICATION to DRAFT', () => {
        const result = validateStatusTransition(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.DRAFT
        );
        expect(result.isValid).toBe(false); // Invalid transition
        expect(result.warnings).toContain(
          'Transitioning from READY_FOR_PUBLICATION to DRAFT skips normal workflow'
        );
      });
    });

    describe('invalid status validation', () => {
      it('should reject invalid new status', () => {
        const result = validateStatusTransition(
          BookStatusEnum.DRAFT,
          'INVALID_STATUS' as BookStatus
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid new status: INVALID_STATUS');
      });

      it('should reject invalid previous status', () => {
        const result = validateStatusTransition(
          'INVALID_STATUS' as BookStatus,
          BookStatusEnum.DRAFT
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid previous status: INVALID_STATUS');
      });

      it('should handle null previous status correctly', () => {
        const result = validateStatusTransition(null, BookStatusEnum.DRAFT);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('validateNotificationForTransition', () => {
    describe('valid notification scenarios', () => {
      it('should validate submission notification', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookNotificationType.BOOK_SUBMITTED
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate approval notification', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookNotificationType.BOOK_APPROVED
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate rejection notification', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookNotificationType.BOOK_REJECTED
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate publication notification', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.PUBLISHED,
          BookNotificationType.BOOK_PUBLISHED
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('notification type mismatches', () => {
      it('should reject wrong notification type for submission', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookNotificationType.BOOK_APPROVED
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Expected notification type book_approved but transition requires book_submitted'
        );
      });

      it('should reject wrong notification type for approval', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookNotificationType.BOOK_REJECTED
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Expected notification type book_rejected but transition requires book_approved'
        );
      });
    });

    describe('transitions that should not trigger notifications', () => {
      it('should warn when expecting notification for non-triggering transition', () => {
        const result = validateNotificationForTransition(
          null,
          BookStatusEnum.DRAFT,
          BookNotificationType.BOOK_SUBMITTED
        );
        expect(result.isValid).toBe(true); // Valid transition, just warning
        expect(result.warnings).toContain(
          'Expected notification type book_submitted but transition does not trigger notifications'
        );
      });

      it('should validate transition without expected notification type', () => {
        const result = validateNotificationForTransition(
          null,
          BookStatusEnum.DRAFT
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('invalid notification types', () => {
      it('should reject invalid notification type', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          'INVALID_NOTIFICATION' as BookNotificationType
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid notification type: INVALID_NOTIFICATION');
      });
    });

    describe('invalid status transitions', () => {
      it('should include transition validation errors', () => {
        const result = validateNotificationForTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.PUBLISHED,
          BookNotificationType.BOOK_PUBLISHED
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid transition from DRAFT to PUBLISHED');
      });

      it('should include status validation errors', () => {
        const result = validateNotificationForTransition(
          'INVALID_STATUS' as BookStatus,
          BookStatusEnum.DRAFT,
          BookNotificationType.BOOK_SUBMITTED
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid previous status: INVALID_STATUS');
      });
    });

    describe('logging', () => {
      it('should log validation results for debugging', () => {
        validateNotificationForTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookNotificationType.BOOK_SUBMITTED
        );

        expect(logger.debug).toHaveBeenCalledWith(
          'Notification validation for transition',
          expect.objectContaining({
            previousStatus: BookStatusEnum.DRAFT,
            newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
            shouldNotify: true,
            actualNotificationType: BookNotificationType.BOOK_SUBMITTED,
            expectedNotificationType: BookNotificationType.BOOK_SUBMITTED,
            isValid: true
          })
        );
      });
    });
  });

  describe('validateEventTypeConfiguration', () => {
    it('should validate complete configuration successfully', () => {
      const result = validateEventTypeConfiguration();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate all book statuses are in enum', () => {
      const result = validateEventTypeConfiguration();
      
      // Should not have errors about missing statuses
      const statusErrors = result.errors.filter(error => 
        error.includes('not found in BookStatusEnum')
      );
      expect(statusErrors).toHaveLength(0);
    });

    it('should validate all notification types are valid', () => {
      const result = validateEventTypeConfiguration();
      
      // Should not have errors about invalid notification types
      const notificationErrors = result.errors.filter(error => 
        error.includes('Invalid notification type in enum')
      );
      expect(notificationErrors).toHaveLength(0);
    });

    it('should validate transition mappings consistency', () => {
      const result = validateEventTypeConfiguration();
      
      // Check that there are no mapping inconsistencies
      const mappingErrors = result.errors.filter(error => 
        error.includes('Error validating transition')
      );
      expect(mappingErrors).toHaveLength(0);
    });

    it('should handle configuration validation errors gracefully', () => {
      // Mock a function to throw an error
      const originalValues = Object.values;
      Object.values = jest.fn().mockImplementation(() => {
        throw new Error('Mock configuration error');
      });

      const result = validateEventTypeConfiguration();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration validation error: Mock configuration error');

      // Restore original function
      Object.values = originalValues;
    });
  });

  describe('integration with event-types module', () => {
    describe('isValidBookStatus', () => {
      it('should validate all enum values as valid', () => {
        const statuses = Object.values(BookStatusEnum);
        statuses.forEach(status => {
          expect(isValidBookStatus(status)).toBe(true);
        });
      });

      it('should reject invalid status', () => {
        expect(isValidBookStatus('INVALID_STATUS' as BookStatus)).toBe(false);
      });
    });

    describe('isValidNotificationType', () => {
      it('should validate all enum values as valid', () => {
        const types = Object.values(BookNotificationType);
        types.forEach(type => {
          expect(isValidNotificationType(type)).toBe(true);
        });
      });

      it('should reject invalid notification type', () => {
        expect(isValidNotificationType('INVALID_TYPE' as BookNotificationType)).toBe(false);
      });
    });

    describe('shouldTriggerNotification', () => {
      it('should trigger notification for submission', () => {
        expect(shouldTriggerNotification(
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING
        )).toBe(true);
      });

      it('should trigger notification for approval', () => {
        expect(shouldTriggerNotification(
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookStatusEnum.READY_FOR_PUBLICATION
        )).toBe(true);
      });

      it('should trigger notification for rejection', () => {
        expect(shouldTriggerNotification(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.SUBMITTED_FOR_EDITING
        )).toBe(true);
      });

      it('should trigger notification for publication', () => {
        expect(shouldTriggerNotification(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.PUBLISHED
        )).toBe(true);
      });

      it('should not trigger notification for draft creation', () => {
        expect(shouldTriggerNotification(null, BookStatusEnum.DRAFT)).toBe(false);
      });

      it('should not trigger notification for staying in same status', () => {
        expect(shouldTriggerNotification(
          BookStatusEnum.DRAFT,
          BookStatusEnum.DRAFT
        )).toBe(false);
      });
    });

    describe('getNotificationTypeForTransition', () => {
      it('should return correct notification type for submission', () => {
        expect(getNotificationTypeForTransition(
          BookStatusEnum.DRAFT,
          BookStatusEnum.SUBMITTED_FOR_EDITING
        )).toBe(BookNotificationType.BOOK_SUBMITTED);
      });

      it('should return correct notification type for approval', () => {
        expect(getNotificationTypeForTransition(
          BookStatusEnum.SUBMITTED_FOR_EDITING,
          BookStatusEnum.READY_FOR_PUBLICATION
        )).toBe(BookNotificationType.BOOK_APPROVED);
      });

      it('should return correct notification type for rejection', () => {
        expect(getNotificationTypeForTransition(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.SUBMITTED_FOR_EDITING
        )).toBe(BookNotificationType.BOOK_REJECTED);
      });

      it('should return correct notification type for publication', () => {
        expect(getNotificationTypeForTransition(
          BookStatusEnum.READY_FOR_PUBLICATION,
          BookStatusEnum.PUBLISHED
        )).toBe(BookNotificationType.BOOK_PUBLISHED);
      });

      it('should return null for non-triggering transitions', () => {
        expect(getNotificationTypeForTransition(
          null,
          BookStatusEnum.DRAFT
        )).toBeNull();
      });
    });
  });

  describe('error scenarios and edge cases', () => {
    it('should handle undefined status values', () => {
      const result = validateStatusTransition(
        undefined as any,
        BookStatusEnum.DRAFT
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid previous status: undefined');
    });

    it('should handle empty string status values', () => {
      const result = validateStatusTransition(
        '' as BookStatus,
        BookStatusEnum.DRAFT
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid previous status: ');
    });

    it('should handle numeric status values', () => {
      const result = validateStatusTransition(
        123 as any,
        BookStatusEnum.DRAFT
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid previous status: 123');
    });

    it('should collect multiple validation errors', () => {
      const result = validateStatusTransition(
        'INVALID_PREVIOUS' as BookStatus,
        'INVALID_NEW' as BookStatus
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors).toContain('Invalid previous status: INVALID_PREVIOUS');
      expect(result.errors).toContain('Invalid new status: INVALID_NEW');
    });

    it('should handle complex notification validation scenarios', () => {
      const result = validateNotificationForTransition(
        'INVALID_PREVIOUS' as BookStatus,
        'INVALID_NEW' as BookStatus,
        'INVALID_NOTIFICATION' as BookNotificationType
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});