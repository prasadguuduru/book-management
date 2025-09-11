#!/usr/bin/env ts-node

/**
 * Test Flexible UUID Validation
 * Tests the new flexible UUID validation patterns
 */

import { validateBookStatusChangeEvent } from '../../events/event-validation';

console.log('🧪 Testing Flexible UUID Validation...\n');

const testCases = [
  {
    name: 'Standard UUID v4',
    eventId: '12345678-1234-4567-8901-123456789012',
    shouldPass: true
  },
  {
    name: 'Test Direct Pattern',
    eventId: 'test-direct-1757260479099',
    shouldPass: true
  },
  {
    name: 'Debug Pattern - Simple',
    eventId: 'debug-123',
    shouldPass: true
  },
  {
    name: 'Debug Pattern - Complex',
    eventId: 'debug-workflow-test-abc123',
    shouldPass: true
  },
  {
    name: 'Invalid Pattern',
    eventId: 'invalid-format-xyz',
    shouldPass: false
  },
  {
    name: 'Empty String',
    eventId: '',
    shouldPass: false
  }
];

const baseEvent = {
  eventType: 'book_status_changed',
  timestamp: '2025-09-07T16:00:00.000Z',
  source: 'debug-script',
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

testCases.forEach((testCase, index) => {
  console.log(`=== TEST ${index + 1}: ${testCase.name} ===`);
  console.log(`Event ID: "${testCase.eventId}"`);
  
  const testEvent = { ...baseEvent, eventId: testCase.eventId };
  const result = validateBookStatusChangeEvent(testEvent);
  
  const passed = result.isValid === testCase.shouldPass;
  const status = passed ? '✅ PASS' : '❌ FAIL';
  
  console.log(`Expected: ${testCase.shouldPass ? 'VALID' : 'INVALID'}`);
  console.log(`Actual: ${result.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`Result: ${status}`);
  
  if (!result.isValid) {
    console.log(`Errors: ${result.errors.join(', ')}`);
  }
  
  console.log('');
});

console.log('🎉 Flexible UUID validation test completed');