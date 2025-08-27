#!/usr/bin/env node

/**
 * Smart seed script that automatically detects the correct table name
 * Usage: 
 *   node scripts/smart-seed-data.js local   # For LocalStack
 *   node scripts/smart-seed-data.js qa      # For real AWS QA environment
 */

const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');
const path = require('path');

// Get environment from command line argument
const environment = process.argv[2] || 'local';

console.log(`🌱 Seeding comprehensive mock data for environment: ${environment}`);

// Function to get table name from Terraform outputs
function getTableNameFromTerraform() {
  try {
    console.log('🔍 Getting table name from Terraform outputs...');

    // Change to infrastructure directory
    const infraDir = path.join(__dirname, '..', 'infrastructure');
    process.chdir(infraDir);

    // Get terraform output
    const output = execSync('terraform output -json dynamodb_table_name', { encoding: 'utf8' });
    const tableName = JSON.parse(output);

    console.log(`✅ Found table name from Terraform: ${tableName}`);
    return tableName;
  } catch (error) {
    console.log('⚠️  Could not get table name from Terraform, using fallback...');
    console.log('Error:', error.message);
    return null;
  }
}

// Function to get table name with fallback logic
function getTableName(env) {
  // Priority 1: Environment variable
  if (process.env.DYNAMODB_TABLE_NAME) {
    console.log(`✅ Using table name from environment: ${process.env.DYNAMODB_TABLE_NAME}`);
    return process.env.DYNAMODB_TABLE_NAME;
  }

  // Priority 2: Terraform output (for qa environment)
  if (env === 'qa') {
    const terraformTableName = getTableNameFromTerraform();
    if (terraformTableName) {
      return terraformTableName;
    }
  }

  // Priority 3: Environment-specific defaults
  const defaultTableName = env === 'local' ? 'ebook-platform-local' : `${env}-ebook-platform`;
  console.log(`✅ Using default table name for ${env}: ${defaultTableName}`);
  return defaultTableName;
}

