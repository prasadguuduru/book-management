#!/usr/bin/env ts-node

/**
 * Test Enhanced Validation Logging
 * Tests the new detailed logging in event validation and serialization
 */

import { validateBookStatusChangeEvent } from '../../events/event-validation';
import { deserializeBookEvent } from '../../events/event-serialization';

console.log('🧪 Testing Enhanced Validation Logging...\n');

// Test 1: Valid event
console.log('=== TEST 1: Valid Event ===');
const validEvent = {
    eventType: 'book_status_changed',
    eventId: '12345678-1234-4567-8901-123456789012',
    timestamp: '2025-09-07T16:00:00.000Z',
    source: 'workflow-service',
    version: '1.0',
    data: {
        bookId: 'test-book-123',
        title: 'Test Book',
        author: 'Test Author',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING',
        changedBy: 'test-user'
    }
};

const validResult = validateBookStatusChangeEvent(validEvent);
console.log('Valid event result:', validResult);
console.log('');

// Test 2: Invalid event (debug-script source)
console.log('=== TEST 2: Debug Script Source ===');
const debugEvent = {
    eventType: 'book_status_changed',
    eventId: 'test-direct-1757260479099', // Invalid UUID format
    timestamp: '2025-09-07T15:54:39.099Z',
    source: 'debug-script',
    version: '1.0',
    data: {
        bookId: 'test-book-direct',
        title: 'Direct SQS Test Book',
        author: 'debug-author',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED_FOR_EDITING',
        changedBy: 'debug-user',
        metadata: {
            notificationType: 'book_submitted'
        }
    }
};

const debugResult = validateBookStatusChangeEvent(debugEvent);
console.log('Debug event result:', debugResult);
console.log('');

// Test 3: Test deserialization with invalid event
console.log('=== TEST 3: Deserialization Test ===');
try {
    const eventJson = JSON.stringify(debugEvent);
    const deserializedEvent = deserializeBookEvent(eventJson);
    console.log('Deserialization successful:', deserializedEvent.eventId);
} catch (error) {
    console.log('Deserialization failed (expected):', error instanceof Error ? error.message : String(error));
}

console.log('\n🎉 Enhanced validation logging test completed');