#!/usr/bin/env node

/**
 * Script to seed QA environment with test data
 * This ensures QA has the same rich data experience as local development
 */

const AWS = require('aws-sdk');

// QA Environment Configuration
const QA_CONFIG = {
  region: 'us-east-1',
  tableName: 'ebook-platform-data', // Update this to match your QA table name
  // AWS credentials should be set via environment variables or AWS CLI
};

// Configure AWS SDK
AWS.config.update({
  region: QA_CONFIG.region,
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbClient = new AWS.DynamoDB();

// Mock users for QA testing
const mockUsers = [
  {
    PK: 'USER#qa-author-1',
    SK: 'PROFILE',
    entityType: 'USER',
    userId: 'qa-author-1',
    email: 'qa.author@example.com',
    firstName: 'QA',
    lastName: 'Author',
    role: 'AUTHOR',
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    // Hashed password for 'password123'
    passwordHash: '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ'
  },
  {
    PK: 'USER#qa-editor-1',
    SK: 'PROFILE',
    entityType: 'USER',
    userId: 'qa-editor-1',
    email: 'qa.editor@example.com',
    firstName: 'QA',
    lastName: 'Editor',
    role: 'EDITOR',
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    passwordHash: '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ'
  },
  {
    PK: 'USER#qa-publisher-1',
    SK: 'PROFILE',
    entityType: 'USER',
    userId: 'qa-publisher-1',
    email: 'qa.publisher@example.com',
    firstName: 'QA',
    lastName: 'Publisher',
    role: 'PUBLISHER',
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    passwordHash: '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ'
  },
  {
    PK: 'USER#qa-reader-1',
    SK: 'PROFILE',
    entityType: 'USER',
    userId: 'qa-reader-1',
    email: 'qa.reader@example.com',
    firstName: 'QA',
    lastName: 'Reader',
    role: 'READER',
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    passwordHash: '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ'
  }
];

// Mock books for QA testing
const mockBooks = [
  {
    PK: 'BOOK#qa-book-1',
    SK: 'METADATA',
    entityType: 'BOOK',
    bookId: 'qa-book-1',
    authorId: 'qa-author-1',
    title: 'QA Test Book - The Great Adventure',
    description: 'An epic tale of courage and discovery for QA testing.',
    content: 'Chapter 1: The Beginning\n\nIt was a dark and stormy night when our QA adventure began...\n\nThis book contains multiple chapters and serves as test content for the QA environment. It demonstrates the full functionality of the ebook platform including rich text content, proper formatting, and comprehensive storytelling.',
    genre: 'fiction',
    status: 'DRAFT',
    tags: ['qa', 'adventure', 'epic', 'test'],
    wordCount: 1250,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  },
  {
    PK: 'BOOK#qa-book-2',
    SK: 'METADATA',
    entityType: 'BOOK',
    bookId: 'qa-book-2',
    authorId: 'qa-author-1',
    title: 'QA Test Book - Mystery of the Lost Key',
    description: 'A thrilling mystery that will keep QA testers guessing.',
    content: 'Chapter 1: The Discovery\n\nThe old key was found in the QA testing attic, covered in dust and mystery...\n\nThis mystery novel serves as comprehensive test content for the QA environment, featuring complex plot development, character interactions, and the full editorial workflow process.',
    genre: 'mystery',
    status: 'SUBMITTED_FOR_EDITING',
    tags: ['qa', 'mystery', 'thriller', 'test'],
    wordCount: 2100,
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    version: 1
  },
  {
    PK: 'BOOK#qa-book-3',
    SK: 'METADATA',
    entityType: 'BOOK',
    bookId: 'qa-book-3',
    authorId: 'qa-author-1',
    title: 'QA Test Book - Science and Wonder',
    description: 'Exploring the mysteries of the universe for QA validation.',
    content: 'Chapter 1: The Cosmos\n\nIn the beginning of our QA testing universe, there was nothing but potential...\n\nThis science fiction work provides comprehensive test coverage for the publishing platform, including advanced workflow states, publication processes, and reader engagement features.',
    genre: 'science-fiction',
    status: 'READY_FOR_PUBLICATION',
    tags: ['qa', 'science', 'space', 'test'],
    wordCount: 3200,
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    version: 2
  },
  {
    PK: 'BOOK#qa-book-4',
    SK: 'METADATA',
    entityType: 'BOOK',
    bookId: 'qa-book-4',
    authorId: 'qa-author-1',
    title: 'QA Test Book - Published Romance',
    description: 'A heartwarming romance story for testing published book features.',
    content: 'Chapter 1: First Meeting\n\nEmma had never expected to find love in the QA testing department...\n\nThis published romance novel demonstrates the complete user experience for published books, including reader access, review functionality, and public visibility features.',
    genre: 'romance',
    status: 'PUBLISHED',
    tags: ['qa', 'romance', 'published', 'test'],
    wordCount: 4500,
    publishedAt: new Date(Date.now() - 86400000).toISOString(), // Published 1 day ago
    createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    version: 3
  }
];

async function seedData() {
  console.log('🌱 Starting QA data seeding...');
  
  try {
    // Check if table exists
    console.log(`📋 Checking table: ${QA_CONFIG.tableName}`);
    await dynamodbClient.describeTable({ TableName: QA_CONFIG.tableName }).promise();
    console.log('✅ Table exists and is accessible');
    
    // Seed users
    console.log('👥 Seeding users...');
    for (const user of mockUsers) {
      try {
        await dynamodb.put({
          TableName: QA_CONFIG.tableName,
          Item: user,
          ConditionExpression: 'attribute_not_exists(PK)'
        }).promise();
        console.log(`✅ Created user: ${user.email} (${user.role})`);
      } catch (error) {
        if (error.code === 'ConditionalCheckFailedException') {
          console.log(`⚠️  User already exists: ${user.email}`);
        } else {
          console.error(`❌ Error creating user ${user.email}:`, error.message);
        }
      }
    }
    
    // Seed books
    console.log('📚 Seeding books...');
    for (const book of mockBooks) {
      try {
        await dynamodb.put({
          TableName: QA_CONFIG.tableName,
          Item: book,
          ConditionExpression: 'attribute_not_exists(PK)'
        }).promise();
        console.log(`✅ Created book: ${book.title} (${book.status})`);
      } catch (error) {
        if (error.code === 'ConditionalCheckFailedException') {
          console.log(`⚠️  Book already exists: ${book.title}`);
        } else {
          console.error(`❌ Error creating book ${book.title}:`, error.message);
        }
      }
    }
    
    console.log('🎉 QA data seeding completed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('Author: qa.author@example.com / password123');
    console.log('Editor: qa.editor@example.com / password123');
    console.log('Publisher: qa.publisher@example.com / password123');
    console.log('Reader: qa.reader@example.com / password123');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    process.exit(1);
  }
}

// Run the seeding
if (require.main === module) {
  seedData();
}

module.exports = { seedData, mockUsers, mockBooks };