// Configure AWS SDK based on environment
function createDynamoDBClient(env) {
  if (env === 'local') {
    console.log('🔧 Configuring for LocalStack...');
    return new AWS.DynamoDB.DocumentClient({
      region: 'us-east-1',
      endpoint: 'http://localhost:4566',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    });
  } else {
    console.log('🔧 Configuring for real AWS...');
    return new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
}

const dynamodb = createDynamoDBClient(environment);

// Hash password function
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

// Create mock users with hashed passwords
async function createMockUsers() {
  const defaultPassword = 'password123';
  const hashedPassword = await hashPassword(defaultPassword);

  // Test users that match the ones previously hardcoded in Lambda
  const testUsers = [
    { email: 'author@test.com', firstName: 'Test', lastName: 'Author', role: 'AUTHOR' },
    { email: 'editor@test.com', firstName: 'Test', lastName: 'Editor', role: 'EDITOR' },
    { email: 'publisher@test.com', firstName: 'Test', lastName: 'Publisher', role: 'PUBLISHER' },
    { email: 'reader@test.com', firstName: 'Test', lastName: 'Reader', role: 'READER' },
    { email: 'author1@example.com', firstName: 'Author', lastName: 'One', role: 'AUTHOR' },
    { email: 'author2@example.com', firstName: 'Author', lastName: 'Two', role: 'AUTHOR' },
    { email: 'editor1@example.com', firstName: 'Editor', lastName: 'One', role: 'EDITOR' },
    { email: 'publisher1@example.com', firstName: 'Publisher', lastName: 'One', role: 'PUBLISHER' },
    { email: 'reader1@example.com', firstName: 'Reader', lastName: 'One', role: 'READER' },
    { email: 'reader2@example.com', firstName: 'Reader', lastName: 'Two', role: 'READER' }
  ];

  // Additional sample users for variety
  const sampleUsers = [
    { email: 'john.author@example.com', firstName: 'John', lastName: 'Author', role: 'AUTHOR' },
    { email: 'jane.editor@example.com', firstName: 'Jane', lastName: 'Editor', role: 'EDITOR' },
    { email: 'bob.publisher@example.com', firstName: 'Bob', lastName: 'Publisher', role: 'PUBLISHER' },
    { email: 'alice.reader@example.com', firstName: 'Alice', lastName: 'Reader', role: 'READER' }
  ];

  const allUsers = [...testUsers, ...sampleUsers];

  return allUsers.map((user, index) => ({
    userId: `user-${index + 1}`,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
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
  }));
}

// Generate comprehensive book data
function generateMockBooks() {
  const bookTemplates = [
    // Fiction Books
    {
      title: 'The Great Adventure',
      description: 'An epic tale of courage and discovery in uncharted lands.',
      content: 'Chapter 1: The Beginning\n\nIt was a dark and stormy night when our hero first set foot on the mysterious island. The waves crashed against the rocky shore, and the wind howled through the ancient trees that seemed to whisper secrets of ages past. Captain Marcus Blackwood had sailed these treacherous waters for twenty years, but nothing had prepared him for what lay ahead on this forsaken piece of land...\n\nChapter 2: The Discovery\n\nAs dawn broke over the island, Marcus discovered ancient ruins covered in strange symbols. The architecture was unlike anything he had seen in his travels across the seven seas...',
      genre: 'fiction',
      status: 'DRAFT',
      tags: ['adventure', 'epic', 'fantasy', 'pirates'],
      wordCount: 4500,
      authorIndex: 0 // author@test.com
    },
    {
      title: 'Shadows of Tomorrow',
      description: 'A dystopian thriller set in a world where memories can be stolen.',
      content: 'Chapter 1: The Memory Thief\n\nIn the year 2087, memories had become the most valuable currency. Elena Rodriguez worked as a Memory Auditor for the Global Memory Bank, but she harbored a dangerous secret - she could see the stolen memories of others...\n\nChapter 2: The Resistance\n\nThe underground movement known as the Rememberers fought to preserve authentic human experiences...',
      genre: 'science-fiction',
      status: 'SUBMITTED_FOR_EDITING',
      tags: ['dystopian', 'thriller', 'sci-fi', 'future'],
      wordCount: 6200,
      authorIndex: 4 // author1@example.com
    },
    {
      title: 'The Enchanted Forest Chronicles',
      description: 'A magical journey through realms where mythical creatures still roam.',
      content: 'Chapter 1: The Portal\n\nLily had always felt different from other children. On her sixteenth birthday, she discovered why when she accidentally opened a portal to the Enchanted Forest, a realm where dragons soared through crystal skies and unicorns grazed in meadows of silver grass...\n\nChapter 2: The Guardian\n\nThe ancient oak tree spoke in whispers only she could understand...',
      genre: 'fantasy',
      status: 'READY_FOR_PUBLICATION',
      tags: ['fantasy', 'magic', 'young-adult', 'adventure'],
      wordCount: 5800,
      authorIndex: 5 // author2@example.com
    },

    // Non-Fiction Books
    {
      title: 'Science and Technology Today',
      description: 'A comprehensive guide to understanding modern technological innovations.',
      content: 'Chapter 1: Introduction\n\nTechnology has revolutionized our world in ways that were unimaginable just a few decades ago. From artificial intelligence to quantum computing, we are living in an era of unprecedented innovation that is reshaping every aspect of human life...\n\nChapter 2: Artificial Intelligence\n\nThe development of AI systems has progressed from simple rule-based programs to sophisticated neural networks capable of learning and adaptation...\n\nChapter 3: Quantum Computing\n\nQuantum computers represent a fundamental shift in how we process information...',
      genre: 'non-fiction',
      status: 'PUBLISHED',
      tags: ['science', 'technology', 'AI', 'quantum', 'innovation'],
      wordCount: 8500,
      authorIndex: 10 // john.author@example.com
    },
    {
      title: 'The Art of Mindful Living',
      description: 'Practical strategies for finding peace and purpose in a chaotic world.',
      content: 'Chapter 1: Understanding Mindfulness\n\nMindfulness is not just a buzzword or a temporary trend. It is an ancient practice that has been scientifically proven to reduce stress, improve focus, and enhance overall well-being...\n\nChapter 2: Daily Practices\n\nIncorporating mindfulness into your daily routine doesn\'t require hours of meditation...',
      genre: 'non-fiction',
      status: 'PUBLISHED',
      tags: ['mindfulness', 'self-help', 'wellness', 'meditation'],
      wordCount: 7200,
      authorIndex: 11 // jane.editor@example.com (acting as author)
    },

    // Mystery Books
    {
      title: 'Mystery of the Lost Library',
      description: 'A thrilling archaeological mystery set in ancient Egypt.',
      content: 'Chapter 1: The Discovery\n\nDr. Sarah Mitchell had spent years searching for the legendary Library of Alexandria\'s lost sister collection. When she finally found the hidden entrance beneath the streets of Cairo, she had no idea what dangers awaited her inside the forgotten chambers...\n\nChapter 2: The Cipher\n\nThe ancient papyrus contained a code that had puzzled scholars for centuries...',
      genre: 'mystery',
      status: 'SUBMITTED_FOR_EDITING',
      tags: ['mystery', 'thriller', 'historical', 'archaeology'],
      wordCount: 6800,
      authorIndex: 4 // author1@example.com
    },
    {
      title: 'The Digital Detective',
      description: 'A cyber-crime thriller featuring a hacker-turned-investigator.',
      content: 'Chapter 1: The Breach\n\nDetective Alex Chen had seen many crimes in her fifteen years on the force, but nothing had prepared her for the complexity of cyber-crime. When the city\'s entire financial network was compromised, she knew she needed help from someone who understood the digital underworld...\n\nChapter 2: The Insider\n\nThe anonymous tip came through encrypted channels...',
      genre: 'mystery',
      status: 'DRAFT',
      tags: ['mystery', 'cyber-crime', 'thriller', 'technology'],
      wordCount: 5400,
      authorIndex: 5 // author2@example.com
    },

    // Romance Books
    {
      title: 'Love in the Digital Age',
      description: 'A modern romance about finding authentic connection in a virtual world.',
      content: 'Chapter 1: The Match\n\nEmma stared at her phone screen, her finger hovering over the "Send Message" button. The dating app had matched her with someone who seemed too good to be true. Little did she know that this simple swipe would change her life forever...\n\nChapter 2: Virtual Reality\n\nTheir first date was in a virtual reality café, where they could be anyone and go anywhere...',
      genre: 'romance',
      status: 'READY_FOR_PUBLICATION',
      tags: ['romance', 'modern', 'technology', 'dating'],
      wordCount: 4900,
      authorIndex: 10 // john.author@example.com
    },
    {
      title: 'Second Chances',
      description: 'A heartwarming story about love, loss, and new beginnings.',
      content: 'Chapter 1: The Return\n\nAfter ten years in New York, Maya returned to her small hometown to settle her grandmother\'s estate. She never expected to run into her high school sweetheart at the local coffee shop, especially not when he was wearing a wedding ring...\n\nChapter 2: Memories\n\nThe old oak tree where they had carved their initials still stood in the town square...',
      genre: 'romance',
      status: 'PUBLISHED',
      tags: ['romance', 'second-chance', 'small-town', 'heartwarming'],
      wordCount: 5600,
      authorIndex: 0 // author@test.com
    }
  ];

  return bookTemplates.map((template, index) => ({
    bookId: `book-${index + 1}`,
    authorId: `user-${template.authorIndex + 1}`,
    title: template.title,
    description: template.description,
    content: template.content,
    genre: template.genre,
    status: template.status,
    tags: template.tags,
    wordCount: template.wordCount,
    ...(template.status === 'PUBLISHED' && { publishedAt: new Date(Date.now() - Math.random() * 2592000000).toISOString() }), // Random publish date within last 30 days
    createdAt: new Date(Date.now() - Math.random() * 7776000000).toISOString(), // Random creation within last 90 days
    updatedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random update within last day
    version: 1
  }));
}

// Generate comprehensive review data
function generateMockReviews() {
  const reviewTemplates = [
    // Reviews for "Science and Technology Today" (book-4, published)
    {
      bookId: 'book-4',
      userId: 'user-4', // reader@test.com
      rating: 5,
      comment: 'Excellent book! Very informative and well-written. The author does a great job explaining complex concepts in simple terms. As someone new to technology, I found this incredibly accessible.',
      helpful: 8
    },
    {
      bookId: 'book-4',
      userId: 'user-9', // reader1@example.com
      rating: 4,
      comment: 'Great overview of current technology trends. Could use more examples and case studies, but overall very comprehensive. The AI chapter was particularly insightful.',
      helpful: 5
    },
    {
      bookId: 'book-4',
      userId: 'user-14', // alice.reader@example.com
      rating: 5,
      comment: 'As someone working in tech, I found this book incredibly relevant and up-to-date. The quantum computing section was especially well-researched. Highly recommend for both beginners and professionals!',
      helpful: 12
    },
    {
      bookId: 'book-4',
      userId: 'user-10', // reader2@example.com
      rating: 3,
      comment: 'Good content but felt a bit dry at times. The technical explanations are accurate but could be more engaging. Still worth reading for the comprehensive coverage.',
      helpful: 2
    },

    // Reviews for "The Art of Mindful Living" (book-5, published)
    {
      bookId: 'book-5',
      userId: 'user-4', // reader@test.com
      rating: 5,
      comment: 'This book changed my life! The practical exercises are easy to follow and the writing is beautiful. I\'ve been practicing the morning routine for a month now and feel so much more centered.',
      helpful: 15
    },
    {
      bookId: 'book-5',
      userId: 'user-9', // reader1@example.com
      rating: 4,
      comment: 'Really helpful for stress management. The chapter on workplace mindfulness was exactly what I needed. Some concepts were repetitive, but overall a solid guide.',
      helpful: 7
    },
    {
      bookId: 'book-5',
      userId: 'user-10', // reader2@example.com
      rating: 5,
      comment: 'Perfect for beginners! I\'ve tried meditation before but never stuck with it. The author\'s approach is so gentle and encouraging. The 5-minute daily practices are perfect for busy schedules.',
      helpful: 9
    },

    // Reviews for "Second Chances" (book-9, published)
    {
      bookId: 'book-9',
      userId: 'user-14', // alice.reader@example.com
      rating: 5,
      comment: 'What a beautiful love story! I couldn\'t put it down. The characters felt so real and the small-town setting was perfectly described. Made me laugh and cry in equal measure.',
      helpful: 11
    },
    {
      bookId: 'book-9',
      userId: 'user-4', // reader@test.com
      rating: 4,
      comment: 'Sweet and heartwarming romance. The second-chance love story was well-developed, though some plot points were predictable. Still enjoyed every page!',
      helpful: 6
    },
    {
      bookId: 'book-9',
      userId: 'user-9', // reader1@example.com
      rating: 5,
      comment: 'Perfect comfort read! The author has a gift for creating characters you care about. The grandmother\'s letters were such a touching addition to the story.',
      helpful: 8
    },
    {
      bookId: 'book-9',
      userId: 'user-10', // reader2@example.com
      rating: 4,
      comment: 'Lovely story with great character development. The pacing was just right and the ending was satisfying without being too neat. Looking forward to more from this author.',
      helpful: 4
    }
  ];

  return reviewTemplates.map((template, index) => ({
    reviewId: `review-${index + 1}`,
    bookId: template.bookId,
    userId: template.userId,
    rating: template.rating,
    comment: template.comment,
    helpful: template.helpful,
    reportCount: 0,
    isModerated: false,
    createdAt: new Date(Date.now() - Math.random() * 2592000000).toISOString(), // Random within last 30 days
    updatedAt: new Date(Date.now() - Math.random() * 2592000000).toISOString(),
    version: 1
  }));
}

// Generate workflow history data
function generateMockWorkflows() {
  const workflows = [];
  const now = Date.now();

  // Workflow for book-2 (Shadows of Tomorrow - SUBMITTED_FOR_EDITING)
  workflows.push({
    bookId: 'book-2',
    fromState: null,
    toState: 'DRAFT',
    actionBy: 'user-5', // author1@example.com
    action: 'CREATE',
    comments: 'Initial book creation',
    timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
  });

  workflows.push({
    bookId: 'book-2',
    fromState: 'DRAFT',
    toState: 'SUBMITTED_FOR_EDITING',
    actionBy: 'user-5', // author1@example.com
    action: 'SUBMIT',
    comments: 'Ready for editorial review. Please focus on pacing in chapters 3-5.',
    timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
  });

  // Workflow for book-3 (The Enchanted Forest Chronicles - READY_FOR_PUBLICATION)
  workflows.push({
    bookId: 'book-3',
    fromState: null,
    toState: 'DRAFT',
    actionBy: 'user-6', // author2@example.com
    action: 'CREATE',
    comments: 'Starting new fantasy series',
    timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
  });

  workflows.push({
    bookId: 'book-3',
    fromState: 'DRAFT',
    toState: 'SUBMITTED_FOR_EDITING',
    actionBy: 'user-6', // author2@example.com
    action: 'SUBMIT',
    comments: 'First book in the series complete. Looking forward to feedback!',
    timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
  });

  workflows.push({
    bookId: 'book-3',
    fromState: 'SUBMITTED_FOR_EDITING',
    toState: 'READY_FOR_PUBLICATION',
    actionBy: 'user-2', // editor@test.com
    action: 'APPROVE',
    comments: 'Excellent work! Minor grammar corrections made. The world-building is fantastic and the characters are well-developed. Ready for publication.',
    timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
  });

  // Workflow for book-4 (Science and Technology Today - PUBLISHED)
  workflows.push({
    bookId: 'book-4',
    fromState: null,
    toState: 'DRAFT',
    actionBy: 'user-11', // john.author@example.com
    action: 'CREATE',
    comments: 'Non-fiction guide to modern technology',
    timestamp: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString() // 20 days ago
  });

  workflows.push({
    bookId: 'book-4',
    fromState: 'DRAFT',
    toState: 'SUBMITTED_FOR_EDITING',
    actionBy: 'user-11', // john.author@example.com
    action: 'SUBMIT',
    comments: 'Comprehensive technology guide ready for review',
    timestamp: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
  });

  workflows.push({
    bookId: 'book-4',
    fromState: 'SUBMITTED_FOR_EDITING',
    toState: 'READY_FOR_PUBLICATION',
    actionBy: 'user-7', // editor1@example.com
    action: 'APPROVE',
    comments: 'Well-researched and clearly written. Technical accuracy verified. Approved for publication.',
    timestamp: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString() // 12 days ago
  });

  workflows.push({
    bookId: 'book-4',
    fromState: 'READY_FOR_PUBLICATION',
    toState: 'PUBLISHED',
    actionBy: 'user-3', // publisher@test.com
    action: 'PUBLISH',
    comments: 'Published successfully. Great addition to our technology series.',
    timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
  });

  return workflows.map((workflow, index) => ({
    ...workflow,
    workflowId: `workflow-${index + 1}`,
    metadata: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ipAddress: '192.168.1.' + (100 + (index % 50)) // Simulated IP addresses
    }
  }));
}

