#!/usr/bin/env ts-node

import { logger } from '../../utils/logger';
import { getWorkflowEventService } from '../../../workflow-service/events/workflow-event-integration';

async function checkWorkflowEventConfig() {
  console.log('🔍 Checking Workflow Event Configuration...\n');

  // 1. Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`  NODE_ENV: ${process.env['NODE_ENV'] || 'undefined'}`);
  console.log(`  AWS_REGION: ${process.env['AWS_REGION'] || 'undefined'}`);
  console.log(`  BOOK_WORKFLOW_EVENTS_TOPIC_ARN: ${process.env['BOOK_WORKFLOW_EVENTS_TOPIC_ARN'] || 'undefined'}`);
  console.log(`  BOOK_EVENTS_TOPIC_ARN: ${process.env['BOOK_EVENTS_TOPIC_ARN'] || 'undefined'}`);
  console.log(`  LOCALSTACK_ENDPOINT: ${process.env['LOCALSTACK_ENDPOINT'] || 'undefined'}`);

  // 2. Try to initialize the workflow event service
  console.log('\n🔧 Initializing Workflow Event Service:');
  try {
    const workflowEventService = getWorkflowEventService();
    const eventPublisher = workflowEventService.getEventPublisher();
    
    console.log(`✅ Workflow Event Service initialized successfully`);
    console.log(`📤 Event Publisher Type: ${eventPublisher.constructor.name}`);
    
    // 3. Test event publishing with a mock event
    console.log('\n🧪 Testing Event Publishing:');
    
    const testEventData = {
      bookId: 'test-book-123',
      title: 'Test Book',
      author: 'test-author',
      previousStatus: 'SUBMITTED_FOR_EDITING' as any,
      newStatus: 'READY_FOR_PUBLICATION' as any,
      changedBy: 'test-user',
      changeReason: 'Testing event publishing',
      metadata: {
        testMode: true,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`📄 Test Event Data: ${JSON.stringify(testEventData, null, 2)}`);
    
    const publishStartTime = Date.now();
    
    try {
      await workflowEventService.publishBookStatusChangeEvent(
        {
          bookId: testEventData.bookId,
          title: testEventData.title,
          authorId: testEventData.author,
          status: testEventData.newStatus,
          genre: 'Test',
          description: 'Test book for event publishing',
          version: 1
        } as any,
        testEventData.previousStatus,
        testEventData.newStatus,
        testEventData.changedBy,
        testEventData.changeReason,
        testEventData.metadata
      );
      
      const publishDuration = Date.now() - publishStartTime;
      console.log(`✅ Event publishing test completed successfully in ${publishDuration}ms`);
      
    } catch (error) {
      const publishDuration = Date.now() - publishStartTime;
      console.log(`❌ Event publishing test failed after ${publishDuration}ms:`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      
      if (error instanceof Error && error.stack) {
        console.log(`   Stack: ${error.stack}`);
      }
    }

  } catch (error) {
    console.log(`❌ Failed to initialize Workflow Event Service:`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.log(`   Stack: ${error.stack}`);
    }
  }

  // 4. Check what happens during a real approval flow
  console.log('\n💡 Diagnosis:');
  console.log('If the test above works but API approval doesn\'t:');
  console.log('1. Check if the workflow service is actually calling publishBookStatusChangeEvent');
  console.log('2. Check if the .catch() in executeTransition is swallowing errors');
  console.log('3. Check CloudWatch logs for the workflow service during API calls');
  console.log('4. Verify the environment variables are set correctly in the Lambda');
}

// Run the check
checkWorkflowEventConfig().catch(console.error);