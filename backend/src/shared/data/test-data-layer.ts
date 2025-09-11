/**
 * Test script for DynamoDB data access layer
 */

import { dynamoDBClient } from './dynamodb-client';
import { userDAO } from './dao/user-dao';
import { bookDAO } from './dao/book-dao';
import { seedDataService } from './seed-data';
import { accessControlService } from './validation/access-control';
import { logger } from '../utils/logger';
import { RegisterRequest, CreateBookRequest } from '../types';

export class DataLayerTester {
  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    logger.info('Starting data layer tests...');

    try {
      // Test DynamoDB connectivity
      await this.testDynamoDBConnection();

      // Test user operations
      await this.testUserOperations();

      // Test book operations
      await this.testBookOperations();

      // Test access control
      await this.testAccessControl();

      // Test state transitions
      await this.testStateTransitions();

      // Test data seeding
      await this.testDataSeeding();

      logger.info('All data layer tests completed successfully!');
    } catch (error) {
      logger.error('Data layer tests failed:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Test DynamoDB connection
   */
  private async testDynamoDBConnection(): Promise<void> {
    logger.info('Testing DynamoDB connection...');
    
    const isHealthy = await dynamoDBClient.healthCheck();
    if (!isHealthy) {
      throw new Error('DynamoDB health check failed');
    }

    logger.info('✅ DynamoDB connection test passed');
  }

  /**
   * Test user CRUD operations
   */
  private async testUserOperations(): Promise<void> {
    logger.info('Testing user operations...');

    // Test user creation
    const userData: RegisterRequest = {
      email: 'test@example.com',
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'User',
      role: 'AUTHOR',
    };

    const userId = await userDAO.createUser(userData);
    logger.info(`✅ User created: ${userId}`);

    // Test get user by ID
    const user = await userDAO.getUserById(userId);
    if (!user) {
      throw new Error('Failed to retrieve user by ID');
    }
    logger.info(`✅ User retrieved by ID: ${user.email}`);

    // Test get user by email
    const userByEmail = await userDAO.getUserByEmail(userData.email);
    if (!userByEmail || userByEmail.userId !== userId) {
      throw new Error('Failed to retrieve user by email');
    }
    logger.info(`✅ User retrieved by email: ${userByEmail.userId}`);

    // Test password verification
    const isValidPassword = await userDAO.verifyPassword(userId, userData.password);
    if (!isValidPassword) {
      throw new Error('Password verification failed');
    }
    logger.info('✅ Password verification passed');

    // Test user update
    const updatedUser = await userDAO.updateUser(
      userId,
      { firstName: 'Updated', preferences: { notifications: false, theme: 'dark', language: 'es' } },
      user.version
    );
    if (updatedUser.firstName !== 'Updated') {
      throw new Error('User update failed');
    }
    logger.info('✅ User update passed');

    // Test user permissions
    const permissions = userDAO.getUserPermissions('AUTHOR');
    if (permissions.length === 0) {
      throw new Error('Failed to get user permissions');
    }
    logger.info(`✅ User permissions retrieved: ${permissions.length} permissions`);

    logger.info('✅ All user operations tests passed');
  }

  /**
   * Test book CRUD operations
   */
  private async testBookOperations(): Promise<void> {
    logger.info('Testing book operations...');

    // First create a test author
    const authorData: RegisterRequest = {
      email: 'bookauthor@example.com',
      password: 'password123',
      firstName: 'Book',
      lastName: 'Author',
      role: 'AUTHOR',
    };

    const authorId = await userDAO.createUser(authorData);

    // Test book creation
    const bookData: CreateBookRequest = {
      title: 'Test Book',
      description: 'A test book for validation',
      content: 'This is the content of the test book. It contains multiple sentences to test word count calculation.',
      genre: 'fiction',
      tags: ['test', 'fiction', 'sample'],
    };

    const bookId = await bookDAO.createBook(authorId, bookData);
    logger.info(`✅ Book created: ${bookId}`);

    // Test get book by ID
    const book = await bookDAO.getBookById(bookId);
    if (!book) {
      throw new Error('Failed to retrieve book by ID');
    }
    if (book.wordCount === 0) {
      throw new Error('Word count calculation failed');
    }
    logger.info(`✅ Book retrieved by ID: ${book.title} (${book.wordCount} words)`);

    // Test book update
    const updatedBook = await bookDAO.updateBook(
      bookId,
      { title: 'Updated Test Book', description: 'Updated description' },
      book.version,
      authorId
    );
    if (updatedBook.title !== 'Updated Test Book') {
      throw new Error('Book update failed');
    }
    logger.info('✅ Book update passed');

    // Test get books by status
    const draftBooks = await bookDAO.getBooksByStatus('DRAFT');
    if (draftBooks.books.length === 0) {
      throw new Error('Failed to get books by status');
    }
    logger.info(`✅ Books by status retrieved: ${draftBooks.books.length} draft books`);

    // Test get books by genre
    const fictionBooks = await bookDAO.getBooksByGenre('fiction');
    if (fictionBooks.books.length === 0) {
      throw new Error('Failed to get books by genre');
    }
    logger.info(`✅ Books by genre retrieved: ${fictionBooks.books.length} fiction books`);

    // Test get books by author
    const authorBooks = await bookDAO.getBooksByAuthor(authorId);
    if (authorBooks.books.length === 0) {
      throw new Error('Failed to get books by author');
    }
    logger.info(`✅ Books by author retrieved: ${authorBooks.books.length} books`);

    logger.info('✅ All book operations tests passed');
  }

  /**
   * Test access control
   */
  private async testAccessControl(): Promise<void> {
    logger.info('Testing access control...');

    // Test author permissions
    const canAuthorCreateBooks = accessControlService.hasPermission(
      { userId: 'author1', userRole: 'AUTHOR' },
      'books',
      'create'
    );
    if (!canAuthorCreateBooks) {
      throw new Error('Author should be able to create books');
    }
    logger.info('✅ Author can create books');

    // Test reader permissions on published books
    const canReaderReadPublished = accessControlService.hasPermission(
      { userId: 'reader1', userRole: 'READER', resourceState: 'PUBLISHED' },
      'books',
      'read'
    );
    if (!canReaderReadPublished) {
      throw new Error('Reader should be able to read published books');
    }
    logger.info('✅ Reader can read published books');

    // Test reader cannot read draft books
    const canReaderReadDraft = accessControlService.hasPermission(
      { userId: 'reader1', userRole: 'READER', resourceState: 'DRAFT' },
      'books',
      'read'
    );
    if (canReaderReadDraft) {
      throw new Error('Reader should not be able to read draft books');
    }
    logger.info('✅ Reader cannot read draft books');

    // Test ownership-based access
    const canAuthorEditOwnBook = accessControlService.hasPermission(
      { 
        userId: 'author1', 
        userRole: 'AUTHOR', 
        resourceOwnerId: 'author1', 
        resourceState: 'DRAFT' 
      },
      'books',
      'update'
    );
    if (!canAuthorEditOwnBook) {
      throw new Error('Author should be able to edit own draft books');
    }
    logger.info('✅ Author can edit own draft books');

    // Test author cannot edit others' books
    const canAuthorEditOthersBook = accessControlService.hasPermission(
      { 
        userId: 'author1', 
        userRole: 'AUTHOR', 
        resourceOwnerId: 'author2', 
        resourceState: 'DRAFT' 
      },
      'books',
      'update'
    );
    if (canAuthorEditOthersBook) {
      throw new Error('Author should not be able to edit others\' books');
    }
    logger.info('✅ Author cannot edit others\' books');

    // Test user capabilities
    const authorCapabilities = accessControlService.getUserCapabilities('AUTHOR');
    if (!authorCapabilities.canCreateBooks) {
      throw new Error('Author capabilities should include creating books');
    }
    logger.info('✅ User capabilities working correctly');

    logger.info('✅ All access control tests passed');
  }

  /**
   * Test state transitions
   */
  private async testStateTransitions(): Promise<void> {
    logger.info('Testing state transitions...');

    // Test valid transitions
    const canAuthorSubmit = accessControlService.canTransitionBookState('AUTHOR', 'DRAFT', 'SUBMITTED_FOR_EDITING');
    if (!canAuthorSubmit) {
      throw new Error('Author should be able to submit draft for editing');
    }
    logger.info('✅ Author can submit draft for editing');

    const canEditorApprove = accessControlService.canTransitionBookState('EDITOR', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION');
    if (!canEditorApprove) {
      throw new Error('Editor should be able to approve submitted book');
    }
    logger.info('✅ Editor can approve submitted book');

    const canPublisherPublish = accessControlService.canTransitionBookState('PUBLISHER', 'READY_FOR_PUBLICATION', 'PUBLISHED');
    if (!canPublisherPublish) {
      throw new Error('Publisher should be able to publish ready book');
    }
    logger.info('✅ Publisher can publish ready book');

    // Test invalid transitions
    const canAuthorPublish = accessControlService.canTransitionBookState('AUTHOR', 'DRAFT', 'PUBLISHED');
    if (canAuthorPublish) {
      throw new Error('Author should not be able to directly publish draft');
    }
    logger.info('✅ Author cannot directly publish draft');

    const canReaderEdit = accessControlService.canTransitionBookState('READER', 'PUBLISHED', 'DRAFT');
    if (canReaderEdit) {
      throw new Error('Reader should not be able to change book state');
    }
    logger.info('✅ Reader cannot change book state');

    // Test get valid transitions
    const authorTransitions = accessControlService.getValidStateTransitions('AUTHOR', 'DRAFT');
    if (!authorTransitions.includes('SUBMITTED_FOR_EDITING')) {
      throw new Error('Author should have submit transition available for draft');
    }
    logger.info(`✅ Valid transitions retrieved: ${authorTransitions.join(', ')}`);

    logger.info('✅ All state transition tests passed');
  }

  /**
   * Test data seeding
   */
  private async testDataSeeding(): Promise<void> {
    logger.info('Testing data seeding...');

    // Test seeding users
    const userIds = await seedDataService.seedUsers();
    if (userIds.size === 0) {
      throw new Error('No users were seeded');
    }
    logger.info(`✅ Seeded ${userIds.size} users`);

    // Test seeding books
    await seedDataService.seedBooks(userIds);
    logger.info('✅ Books seeded successfully');

    // Verify seeded data
    const publishedBooks = await bookDAO.getPublishedBooks(10);
    if (publishedBooks.books.length === 0) {
      logger.warn('No published books found after seeding');
    } else {
      logger.info(`✅ Found ${publishedBooks.books.length} published books after seeding`);
    }

    // Test generating random books
    const authorEmails = Array.from(userIds.keys()).filter(email => email.includes('author'));
    if (authorEmails.length > 0) {
      await seedDataService.generateRandomBooks(3, authorEmails);
      logger.info('✅ Random books generated successfully');
    }

    logger.info('✅ All data seeding tests passed');
  }

  /**
   * Test book workflow end-to-end
   */
  async testBookWorkflow(): Promise<void> {
    logger.info('Testing complete book workflow...');

    // Create test users
    const authorData: RegisterRequest = {
      email: 'workflow.author@example.com',
      password: 'password123',
      firstName: 'Workflow',
      lastName: 'Author',
      role: 'AUTHOR',
    };

    const editorData: RegisterRequest = {
      email: 'workflow.editor@example.com',
      password: 'password123',
      firstName: 'Workflow',
      lastName: 'Editor',
      role: 'EDITOR',
    };

    const publisherData: RegisterRequest = {
      email: 'workflow.publisher@example.com',
      password: 'password123',
      firstName: 'Workflow',
      lastName: 'Publisher',
      role: 'PUBLISHER',
    };

    const authorId = await userDAO.createUser(authorData);
    const editorId = await userDAO.createUser(editorData);
    const publisherId = await userDAO.createUser(publisherData);

    // Create book
    const bookData: CreateBookRequest = {
      title: 'Workflow Test Book',
      description: 'A book to test the complete workflow',
      content: 'This is a test book that will go through the complete publishing workflow.',
      genre: 'fiction',
      tags: ['test', 'workflow'],
    };

    const bookId = await bookDAO.createBook(authorId, bookData);
    let book = await bookDAO.getBookById(bookId);
    if (!book || book.status !== 'DRAFT') {
      throw new Error('Book should start in DRAFT status');
    }
    logger.info('✅ Book created in DRAFT status');

    // Author submits for editing
    book = await bookDAO.updateBookStatus(bookId, 'SUBMITTED_FOR_EDITING', 'AUTHOR', authorId, book.version);
    if (book.status !== 'SUBMITTED_FOR_EDITING') {
      throw new Error('Book should be in SUBMITTED_FOR_EDITING status');
    }
    logger.info('✅ Book submitted for editing');

    // Editor approves for publication
    book = await bookDAO.updateBookStatus(bookId, 'READY_FOR_PUBLICATION', 'EDITOR', editorId, book.version);
    if (book.status !== 'READY_FOR_PUBLICATION') {
      throw new Error('Book should be in READY_FOR_PUBLICATION status');
    }
    logger.info('✅ Book approved for publication');

    // Publisher publishes book
    book = await bookDAO.updateBookStatus(bookId, 'PUBLISHED', 'PUBLISHER', publisherId, book.version);
    if (book.status !== 'PUBLISHED' || !book.publishedAt) {
      throw new Error('Book should be PUBLISHED with publishedAt timestamp');
    }
    logger.info('✅ Book published successfully');

    logger.info('✅ Complete book workflow test passed');
  }

  /**
   * Performance test
   */
  async performanceTest(): Promise<void> {
    logger.info('Running performance tests...');

    const startTime = Date.now();

    // Test batch operations
    const users: RegisterRequest[] = [];
    for (let i = 0; i < 10; i++) {
      users.push({
        email: `perf.user${i}@example.com`,
        password: 'password123',
        firstName: `User${i}`,
        lastName: 'Performance',
        role: 'AUTHOR',
      });
    }

    // Create users in parallel
    const userPromises = users.map(userData => userDAO.createUser(userData));
    const userIds = await Promise.all(userPromises);

    const userCreationTime = Date.now() - startTime;
    logger.info(`✅ Created ${userIds.length} users in ${userCreationTime}ms`);

    // Test book queries
    const queryStartTime = Date.now();
    const [draftBooks, fictionBooks, publishedBooks] = await Promise.all([
      bookDAO.getBooksByStatus('DRAFT', 50),
      bookDAO.getBooksByGenre('fiction', 50),
      bookDAO.getPublishedBooks(50),
    ]);

    const queryTime = Date.now() - queryStartTime;
    logger.info(`✅ Executed 3 parallel queries in ${queryTime}ms`);
    logger.info(`   - Draft books: ${draftBooks.books.length}`);
    logger.info(`   - Fiction books: ${fictionBooks.books.length}`);
    logger.info(`   - Published books: ${publishedBooks.books.length}`);

    const totalTime = Date.now() - startTime;
    logger.info(`✅ Performance test completed in ${totalTime}ms`);
  }
}

// Export for use in other modules
export const dataLayerTester = new DataLayerTester();