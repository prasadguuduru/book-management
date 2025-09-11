#!/usr/bin/env npx tsx

/**
 * List all books in the database to see what's available
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const region = 'us-east-1';
const dynamoClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function listBooks() {
  console.log('📚 Listing All Books');
  console.log('===================');

  try {
    // Scan for all books
    const result = await docClient.send(new ScanCommand({
      TableName: 'qa-ebook-platform-42611dbe',
      FilterExpression: 'begins_with(PK, :bookPrefix)',
      ExpressionAttributeValues: {
        ':bookPrefix': 'BOOK#'
      },
      Limit: 20
    }));

    if (result.Items && result.Items.length > 0) {
      console.log(`✅ Found ${result.Items.length} books:`);
      
      result.Items.forEach((book, index) => {
        console.log(`\n${index + 1}. Book ID: ${book['bookId'] || 'N/A'}`);
        console.log(`   Title: ${book['title'] || 'N/A'}`);
        console.log(`   Status: ${book['status'] || 'N/A'}`);
        console.log(`   Author: ${book['authorId'] || 'N/A'}`);
        console.log(`   Created: ${book['createdAt'] || 'N/A'}`);
        console.log(`   PK: ${book['PK']}`);
        console.log(`   SK: ${book['SK']}`);
      });

      // Look for the specific book ID we're interested in
      const targetBookId = '5ec5066b-3c98-44bc-8c9f-cb62fba6d48f';
      const targetBook = result.Items.find(book => book['bookId'] === targetBookId);
      
      if (targetBook) {
        console.log(`\n🎯 TARGET BOOK FOUND:`);
        console.log(`   Book ID: ${targetBook['bookId']}`);
        console.log(`   Status: ${targetBook['status']}`);
        console.log(`   Can be published: ${targetBook['status'] === 'READY_FOR_PUBLICATION' ? 'YES' : 'NO'}`);
      } else {
        console.log(`\n❌ Target book ${targetBookId} not found in results`);
      }

    } else {
      console.log('❌ No books found in database');
    }

  } catch (error) {
    console.error('❌ Error listing books:', error);
  }
}

// Run the check
listBooks().catch(console.error);