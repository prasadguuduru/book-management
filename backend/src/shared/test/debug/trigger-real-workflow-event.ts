#!/usr/bin/env ts-node

/**
 * Trigger a real workflow service event by calling the workflow service directly
 */

import { WorkflowEventService } from '../../../workflow-service/events/workflow-event-integration';
import { Book, BookStatus } from '../../types';

async function triggerWorkflowEvent() {
  console.log('🚀 Triggering real workflow service event...\n');
  
  // Create a test book
  const testBook: Book = {
    bookId: `test-workflow-${Date.now()}`,
    title: 'Real Workflow Test Book',
    authorId: 'test-author-123',
    genre: 'fiction',
    description: 'A test book to trigger workflow events',
    content: 'Test content for workflow event testing',
    status: 'DRAFT' as BookStatus,
    tags: ['test', 'workflow'],
    wordCount: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  
  console.log('📚 Test book:', {
    bookId: testBook.bookId,
    title: testBook.title,
    authorId: testBook.authorId,
    status: testBook.status
  });
  
  try {
    // Initialize workflow event service
    const workflowEventService = new WorkflowEventService();
    
    console.log('\n📤 Publishing status change event...');
    console.log('  From: DRAFT');
    console.log('  To: SUBMITTED_FOR_EDITING');
    console.log('  Changed by: test-user-123');
    
    // Publish a status change event
    await workflowEventService.publishBookStatusChangeEvent(
      testBook,
      'DRAFT',
      'SUBMITTED_FOR_EDITING',
      'test-user-123',
      'Testing workflow event publishing',
      {
        testRun: true,
        timestamp: new Date().toISOString()
      }
    );
    
    console.log('✅ Event published successfully!');
    console.log('\n⏳ Wait a few seconds and then check:');
    console.log('  1. Notification service logs for processing');
    console.log('  2. DLQ for any failed messages');
    console.log('  3. Email delivery (if successful)');
    
  } catch (error) {
    console.error('❌ Failed to publish event:', error);
  }
}

async function main() {
  try {
    await triggerWorkflowEvent();
    console.log('\n🎉 Test completed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}