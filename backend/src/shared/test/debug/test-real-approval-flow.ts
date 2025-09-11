#!/usr/bin/env ts-node

/**
 * Test the real approval flow to see if events are being published
 * This simulates what happens when the API approval endpoint is called
 */

import { logger } from '../../utils/logger';
import { getWorkflowEventService } from '../../../workflow-service/events/workflow-event-integration';

async function testRealApprovalFlow() {
  console.log('🔍 Testing Real Approval Flow...\n');

  // Simulate the exact data that would be passed during an approval
  const mockBook = {
    bookId: 'test-book-456',
    title: 'Real Test Book',
    authorId: 'author-123',
    status: 'READY_FOR_PUBLICATION' as any,
    genre: 'FICTION' as any,
    description: 'A test book for approval flow testing',
    content: 'Test book content',
    tags: ['test', 'approval'],
    wordCount: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };

  const previousStatus = 'SUBMITTED_FOR_EDITING' as any;
  const newStatus = 'READY_FOR_PUBLICATION' as any;
  const changedBy = 'editor-456';
  const changeReason = 'Book approved after editorial review';
  const metadata = {
    action: 'APPROVE',
    userRole: 'EDITOR',
    userEmail: 'editor@example.com',
    requestId: 'test-request-123',
    reviewComments: 'Excellent work, ready for publication'
  };

  console.log('📋 Approval Flow Data:');
  console.log(`  Book ID: ${mockBook.bookId}`);
  console.log(`  Title: ${mockBook.title}`);
  console.log(`  Status Transition: ${previousStatus} → ${newStatus}`);
  console.log(`  Changed By: ${changedBy}`);
  console.log(`  Change Reason: ${changeReason}`);
  console.log(`  Metadata: ${JSON.stringify(metadata, null, 2)}`);

  try {
    console.log('\n🔧 Getting Workflow Event Service...');
    const workflowEventService = getWorkflowEventService();
    const eventPublisher = workflowEventService.getEventPublisher();
    
    console.log(`📤 Event Publisher Type: ${eventPublisher.constructor.name}`);
    
    if (eventPublisher.constructor.name === 'MockBookEventPublisher') {
      console.log('⚠️  Using MockBookEventPublisher - this means:');
      console.log('   1. BOOK_WORKFLOW_EVENTS_TOPIC_ARN environment variable is not set');
      console.log('   2. Or SNS client initialization failed');
      console.log('   3. This is why events are not reaching SNS in production');
    } else {
      console.log('✅ Using real SNS publisher');
    }

    console.log('\n🚀 Publishing Book Status Change Event...');
    const publishStartTime = Date.now();

    await workflowEventService.publishBookStatusChangeEvent(
      mockBook,
      previousStatus,
      newStatus,
      changedBy,
      changeReason,
      metadata
    );

    const publishDuration = Date.now() - publishStartTime;
    console.log(`✅ Event publishing completed in ${publishDuration}ms`);

    // If using mock publisher, show what would have been published
    if (eventPublisher.constructor.name === 'MockBookEventPublisher') {
      const mockPublisher = eventPublisher as any;
      const publishedEvents = mockPublisher.getPublishedEvents();
      
      console.log('\n📄 Events that would have been published:');
      publishedEvents.forEach((event: any, index: number) => {
        console.log(`  Event ${index + 1}:`);
        console.log(`    Book ID: ${event.bookId}`);
        console.log(`    Title: ${event.title}`);
        console.log(`    Status: ${event.previousStatus} → ${event.newStatus}`);
        console.log(`    Notification Type: ${event.metadata?.notificationType}`);
        console.log(`    Changed By: ${event.changedBy}`);
      });
    }

  } catch (error) {
    console.log(`❌ Error during approval flow test:`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.log(`   Stack: ${error.stack}`);
    }
  }

  console.log('\n💡 Next Steps:');
  console.log('1. If using MockBookEventPublisher, check Lambda environment variables');
  console.log('2. If using real SNS publisher but events not received, check SNS-SQS connectivity');
  console.log('3. Check CloudWatch logs for the workflow service during real API calls');
  console.log('4. Verify the .catch() in executeTransition is not swallowing errors');
}

// Run the test
testRealApprovalFlow().catch(console.error);