// Generate notification data
function generateMockNotifications() {
  const notifications = [];
  const now = Date.now();

  // Notifications for editors about submissions
  notifications.push({
    notificationId: 'notif-1',
    userId: 'user-2', // editor@test.com
    type: 'BOOK_SUBMITTED',
    title: 'New Book Submission',
    message: 'A new book "Shadows of Tomorrow" has been submitted for editing by author1@example.com',
    data: {
      bookId: 'book-2',
      bookTitle: 'Shadows of Tomorrow',
      authorName: 'Author One',
      submittedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    channels: ['email', 'in-app'],
    deliveryStatus: {
      email: 'delivered',
      inApp: 'read'
    },
    isRead: true,
    createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ttl: Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000) // 30 days from now
  });

  // Notifications for authors about approvals
  notifications.push({
    notificationId: 'notif-2',
    userId: 'user-6', // author2@example.com
    type: 'BOOK_APPROVED',
    title: 'Book Approved for Publication',
    message: 'Your book "The Enchanted Forest Chronicles" has been approved and is ready for publication!',
    data: {
      bookId: 'book-3',
      bookTitle: 'The Enchanted Forest Chronicles',
      editorComments: 'Excellent work! Minor grammar corrections made.',
      approvedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    channels: ['email', 'in-app', 'push'],
    deliveryStatus: {
      email: 'delivered',
      inApp: 'delivered',
      push: 'delivered'
    },
    isRead: false,
    createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ttl: Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000)
  });

  // Notifications for authors about publications
  notifications.push({
    notificationId: 'notif-3',
    userId: 'user-11', // john.author@example.com
    type: 'BOOK_PUBLISHED',
    title: 'Book Published Successfully',
    message: 'Congratulations! Your book "Science and Technology Today" is now live and available to readers.',
    data: {
      bookId: 'book-4',
      bookTitle: 'Science and Technology Today',
      publishedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      publicUrl: '/books/book-4'
    },
    channels: ['email', 'in-app', 'push'],
    deliveryStatus: {
      email: 'delivered',
      inApp: 'read',
      push: 'delivered'
    },
    isRead: true,
    createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    ttl: Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000)
  });

  // Notifications for authors about new reviews
  notifications.push({
    notificationId: 'notif-4',
    userId: 'user-11', // john.author@example.com
    type: 'REVIEW_ADDED',
    title: 'New Review on Your Book',
    message: 'Your book "Science and Technology Today" received a new 5-star review!',
    data: {
      bookId: 'book-4',
      bookTitle: 'Science and Technology Today',
      reviewRating: 5,
      reviewerName: 'Alice Reader',
      reviewSnippet: 'As someone working in tech, I found this book incredibly relevant...'
    },
    channels: ['email', 'in-app'],
    deliveryStatus: {
      email: 'delivered',
      inApp: 'delivered'
    },
    isRead: false,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    ttl: Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000)
  });

  return notifications;
}

