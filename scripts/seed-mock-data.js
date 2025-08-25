#!/usr/bin/env node

/**
 * Seed mock data for local development
 */

const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Configure AWS SDK for LocalStack
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  accessKeyId: 'test',
  secretAccessKey: 'test',
});

const TABLE_NAME = 'ebook-platform-data'; // Updated to match config

// Hash password function
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

// Create mock users with hashed passwords
async function createMockUsers() {
  const defaultPassword = 'password123';
  const hashedPassword = await hashPassword(defaultPassword);
  
  return [
    {
      userId: 'author-1',
      email: 'author@example.com',
      firstName: 'John',
      lastName: 'Author',
      role: 'AUTHOR',
      isActive: true,
      emailVerified: true,
      hashedPassword,
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    },
    {
      userId: 'editor-1',
      email: 'editor@example.com',
      firstName: 'Jane',
      lastName: 'Editor',
      role: 'EDITOR',
      isActive: true,
      emailVerified: true,
      hashedPassword,
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    },
    {
      userId: 'publisher-1',
      email: 'publisher@example.com',
      firstName: 'Bob',
      lastName: 'Publisher',
      role: 'PUBLISHER',
      isActive: true,
      emailVerified: true,
      hashedPassword,
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    },
    {
      userId: 'reader-1',
      email: 'reader@example.com',
      firstName: 'Alice',
      lastName: 'Reader',
      role: 'READER',
      isActive: true,
      emailVerified: true,
      hashedPassword,
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    }
  ];
}

const mockBooks = [
  {
    bookId: 'book-1',
    authorId: 'author-1',
    title: 'The Great Adventure',
    description: 'An epic tale of courage and discovery.',
    content: 'Chapter 1: The Beginning\n\nIt was a dark and stormy night...',
    genre: 'fiction',
    status: 'DRAFT',
    tags: ['adventure', 'epic', 'fantasy'],
    wordCount: 1500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  },
  {
    bookId: 'book-2',
    authorId: 'author-1',
    title: 'Science and Technology Today',
    description: 'A comprehensive guide to modern technology.',
    content: 'Chapter 1: Introduction\n\nTechnology has revolutionized our world...',
    genre: 'non-fiction',
    status: 'PUBLISHED',
    tags: ['science', 'technology', 'modern'],
    wordCount: 2500,
    publishedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date().toISOString(),
    version: 1
  }
];

const mockReviews = [
  {
    reviewId: 'review-1',
    bookId: 'book-2',
    userId: 'reader-1',
    rating: 5,
    comment: 'Excellent book! Very informative and well-written.',
    helpful: 3,
    reportCount: 0,
    isModerated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  }
];

async function seedData() {
  console.log('🌱 Seeding mock data...');

  try {
    // Create users with hashed passwords
    console.log('👥 Creating users with hashed passwords...');
    const mockUsers = await createMockUsers();
    
    // Seed users
    console.log('👥 Seeding users...');
    for (const user of mockUsers) {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${user.userId}`,
          SK: 'PROFILE',
          entityType: 'USER',
          ...user
        }
      }).promise();
    }

    // Seed books
    console.log('📚 Seeding books...');
    for (const book of mockBooks) {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          PK: `BOOK#${book.bookId}`,
          SK: 'METADATA',
          GSI1PK: `STATUS#${book.status}`,
          GSI1SK: `BOOK#${book.bookId}`,
          GSI2PK: `GENRE#${book.genre.toUpperCase()}`,
          GSI2SK: `BOOK#${book.bookId}`,
          entityType: 'BOOK',
          ...book
        }
      }).promise();
    }

    // Seed reviews
    console.log('⭐ Seeding reviews...');
    for (const review of mockReviews) {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          PK: `BOOK#${review.bookId}`,
          SK: `REVIEW#${review.reviewId}`,
          entityType: 'REVIEW',
          ...review
        }
      }).promise();
    }

    console.log('✅ Mock data seeded successfully!');
    console.log(`📊 Seeded: ${mockUsers.length} users, ${mockBooks.length} books, ${mockReviews.length} reviews`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedData();
}