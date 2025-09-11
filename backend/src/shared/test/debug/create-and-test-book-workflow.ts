#!/usr/bin/env npx tsx

/**
 * Create a book and test the complete workflow with notifications
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const region = 'us-east-1';
const dynamoClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function createTestBook() {
  console.log('📚 Creating Test Book for Workflow');
  console.log('==================================');

  const bookId = uuidv4();
  const authorId = 'user-test';
  const now = new Date().toISOString();

  const book = {
    PK: `BOOK#${bookId}`,
    SK: 'METADATA',
    bookId,
    title: 'Test Book for Notification Workflow',
    description: 'A test book to verify the notification system works',
    authorId,
    status: 'READY_FOR_PUBLICATION', // Set to ready for publication so we can test publish
    createdAt: now,
    updatedAt: now,
    version: 1,
    content: 'This is test content for the notification workflow test.',
    tags: ['test', 'notification', 'workflow']
  };

  try {
    // Create the book
    await docClient.send(new PutCommand({
      TableName: 'qa-ebook-platform-42611dbe',
      Item: book
    }));

    console.log('✅ Test book created successfully:');
    console.log(`   Book ID: ${bookId}`);
    console.log(`   Title: ${book.title}`);
    console.log(`   Status: ${book.status}`);
    console.log(`   Author: ${book.authorId}`);

    // Verify the book was created
    const verification = await docClient.send(new GetCommand({
      TableName: 'qa-ebook-platform-42611dbe',
      Key: {
        PK: `BOOK#${bookId}`,
        SK: 'METADATA'
      }
    }));

    if (verification.Item) {
      console.log('✅ Book verification successful');
      
      console.log('\n🎯 NEXT STEPS:');
      console.log('==============');
      console.log('1. Use this book ID in your frontend to test the publish workflow:');
      console.log(`   Book ID: ${bookId}`);
      console.log('2. The book is already in READY_FOR_PUBLICATION status');
      console.log('3. Publishing should trigger notifications');
      console.log('4. Test URL would be:');
      console.log(`   POST https://d2xg2iv1qaydac.cloudfront.net/api/workflow/books/${bookId}/publish`);

      return bookId;
    } else {
      console.log('❌ Book verification failed');
      return null;
    }

  } catch (error) {
    console.error('❌ Error creating test book:', error);
    return null;
  }
}

// Run the creation
createTestBook().catch(console.error);