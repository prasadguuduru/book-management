#!/usr/bin/env npx ts-node

/**
 * Test workflow endpoints to see which ones are working
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function testWorkflowEndpoints() {
    console.log('🧪 Testing Workflow Endpoints');
    console.log('='.repeat(60));

    // Create a test book
    const testBookId = `test-workflow-${Date.now()}`;
    const testBook = {
        bookId: testBookId,
        title: 'Test Book for Workflow',
        authorId: 'test-author',
        status: 'draft',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        console.log('\\n1. 📚 Creating test book...');
        await docClient.send(new PutCommand({
            TableName: process.env['BOOKS_TABLE'] || 'qa-ebook-platform-books',
            Item: testBook
        }));
        console.log(`✅ Test book created: ${testBookId}`);

        console.log('\\n2. 🔍 Available workflow endpoints:');
        console.log('   - POST /workflow/books/{bookId}/submit (DRAFT → SUBMITTED_FOR_EDITING)');
        console.log('   - POST /workflow/books/{bookId}/approve (SUBMITTED_FOR_EDITING → READY_FOR_PUBLICATION)');
        console.log('   - POST /workflow/books/{bookId}/reject (READY_FOR_PUBLICATION → SUBMITTED_FOR_EDITING)');
        console.log('   - POST /workflow/books/{bookId}/publish (READY_FOR_PUBLICATION → PUBLISHED)');

        console.log('\\n3. 📋 To test these endpoints manually:');
        console.log('\\n   # Submit for editing (should trigger BOOK_SUBMITTED email)');
        console.log(`   curl -X POST https://your-api-gateway-url/workflow/books/${testBookId}/submit \\\\`);
        console.log('     -H "Content-Type: application/json" \\\\');
        console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\\\');
        console.log('     -d \'{"comments": "Ready for review"}\'');

        console.log('\\n   # Approve for publication (should trigger BOOK_APPROVED email)');
        console.log(`   curl -X POST https://your-api-gateway-url/workflow/books/${testBookId}/approve \\\\`);
        console.log('     -H "Content-Type: application/json" \\\\');
        console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\\\');
        console.log('     -d \'{"comments": "Approved for publication"}\'');

        console.log('\\n   # Publish book (should trigger BOOK_PUBLISHED email)');
        console.log(`   curl -X POST https://your-api-gateway-url/workflow/books/${testBookId}/publish \\\\`);
        console.log('     -H "Content-Type: application/json" \\\\');
        console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\\\');
        console.log('     -d \'{"comments": "Published successfully"}\'');

        console.log('\\n4. 🔍 Check CloudWatch logs after each API call:');
        console.log('   - Look for "🔔 INITIATING EVENT PUBLISHING FOR WORKFLOW TRANSITION"');
        console.log('   - Look for "📤 CALLING EVENT PUBLISHER"');
        console.log('   - Look for "✅ SUCCESSFULLY PUBLISHED BOOK STATUS CHANGE EVENT"');

        console.log('\\n5. 📧 Check notification service logs:');
        console.log('   - Look for "📨 SQS EVENT DETECTED"');
        console.log('   - Look for "✅ EMAIL SENT SUCCESSFULLY"');

        console.log(`\\n🎯 Test book ID: ${testBookId}`);
        console.log('   Use this book ID to test the workflow transitions');

    } catch (error) {
        console.error('❌ Error creating test book:', error);
    }
}

testWorkflowEndpoints().catch(console.error);