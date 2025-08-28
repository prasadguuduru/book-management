/**
 * Book Data Access Object with CRUD operations
 */

import { v4 as uuidv4 } from 'uuid';
import { dynamoDBClient } from '../dynamodb-client';
import { BookEntityMapper, BOOK_STATE_TRANSITIONS, STATE_TRANSITION_PERMISSIONS } from '../entities/book-entity';
import { workflowDAO } from './workflow-dao';
import { logger } from '../../utils/logger';
import { Book, BookStatus, BookGenre, CreateBookRequest, UpdateBookRequest, UserRole } from '../../types';

export class BookDAO {
  private client = dynamoDBClient;

  /**
   * Create a new book
   */
  async createBook(authorId: string, bookData: CreateBookRequest): Promise<string> {
    const bookId = uuidv4();
    const now = new Date().toISOString();
    const wordCount = BookEntityMapper.calculateWordCount(bookData.content);

    // Create book domain object
    const book: Book = {
      bookId,
      authorId,
      title: bookData.title,
      description: bookData.description,
      content: bookData.content,
      genre: bookData.genre,
      status: 'DRAFT',
      tags: bookData.tags,
      wordCount,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Convert to DynamoDB entity
    const entity = BookEntityMapper.toDynamoDBEntity(book);

    try {
      await this.client.put(entity, 'attribute_not_exists(PK)');
      
      // Record workflow transition
      await workflowDAO.recordTransition(
        bookId,
        null,
        'DRAFT',
        authorId,
        'CREATE',
        `Book "${bookData.title}" created`
      );
      
      logger.info(`Book created successfully: ${bookId} by author ${authorId}`);
      return bookId;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('Book already exists');
      }
      logger.error('Error creating book:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get book by ID
   */
  async getBookById(bookId: string): Promise<Book | null> {
    try {
      const pk = BookEntityMapper.createPK(bookId);
      const sk = BookEntityMapper.createSK();
      
      const entity = await this.client.get(pk, sk);
      
      if (!entity || !BookEntityMapper.validateEntity(entity)) {
        return null;
      }

      return BookEntityMapper.fromDynamoDBEntity(entity);
    } catch (error) {
      logger.error('Error getting book by ID:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update book content and metadata
   */
  async updateBook(
    bookId: string,
    updates: UpdateBookRequest,
    currentVersion: number,
    authorId?: string
  ): Promise<Book> {
    try {
      const pk = BookEntityMapper.createPK(bookId);
      const sk = BookEntityMapper.createSK();
      const now = new Date().toISOString();

      let updateExpression = 'SET updatedAt = :now, #version = #version + :inc';
      const expressionAttributeValues: any = {
        ':now': now,
        ':currentVersion': currentVersion,
        ':inc': 1,
      };
      const expressionAttributeNames: any = {
        '#version': 'version',
      };

      // Build update expression dynamically
      if (updates.title !== undefined) {
        updateExpression += ', title = :title';
        expressionAttributeValues[':title'] = updates.title;
      }

      if (updates.description !== undefined) {
        updateExpression += ', description = :description';
        expressionAttributeValues[':description'] = updates.description;
      }

      if (updates.content !== undefined) {
        const wordCount = BookEntityMapper.calculateWordCount(updates.content);
        updateExpression += ', content = :content, wordCount = :wordCount';
        expressionAttributeValues[':content'] = updates.content;
        expressionAttributeValues[':wordCount'] = wordCount;
      }

      if (updates.genre !== undefined) {
        updateExpression += ', genre = :genre, GSI2PK = :gsi2pk';
        expressionAttributeValues[':genre'] = updates.genre;
        expressionAttributeValues[':gsi2pk'] = BookEntityMapper.createGSI2PK(updates.genre);
      }

      if (updates.tags !== undefined) {
        updateExpression += ', tags = :tags';
        expressionAttributeValues[':tags'] = updates.tags;
      }

      // Add author ownership check if authorId provided
      let conditionExpression = '#version = :currentVersion';
      if (authorId) {
        conditionExpression += ' AND authorId = :authorId';
        expressionAttributeValues[':authorId'] = authorId;
      }

      const updatedEntity = await this.client.update(
        pk,
        sk,
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames,
        conditionExpression
      );

      if (!BookEntityMapper.validateEntity(updatedEntity)) {
        throw new Error('Invalid updated entity');
      }

      return BookEntityMapper.fromDynamoDBEntity(updatedEntity);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('Book version mismatch or unauthorized access - please refresh and try again');
      }
      logger.error('Error updating book:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update book status with state transition validation
   */
  async updateBookStatus(
    bookId: string,
    newStatus: BookStatus,
    userRole: UserRole,
    userId: string,
    currentVersion: number
  ): Promise<Book> {
    try {
      // First, get the current book to validate transition
      const currentBook = await this.getBookById(bookId);
      if (!currentBook) {
        throw new Error('Book not found');
      }

      // Validate state transition
      if (!this.canTransitionState(currentBook.status, newStatus, userRole)) {
        throw new Error(`Invalid state transition from ${currentBook.status} to ${newStatus} for role ${userRole}`);
      }

      const pk = BookEntityMapper.createPK(bookId);
      const sk = BookEntityMapper.createSK();
      const now = new Date().toISOString();

      let updateExpression = 'SET #status = :newStatus, GSI1PK = :gsi1pk, updatedAt = :now, #version = #version + :inc';
      const expressionAttributeValues: any = {
        ':newStatus': newStatus,
        ':gsi1pk': BookEntityMapper.createGSI1PK(newStatus),
        ':now': now,
        ':currentVersion': currentVersion,
        ':inc': 1,
      };
      const expressionAttributeNames: any = {
        '#status': 'status',
        '#version': 'version',
      };

      // Set publishedAt timestamp when publishing
      if (newStatus === 'PUBLISHED' && currentBook.status !== 'PUBLISHED') {
        updateExpression += ', publishedAt = :publishedAt';
        expressionAttributeValues[':publishedAt'] = now;
      }

      const updatedEntity = await this.client.update(
        pk,
        sk,
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames,
        '#version = :currentVersion'
      );

      if (!BookEntityMapper.validateEntity(updatedEntity)) {
        throw new Error('Invalid updated entity');
      }

      // Record workflow transition
      const action = this.getWorkflowAction(currentBook.status, newStatus);
      await workflowDAO.recordTransition(
        bookId,
        currentBook.status,
        newStatus,
        userId,
        action,
        `Status changed from ${currentBook.status} to ${newStatus} by ${userRole}`
      );

      logger.info(`Book status updated: ${bookId} from ${currentBook.status} to ${newStatus} by ${userRole} ${userId}`);
      
      return BookEntityMapper.fromDynamoDBEntity(updatedEntity);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('Book version mismatch - please refresh and try again');
      }
      logger.error('Error updating book status:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete book (only allowed for drafts by author)
   */
  async deleteBook(bookId: string): Promise<void> {
    try {
      const pk = BookEntityMapper.createPK(bookId);
      const sk = BookEntityMapper.createSK();

      await this.client.delete(pk, sk);

      logger.info(`Book deleted: ${bookId}`);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('Cannot delete book - only draft books can be deleted by their author');
      }
      logger.error('Error deleting book:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get books by status
   */
  async getBooksByStatus(
    status: BookStatus,
    limit: number = 20,
    lastEvaluatedKey?: any
  ): Promise<{ books: Book[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    try {
      const result = await this.client.query(
        'GSI1PK = :status',
        { ':status': BookEntityMapper.createGSI1PK(status) },
        'GSI1',
        undefined,
        undefined,
        limit,
        lastEvaluatedKey,
        false // Most recent first
      );

      const books = result.items
        .filter(item => BookEntityMapper.validateEntity(item))
        .map(entity => BookEntityMapper.fromDynamoDBEntity(entity));

      return {
        books,
        lastEvaluatedKey: result.lastEvaluatedKey,
        hasMore: !!result.lastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Error getting books by status:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get books by genre
   */
  async getBooksByGenre(
    genre: BookGenre,
    limit: number = 20,
    lastEvaluatedKey?: any
  ): Promise<{ books: Book[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    try {
      const result = await this.client.query(
        'GSI2PK = :genre',
        { ':genre': BookEntityMapper.createGSI2PK(genre) },
        'GSI2',
        undefined,
        undefined,
        limit,
        lastEvaluatedKey,
        false // Most recent first
      );

      const books = result.items
        .filter(item => BookEntityMapper.validateEntity(item))
        .map(entity => BookEntityMapper.fromDynamoDBEntity(entity));

      return {
        books,
        lastEvaluatedKey: result.lastEvaluatedKey,
        hasMore: !!result.lastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Error getting books by genre:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get books by author
   */
  async getBooksByAuthor(
    limit: number = 20,
    lastEvaluatedKey?: any
  ): Promise<{ books: Book[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    try {
      // This would require a GSI on authorId in production
      // For now, we'll use a scan with filter expression (less efficient)
      const result = await this.client.scan(
        'begins_with(PK, :pk)',
        { ':pk': 'BOOK#' },
        undefined,
        undefined,
        limit,
        lastEvaluatedKey
      );

      const books = result.items
        .filter(item => BookEntityMapper.validateEntity(item))
        .map(entity => BookEntityMapper.fromDynamoDBEntity(entity));

      return {
        books,
        lastEvaluatedKey: result.lastEvaluatedKey,
        hasMore: !!result.lastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Error getting books by author:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get published books (for readers)
   */
  async getPublishedBooks(
    limit: number = 20,
    lastEvaluatedKey?: any
  ): Promise<{ books: Book[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    return this.getBooksByStatus('PUBLISHED', limit, lastEvaluatedKey);
  }

  /**
   * Search books by title (basic implementation)
   */
  async searchBooksByTitle(
    limit: number = 20
  ): Promise<Book[]> {
    try {
      // This is a basic implementation using scan with filter
      // In production, consider using Amazon OpenSearch or similar
      const result = await this.client.scan(
        'begins_with(PK, :pk)',
        { ':pk': 'BOOK#' },
        undefined,
        undefined,
        limit
      );

      return result.items
        .filter(item => BookEntityMapper.validateEntity(item))
        .map(entity => BookEntityMapper.fromDynamoDBEntity(entity));
    } catch (error) {
      logger.error('Error searching books by title:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Validate state transition
   */
  canTransitionState(currentStatus: BookStatus, newStatus: BookStatus, userRole: UserRole): boolean {
    // Check if the transition is valid for the current status
    const allowedTransitions = BOOK_STATE_TRANSITIONS[currentStatus] as readonly BookStatus[];
    if (!allowedTransitions.includes(newStatus)) {
      return false;
    }

    // Check if the user role has permission for this transition
    const rolePermissions = STATE_TRANSITION_PERMISSIONS[userRole];
    const allowedForRole = rolePermissions[currentStatus] as readonly BookStatus[];
    
    return allowedForRole.includes(newStatus);
  }

  /**
   * Get valid transitions for a book status and user role
   */
  getValidTransitions(currentStatus: BookStatus, userRole: UserRole): BookStatus[] {
    const rolePermissions = STATE_TRANSITION_PERMISSIONS[userRole];
    return [...(rolePermissions[currentStatus] || [])];
  }

  /**
   * Check if user can access book based on role and book status
   */
  canAccessBook(book: Book, userRole: UserRole, userId: string): boolean {
    switch (userRole) {
      case 'AUTHOR':
        // Authors can only access their own books
        return book.authorId === userId;
      
      case 'EDITOR':
        // Editors can access submitted books (in production, add assignment logic)
        return book.status === 'SUBMITTED_FOR_EDITING';
      
      case 'PUBLISHER':
        // Publishers can access books ready for publication
        return book.status === 'READY_FOR_PUBLICATION';
      
      case 'READER':
        // Readers can only access published books
        return book.status === 'PUBLISHED';
      
      default:
        return false;
    }
  }

  /**
   * Check if user can edit book
   */
  canEditBook(book: Book, userRole: UserRole, userId: string): boolean {
    switch (userRole) {
      case 'AUTHOR':
        // Authors can edit their own books only in DRAFT status
        return book.authorId === userId && book.status === 'DRAFT';
      
      case 'EDITOR':
        // Editors can edit books in SUBMITTED_FOR_EDITING status
        return book.status === 'SUBMITTED_FOR_EDITING';
      
      default:
        return false;
    }
  }

  /**
   * Get workflow action based on state transition
   */
  private getWorkflowAction(fromStatus: BookStatus, toStatus: BookStatus): 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH' {
    if (fromStatus === 'DRAFT' && toStatus === 'SUBMITTED_FOR_EDITING') {
      return 'SUBMIT';
    }
    if (fromStatus === 'SUBMITTED_FOR_EDITING' && toStatus === 'READY_FOR_PUBLICATION') {
      return 'APPROVE';
    }
    if ((fromStatus === 'SUBMITTED_FOR_EDITING' || fromStatus === 'READY_FOR_PUBLICATION') && toStatus === 'DRAFT') {
      return 'REJECT';
    }
    if (fromStatus === 'READY_FOR_PUBLICATION' && toStatus === 'PUBLISHED') {
      return 'PUBLISH';
    }
    
    // Default fallback
    return 'APPROVE';
  }

  /**
   * Validate book data
   */
  validateBookData(bookData: CreateBookRequest | UpdateBookRequest): string[] {
    const errors: string[] = [];

    if ('title' in bookData && bookData.title !== undefined) {
      if (!bookData.title || bookData.title.trim().length === 0) {
        errors.push('Title is required');
      } else if (bookData.title.length > 200) {
        errors.push('Title must be less than 200 characters');
      }
    }

    if ('description' in bookData && bookData.description !== undefined) {
      if (!bookData.description || bookData.description.trim().length === 0) {
        errors.push('Description is required');
      } else if (bookData.description.length > 2000) {
        errors.push('Description must be less than 2000 characters');
      }
    }

    if ('content' in bookData && bookData.content !== undefined) {
      if (!bookData.content || bookData.content.trim().length === 0) {
        errors.push('Content is required');
      } else if (bookData.content.length > 2000000) {
        errors.push('Content must be less than 2MB');
      }
    }

    if ('genre' in bookData && bookData.genre !== undefined) {
      if (!BookEntityMapper.isValidGenre(bookData.genre)) {
        errors.push('Invalid genre');
      }
    }

    if ('tags' in bookData && bookData.tags !== undefined) {
      if (!Array.isArray(bookData.tags)) {
        errors.push('Tags must be an array');
      } else if (bookData.tags.length > 10) {
        errors.push('Maximum 10 tags allowed');
      } else {
        for (const tag of bookData.tags) {
          if (typeof tag !== 'string' || tag.length > 50) {
            errors.push('Each tag must be a string with maximum 50 characters');
            break;
          }
        }
      }
    }

    return errors;
  }
}

// Singleton instance
export const bookDAO = new BookDAO();