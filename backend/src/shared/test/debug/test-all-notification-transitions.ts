#!/usr/bin/env npx ts-node

/**
 * Test all notification transitions to verify which ones are working
 */

import { BookStatus } from '../../types';
import { 
  getNotificationTypeForTransition, 
  shouldTriggerNotification,
  BookNotificationType,
  BookStatusEnum
} from '../../events/event-types';

async function testAllTransitions() {
  console.log('🧪 Testing All Notification Transitions');
  console.log('=' .repeat(60));
  
  const transitions = [
    {
      name: 'Author submits book for editing',
      from: BookStatusEnum.DRAFT,
      to: BookStatusEnum.SUBMITTED_FOR_EDITING,
      expectedNotification: BookNotificationType.BOOK_SUBMITTED
    },
    {
      name: 'Editor approves book for publication',
      from: BookStatusEnum.SUBMITTED_FOR_EDITING,
      to: BookStatusEnum.READY_FOR_PUBLICATION,
      expectedNotification: BookNotificationType.BOOK_APPROVED
    },
    {
      name: 'Publisher publishes book',
      from: BookStatusEnum.READY_FOR_PUBLICATION,
      to: BookStatusEnum.PUBLISHED,
      expectedNotification: BookNotificationType.BOOK_PUBLISHED
    },
    {
      name: 'Editor rejects book (sends back for editing)',
      from: BookStatusEnum.READY_FOR_PUBLICATION,
      to: BookStatusEnum.SUBMITTED_FOR_EDITING,
      expectedNotification: BookNotificationType.BOOK_REJECTED
    }
  ];
  
  console.log('\\n📋 Checking Transition Configuration:');
  console.log('-'.repeat(40));
  
  for (const transition of transitions) {
    const shouldTrigger = shouldTriggerNotification(transition.from, transition.to);
    const notificationType = getNotificationTypeForTransition(transition.from, transition.to);
    
    const status = shouldTrigger && notificationType === transition.expectedNotification ? '✅' : '❌';
    
    console.log(`${status} ${transition.name}`);
    console.log(`   ${transition.from} → ${transition.to}`);
    console.log(`   Should trigger: ${shouldTrigger}`);
    console.log(`   Notification type: ${notificationType}`);
    console.log(`   Expected: ${transition.expectedNotification}`);
    console.log('');
  }
  
  console.log('\\n🎯 Summary:');
  console.log('-'.repeat(40));
  
  const workingTransitions = transitions.filter(t => {
    const shouldTrigger = shouldTriggerNotification(t.from, t.to);
    const notificationType = getNotificationTypeForTransition(t.from, t.to);
    return shouldTrigger && notificationType === t.expectedNotification;
  });
  
  console.log(`✅ Working transitions: ${workingTransitions.length}/${transitions.length}`);
  
  if (workingTransitions.length < transitions.length) {
    console.log('\\n❌ Issues found:');
    transitions.forEach(t => {
      const shouldTrigger = shouldTriggerNotification(t.from, t.to);
      const notificationType = getNotificationTypeForTransition(t.from, t.to);
      if (!shouldTrigger || notificationType !== t.expectedNotification) {
        console.log(`   - ${t.name}: shouldTrigger=${shouldTrigger}, type=${notificationType}`);
      }
    });
  } else {
    console.log('\\n🎉 All transitions are properly configured!');
    console.log('\\nIf you are not receiving emails for some transitions, the issue might be:');
    console.log('1. The workflow service is not triggering those transitions');
    console.log('2. The API endpoints are not calling the workflow service');
    console.log('3. The notification service has validation issues');
  }
}

testAllTransitions().catch(console.error);