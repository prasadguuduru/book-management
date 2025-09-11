#!/usr/bin/env ts-node

/**
 * Trigger a real workflow service event with proper SNS configuration
 */

import { WorkflowEventService, initializeWorkflowEventService } from '../../../workflow-service/events/workflow-event-integration';
import { createSNSEventPublisher } from '../../../workflow-service/events/book-event-publisher';
import { Book, BookStatus } from '../../types';

async function triggerRealSNSWorkflowEvent() {
  console.log('🚀 Triggering real workflow service event with SNS...\n');
  
  // Set the required environment variable
  process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  console.log('📋 Environment setup:');
  console.log('  Topic ARN:', process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN']);
  console.log('  AWS Region:', process.env['AWS_REGION'] || 'us-east-1');
  
  // Create a test book
  const testBook: Book = {
    bookId: `test-real-workflow-${Date.now()}`,
    title: 'Real SNS Workflow Test Book',
    authorId: 'test-author-123',
    genre: 'fiction',
    description: 'A test book to trigger real SNS workflow events',
    content: 'Test content for real SNS workflow event testing',
    status: 'DRAFT' as BookStatus,
    tags: ['test', 'workflow', 'sns'],
    wordCount: 150,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  
  console.log('\n📚 Test book:', {
    bookId: testBook.bookId,
    title: testBook.title,
    authorId: testBook.authorId,
    status: testBook.status
  });
  
  try {
    // Create SNS event publisher
    console.log('\n🔧 Creating SNS event publisher...');
    const snsPublisher = createSNSEventPublisher();
    
    // Initialize workflow event service with SNS publisher
    initializeWorkflowEventService(snsPublisher);
    const workflowEventService = new WorkflowEventService(snsPublisher);
    
    console.log('✅ SNS publisher created successfully');
    
    console.log('\n📤 Publishing status change event to SNS...');
    console.log('  From: DRAFT');
    console.log('  To: SUBMITTED_FOR_EDITING');
    console.log('  Changed by: test-user-123');
    
    // Publish a status change event
    await workflowEventService.publishBookStatusChangeEvent(
      testBook,
      'DRAFT',
      'SUBMITTED_FOR_EDITING',
      'test-user-123',
      'Testing real SNS workflow event publishing',
      {
        testRun: true,
        realSNSTest: true,
        timestamp: new Date().toISOString()
      }
    );
    
    console.log('✅ Event published to SNS successfully!');
    console.log('\n⏳ Now check:');
    console.log('  1. SNS topic for the published message');
    console.log('  2. SQS queue for message delivery');
    console.log('  3. Notification service logs for processing');
    console.log('  4. Email delivery or DLQ for failures');
    
    console.log('\n🔍 Expected message format:');
    console.log('  Source: "workflow-service" (not debug-script)');
    console.log('  Event Type: "book_status_changed"');
    console.log(`  Book ID: "${testBook.bookId}"`);
    console.log('  Status: "DRAFT" -> "SUBMITTED_FOR_EDITING"');
    
  } catch (error) {
    console.error('❌ Failed to publish event:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Topic does not exist')) {
        console.log('\n💡 Suggestion: Check if the SNS topic exists and is accessible');
      } else if (error.message.includes('Access Denied')) {
        console.log('\n💡 Suggestion: Check AWS credentials and IAM permissions');
      } else if (error.message.includes('timeout')) {
        console.log('\n💡 Suggestion: Check network connectivity to AWS');
      }
    }
  }
}

async function main() {
  try {
    await triggerRealSNSWorkflowEvent();
    console.log('\n🎉 Test completed');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}