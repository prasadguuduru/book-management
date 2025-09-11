/**
 * Workflow Message Format Test
 * Tests what the actual workflow service is sending to SNS
 */

import { v4 as uuidv4 } from 'uuid';

// Simulate what the workflow service should be sending
function createWorkflowServiceMessage() {
  const eventData = {
    bookId: '9aab3f56-6db1-40fe-b7de-ce5342795b91',
    title: 'new22',
    author: 'test-author-id',
    previousStatus: 'DRAFT',
    newStatus: 'SUBMITTED_FOR_EDITING',
    changedBy: '153b46f6-b563-464f-b1e7-97191aaba4b3',
    changeReason: 'User submitted book for editing',
    metadata: {
      notificationType: 'book_submitted',
      bookGenre: 'Technology',
      bookDescription: 'A test book'
    }
  };

  const event = {
    eventType: 'book_status_changed',
    eventId: uuidv4(), // This should be a valid UUID v4
    timestamp: new Date().toISOString(),
    source: 'workflow-service', // This must be exactly 'workflow-service'
    version: '1.0',
    data: eventData
  };

  return event;
}

// Test the validation logic
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function validateEvent(event: any) {
  const errors: string[] = [];

  // Check required fields
  if (!event.eventType || event.eventType !== 'book_status_changed') {
    errors.push('eventType must be "book_status_changed"');
  }

  if (!event.eventId || !isValidUUID(event.eventId)) {
    errors.push('eventId must be a valid UUID v4');
  }

  if (!event.source || event.source !== 'workflow-service') {
    errors.push('source must be "workflow-service"');
  }

  if (!event.version || event.version !== '1.0') {
    errors.push('version must be "1.0"');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function testWorkflowMessage() {
  console.log('🔍 Testing workflow service message format...');
  
  const message = createWorkflowServiceMessage();
  console.log('\n📋 Generated message:');
  console.log(JSON.stringify(message, null, 2));
  
  const validation = validateEvent(message);
  console.log('\n✅ Validation result:');
  console.log('Valid:', validation.isValid);
  if (!validation.isValid) {
    console.log('Errors:', validation.errors);
  }
  
  // Test the specific event ID from your logs
  console.log('\n🔍 Testing real event ID from logs...');
  const realEventId = '5669ce55-900b-48fb-aefc-0d35a58b7e68';
  console.log('Real event ID:', realEventId);
  console.log('Is valid UUID v4:', isValidUUID(realEventId));
  
  // Create a message with the real event ID
  const realMessage = {
    ...message,
    eventId: realEventId
  };
  
  const realValidation = validateEvent(realMessage);
  console.log('Real message validation:');
  console.log('Valid:', realValidation.isValid);
  if (!realValidation.isValid) {
    console.log('Errors:', realValidation.errors);
  }
}

testWorkflowMessage();