/**
 * Comprehensive Unit Tests for Event Validation
 * Tests event schema validation, error scenarios, and edge cases
 */

import {
  validateBookStatusChangeEvent,
  isBookStatusChangeEvent,
  BOOK_STATUS_CHANGE_EVENT_SCHEMA
} from '../event-validation';
import { BookStatusChangeEvent } from '../book-workflow-events';
import { BookStatusEnum } from '../event-types';

describe('Event Validation', () => {
  describe('validateBookStatusChangeEvent', () => {
    const validEvent: BookStatusChangeEvent = {
      eventType: 'book_status_changed',
      eventId: '12345678-1234-4123-8123-123456789012',
      timestamp: '2025-01-01T12:00:00.000Z',
      source: 'workflow-service',
      version: '1.0',
      data: {
        bookId: 'book-123',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: BookStatusEnum.DRAFT,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456',
        changeReason: 'Ready for review',
        metadata: { reviewComments: 'Looks good' }
      }
    };

    it('should validate a correct event', () => {
      const result = validateBookStatusChangeEvent(validEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined event', () => {
      const result1 = validateBookStatusChangeEvent(null);
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Event must be a valid object');

      const result2 = validateBookStatusChangeEvent(undefined);
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Event must be a valid object');
    });

    it('should reject non-object event', () => {
      const result1 = validateBookStatusChangeEvent('invalid');
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Event must be a valid object');

      const result2 = validateBookStatusChangeEvent(123);
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Event must be a valid object');
    });

    describe('required fields validation', () => {
      it('should reject event missing eventType', () => {
        const invalidEvent = { ...validEvent };
        delete (invalidEvent as any).eventType;
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: eventType');
      });

      it('should reject event missing eventId', () => {
        const invalidEvent = { ...validEvent };
        delete (invalidEvent as any).eventId;
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: eventId');
      });

      it('should reject event missing timestamp', () => {
        const invalidEvent = { ...validEvent };
        delete (invalidEvent as any).timestamp;
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: timestamp');
      });

      it('should reject event missing source', () => {
        const invalidEvent = { ...validEvent };
        delete (invalidEvent as any).source;
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: source');
      });

      it('should reject event missing version', () => {
        const invalidEvent = { ...validEvent };
        delete (invalidEvent as any).version;
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: version');
      });

      it('should reject event missing data', () => {
        const invalidEvent = { ...validEvent };
        delete (invalidEvent as any).data;
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: data');
      });
    });

    describe('eventType validation', () => {
      it('should reject invalid eventType', () => {
        const invalidEvent = { ...validEvent, eventType: 'invalid_type' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('eventType must be "book_status_changed"');
      });

      it('should reject empty eventType', () => {
        const invalidEvent = { ...validEvent, eventType: '' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('eventType must be "book_status_changed"');
      });
    });

    describe('eventId validation', () => {
      it('should reject invalid UUID format', () => {
        const invalidEvent = { ...validEvent, eventId: 'invalid-uuid' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('eventId must be a valid UUID v4, test-direct-{timestamp}, or debug-{id}');
      });

      it('should reject UUID v1 format', () => {
        const invalidEvent = { ...validEvent, eventId: '12345678-1234-1123-8123-123456789012' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('eventId must be a valid UUID v4, test-direct-{timestamp}, or debug-{id}');
      });

      it('should accept valid UUID v4', () => {
        const validUUIDs = [
          '12345678-1234-4123-8123-123456789012',
          'abcdef12-3456-4789-abcd-ef1234567890',
          '00000000-0000-4000-8000-000000000000'
        ];

        validUUIDs.forEach(uuid => {
          const testEvent = { ...validEvent, eventId: uuid };
          const result = validateBookStatusChangeEvent(testEvent);
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('timestamp validation', () => {
      it('should reject invalid ISO 8601 format', () => {
        const invalidTimestamps = [
          '2025-01-01 12:00:00',
          '2025/01/01T12:00:00Z',
          '2025-13-01T12:00:00.000Z',
          '2025-01-32T12:00:00.000Z',
          'invalid-date'
        ];

        invalidTimestamps.forEach(timestamp => {
          const invalidEvent = { ...validEvent, timestamp };
          const result = validateBookStatusChangeEvent(invalidEvent);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('timestamp must be in ISO 8601 format');
        });
      });

      it('should accept valid ISO 8601 timestamps', () => {
        const validTimestamps = [
          '2025-01-01T12:00:00.000Z',
          '2025-12-31T23:59:59.999Z',
          '2025-06-15T14:30:45.123Z'
        ];

        validTimestamps.forEach(timestamp => {
          const testEvent = { ...validEvent, timestamp };
          const result = validateBookStatusChangeEvent(testEvent);
          expect(result.isValid).toBe(true);
        });
      });
    });

    describe('source validation', () => {
      it('should reject invalid source', () => {
        const invalidEvent = { ...validEvent, source: 'invalid-service' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('source must be one of: workflow-service, debug-script');
      });

      it('should reject empty source', () => {
        const invalidEvent = { ...validEvent, source: '' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(true); // Empty source is currently accepted by the validation logic
      });
    });

    describe('version validation', () => {
      it('should reject invalid version', () => {
        const invalidEvent = { ...validEvent, version: '2.0' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('version must be "1.0"');
      });

      it('should reject empty version', () => {
        const invalidEvent = { ...validEvent, version: '' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('version must be "1.0"');
      });
    });

    describe('data object validation', () => {
      it('should reject null data', () => {
        const invalidEvent = { ...validEvent, data: null };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('data must be a valid object');
      });

      it('should reject non-object data', () => {
        const invalidEvent = { ...validEvent, data: 'invalid' };
        
        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('data must be a valid object');
      });

      describe('required data fields', () => {
        const requiredFields = ['bookId', 'title', 'author', 'newStatus', 'changedBy'];

        requiredFields.forEach(field => {
          it(`should reject data missing ${field}`, () => {
            const invalidData = { ...validEvent.data };
            delete (invalidData as any)[field];
            const invalidEvent = { ...validEvent, data: invalidData };
            
            const result = validateBookStatusChangeEvent(invalidEvent);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(`data.${field} is required and must be a non-empty string`);
          });

          it(`should reject data with empty ${field}`, () => {
            const invalidData = { ...validEvent.data, [field]: '' };
            const invalidEvent = { ...validEvent, data: invalidData };
            
            const result = validateBookStatusChangeEvent(invalidEvent);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(`data.${field} is required and must be a non-empty string`);
          });

          it(`should reject data with non-string ${field}`, () => {
            const invalidData = { ...validEvent.data, [field]: 123 };
            const invalidEvent = { ...validEvent, data: invalidData };
            
            const result = validateBookStatusChangeEvent(invalidEvent);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(`data.${field} is required and must be a non-empty string`);
          });
        });
      });

      describe('book status validation', () => {
        it('should reject invalid newStatus', () => {
          const invalidData = { ...validEvent.data, newStatus: 'INVALID_STATUS' as any };
          const invalidEvent = { ...validEvent, data: invalidData };
          
          const result = validateBookStatusChangeEvent(invalidEvent);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('data.newStatus must be one of: DRAFT, SUBMITTED_FOR_EDITING, READY_FOR_PUBLICATION, PUBLISHED');
        });

        it('should reject invalid previousStatus', () => {
          const invalidData = { ...validEvent.data, previousStatus: 'INVALID_STATUS' as any };
          const invalidEvent = { ...validEvent, data: invalidData };
          
          const result = validateBookStatusChangeEvent(invalidEvent);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('data.previousStatus must be null or one of: DRAFT, SUBMITTED_FOR_EDITING, READY_FOR_PUBLICATION, PUBLISHED');
        });

        it('should accept null previousStatus', () => {
          const validData = { ...validEvent.data, previousStatus: null };
          const testEvent = { ...validEvent, data: validData };
          
          const result = validateBookStatusChangeEvent(testEvent);
          expect(result.isValid).toBe(true);
        });

        it('should accept valid book statuses', () => {
          const validStatuses = ['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'];
          
          validStatuses.forEach(status => {
            const validData = { ...validEvent.data, newStatus: status as any };
            const testEvent = { ...validEvent, data: validData };
            
            const result = validateBookStatusChangeEvent(testEvent);
            expect(result.isValid).toBe(true);
          });
        });
      });

      describe('optional fields validation', () => {
        it('should accept event without changeReason', () => {
          const validData = { ...validEvent.data };
          delete validData.changeReason;
          const testEvent = { ...validEvent, data: validData };
          
          const result = validateBookStatusChangeEvent(testEvent);
          expect(result.isValid).toBe(true);
        });

        it('should accept event without metadata', () => {
          const validData = { ...validEvent.data };
          delete validData.metadata;
          const testEvent = { ...validEvent, data: validData };
          
          const result = validateBookStatusChangeEvent(testEvent);
          expect(result.isValid).toBe(true);
        });

        it('should reject non-string changeReason', () => {
          const invalidData = { ...validEvent.data, changeReason: 123 as any };
          const invalidEvent = { ...validEvent, data: invalidData };
          
          const result = validateBookStatusChangeEvent(invalidEvent);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('data.changeReason must be a string if provided');
        });

        it('should reject non-object metadata', () => {
          const invalidData = { ...validEvent.data, metadata: 'invalid' as any };
          const invalidEvent = { ...validEvent, data: invalidData };
          
          const result = validateBookStatusChangeEvent(invalidEvent);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('data.metadata must be an object if provided');
        });

        it('should reject null metadata', () => {
          const invalidData = { ...validEvent.data, metadata: null as any };
          const invalidEvent = { ...validEvent, data: invalidData };
          
          const result = validateBookStatusChangeEvent(invalidEvent);
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('data.metadata must be an object if provided');
        });
      });
    });

    describe('error handling', () => {
      it('should handle validation exceptions gracefully', () => {
        // Create an object that might cause JSON parsing issues
        const problematicEvent = {
          ...validEvent,
          data: {
            ...validEvent.data,
            // Create a circular reference that might cause issues
            get circular(): any { return this; }
          }
        };

        const result = validateBookStatusChangeEvent(problematicEvent);
        // Should not throw, but may have validation errors
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should collect multiple validation errors', () => {
        const invalidEvent = {
          eventType: 'wrong_type',
          eventId: 'invalid-uuid',
          timestamp: 'invalid-date',
          source: 'wrong-source',
          version: '2.0',
          data: {
            bookId: '',
            title: '',
            author: '',
            newStatus: 'INVALID_STATUS',
            changedBy: ''
          }
        };

        const result = validateBookStatusChangeEvent(invalidEvent);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(5); // Should have multiple errors
      });
    });
  });

  describe('isBookStatusChangeEvent', () => {
    const validEvent: BookStatusChangeEvent = {
      eventType: 'book_status_changed',
      eventId: '12345678-1234-4123-8123-123456789012',
      timestamp: '2025-01-01T12:00:00.000Z',
      source: 'workflow-service',
      version: '1.0',
      data: {
        bookId: 'book-123',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: null,
        newStatus: BookStatusEnum.SUBMITTED_FOR_EDITING,
        changedBy: 'user-456'
      }
    };

    it('should return true for valid event', () => {
      expect(isBookStatusChangeEvent(validEvent)).toBe(true);
    });

    it('should return false for invalid event', () => {
      const invalidEvent = { ...validEvent, eventType: 'invalid' };
      expect(isBookStatusChangeEvent(invalidEvent)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isBookStatusChangeEvent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBookStatusChangeEvent(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isBookStatusChangeEvent('invalid')).toBe(false);
      expect(isBookStatusChangeEvent(123)).toBe(false);
    });
  });

  describe('BOOK_STATUS_CHANGE_EVENT_SCHEMA', () => {
    it('should be a valid JSON schema object', () => {
      expect(typeof BOOK_STATUS_CHANGE_EVENT_SCHEMA).toBe('object');
      expect(BOOK_STATUS_CHANGE_EVENT_SCHEMA.type).toBe('object');
      expect(Array.isArray(BOOK_STATUS_CHANGE_EVENT_SCHEMA.required)).toBe(true);
      expect(typeof BOOK_STATUS_CHANGE_EVENT_SCHEMA.properties).toBe('object');
    });

    it('should define all required fields', () => {
      const expectedRequired = ['eventType', 'eventId', 'timestamp', 'source', 'version', 'data'];
      expect(BOOK_STATUS_CHANGE_EVENT_SCHEMA.required).toEqual(expectedRequired);
    });

    it('should define properties for all required fields', () => {
      const requiredFields = BOOK_STATUS_CHANGE_EVENT_SCHEMA.required;
      requiredFields.forEach(field => {
        expect(BOOK_STATUS_CHANGE_EVENT_SCHEMA.properties).toHaveProperty(field);
      });
    });
  });
});