#!/usr/bin/env ts-node

/**
 * Test that the deployed fix works
 */

import { WorkflowEventService, initializeWorkflowEventService } from '../../../workflow-service/events/workflow-event-integration';
import { createSNSEventPublisher } from '../../../workflow-service/events/book-event-publisher';
import { Book, BookStatus } from '../../types';

async function testFixDeployment() {
  console.log('🧪 Testing that the deployed fix works...\n');
  
  // Set the required environment variable
  process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'] = 'arn:aws:sns:us-east-1:582491219315:qa-book-workflow-events';
  
  // Create a test book
  const testBook: Book = {
    bookId: `test-fix-deployment-${Date.now()}`,
    title: 'Fix Deployment Test Book',
    authorId: 'test-author-fix',
    genre: 'fiction',
    description: 'Testing that the SNS interface fix is deployed',
    content: 'Test content for fix deployment testing',
    status: 'DRAFT' as BookStatus,
    tags: ['test', 'fix', 'deployment'],
    wordCount: 200,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  
  console.log('📚 Test book:', {
    bookId: testBook.bookId,
    title: testBook.title,
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
    
    console.log('\n📤 Publishing test event to verify fix...');
    
    // Publish a status change event
    await workflowEventService.publishBookStatusChangeEvent(
      testBook,
      'DRAFT',
      'SUBMITTED_FOR_EDITING',
      'test-user-fix',
      'Testing deployed fix for SNS interface',
      {
        testType: 'fix-deployment-test',
        expectedResult: 'successful-processing',
        timestamp: new Date().toISOString()
      }
    );
    
    console.log('✅ Event published successfully!');
    console.log('\n⏳ Wait 30 seconds, then check:');
    console.log('  1. CloudWatch logs for successful processing (no more extraction errors)');
    console.log('  2. Email delivery (should work now)');
    console.log('  3. No new messages in DLQ');
    
    console.log('\n🔍 Expected results after fix:');
    console.log('  ✅ No "Failed to extract event from SNS message" errors');
    console.log('  ✅ No "Failed to deserialize book event" errors');
    console.log('  ✅ Successful email delivery');
    console.log('  ✅ "EMAIL SENT SUCCESSFULLY" in logs');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function main() {
  try {
    await testFixDeployment();
    console.log('\n🎉 Fix deployment test completed');
    console.log('\n💡 Next steps:');
    console.log('  1. Wait 30 seconds');
    console.log('  2. Run: npx ts-node src/test/debug/notification-service-debug.ts');
    console.log('  3. Look for successful email processing in the logs');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}