async function seedData() {
  // Validate environment argument
  if (!['local', 'qa'].includes(environment)) {
    console.error('❌ Invalid environment. Use "local" or "qa"');
    console.error('Usage: node scripts/smart-seed-data.js [local|qa]');
    process.exit(1);
  }

  // Get the correct table name
  const TABLE_NAME = getTableName(environment);
  console.log(`📊 Using table: ${TABLE_NAME}`);

  try {
    // Verify table exists by trying to scan with limit 1
    console.log('🔍 Verifying table exists...');
    await dynamodb.scan({
      TableName: TABLE_NAME,
      Limit: 1
    }).promise();
    console.log('✅ Table verified successfully');

    // Generate all data
    console.log('📝 Generating comprehensive data sets...');
    const mockUsers = await createMockUsers();
    const mockBooks = generateMockBooks();
    const mockReviews = generateMockReviews();
    const mockWorkflows = generateMockWorkflows();
    const mockNotifications = generateMockNotifications();

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

    // Seed workflow history
    console.log('🔄 Seeding workflow history...');
    for (const workflow of mockWorkflows) {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          PK: `WORKFLOW#${workflow.bookId}`,
          SK: workflow.timestamp,
          entityType: 'WORKFLOW',
          ...workflow
        }
      }).promise();
    }

    // Seed notifications
    console.log('🔔 Seeding notifications...');
    for (const notification of mockNotifications) {
      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${notification.userId}`,
          SK: `NOTIFICATION#${notification.createdAt}`,
          entityType: 'NOTIFICATION',
          ...notification
        }
      }).promise();
    }

    console.log(`✅ Comprehensive mock data seeded successfully to ${environment} environment!`);
    console.log(`📊 Seeded:`);
    console.log(`   👥 ${mockUsers.length} users`);
    console.log(`   📚 ${mockBooks.length} books`);
    console.log(`   ⭐ ${mockReviews.length} reviews`);
    console.log(`   🔄 ${mockWorkflows.length} workflow entries`);
    console.log(`   🔔 ${mockNotifications.length} notifications`);
    console.log('');
    console.log('🔑 Test user credentials (all use password: password123):');
    console.log('   📧 author@test.com (AUTHOR) - Has 2 books');
    console.log('   📧 editor@test.com (EDITOR) - Has pending submissions');
    console.log('   📧 publisher@test.com (PUBLISHER) - Has books to publish');
    console.log('   📧 reader@test.com (READER) - Has written reviews');
    console.log('');
    console.log('📖 Book Status Distribution:');
    const statusCounts = mockBooks.reduce((acc, book) => {
      acc[book.status] = (acc[book.status] || 0) + 1;
      return acc;
    }, {});
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} books`);
    });
    console.log('');
    if (environment === 'local') {
      console.log('💡 You can now remove hardcoded mock users from the Lambda functions!');
    } else {
      console.log(`💡 Data seeded to ${environment} environment. Lambda functions will use real DynamoDB data.`);
    }

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    if (error.code === 'ResourceNotFoundException') {
      if (environment === 'local') {
        console.error('💡 Hint: Make sure to deploy your infrastructure first with: npm run infra:apply:local');
      } else {
        console.error(`💡 Hint: Make sure the ${environment} DynamoDB table exists and you have proper AWS credentials`);
        console.error('   Check: aws sts get-caller-identity');
        console.error(`   Check: aws dynamodb describe-table --table-name ${TABLE_NAME} --region us-east-1`);
      }
    }
    process.exit(1);
  }
}

if (require.main === module) {
  seedData();
}