#!/usr/bin/env npx tsx

/**
 * Check the current status of the book to see if it can be published
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const region = 'us-east-1';
const dynamoClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkBookStatus() {
  console.log('📚 Checking Book Status');
  console.log('======================');

  const bookId = '5ec5066b-3c98-44bc-8c9f-cb62fba6d48f';

  try {
    // Get book from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: 'qa-ebook-platform-42611dbe',
      Key: { 
        PK: `BOOK#${bookId}`,
        SK: `BOOK#${bookId}`
      }
    }));

    if (result.Item) {
      console.log('✅ Book found:');
      console.log(`   Book ID: ${result.Item['bookId']}`);
      console.log(`   Title: ${result.Item['title']}`);
      console.log(`   Current Status: ${result.Item['status']}`);
      console.log(`   Author: ${result.Item['authorId']}`);
      console.log(`   Created: ${result.Item['createdAt']}`);
      console.log(`   Updated: ${result.Item['updatedAt']}`);
      console.log(`   Version: ${result.Item['version']}`);

      // Check if book can be published
      const currentStatus = result.Item['status'];
      console.log('\n🔄 Publish Action Analysis:');
      
      if (currentStatus === 'READY_FOR_PUBLICATION') {
        console.log('✅ Book is READY_FOR_PUBLICATION - PUBLISH action should work');
        console.log('   Expected transition: READY_FOR_PUBLICATION → PUBLISHED');
      } else if (currentStatus === 'PUBLISHED') {
        console.log('⚠️  Book is already PUBLISHED - PUBLISH action will fail');
        console.log('   No valid transition from PUBLISHED status');
      } else if (currentStatus === 'DRAFT') {
        console.log('❌ Book is in DRAFT status - PUBLISH action will fail');
        console.log('   Book needs to be SUBMITTED → APPROVED first');
        console.log('   Required flow: DRAFT → SUBMIT → APPROVE → PUBLISH');
      } else if (currentStatus === 'SUBMITTED_FOR_EDITING') {
        console.log('❌ Book is SUBMITTED_FOR_EDITING - PUBLISH action will fail');
        console.log('   Book needs to be APPROVED first');
        console.log('   Required flow: SUBMITTED_FOR_EDITING → APPROVE → PUBLISH');
      } else {
        console.log(`❓ Unknown status: ${currentStatus}`);
      }

    } else {
      console.log('❌ Book not found in database');
    }

  } catch (error) {
    console.error('❌ Error checking book status:', error);
  }
}

// Run the check
checkBookStatus().catch(console.error);