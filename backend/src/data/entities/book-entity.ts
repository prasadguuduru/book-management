/**
 * Book entity model for DynamoDB single table design
 */

import { DynamoDBEntity, Book, BookStatus, BookGenre } from '../../types';

export interface BookEntity extends DynamoDBEntity {
  PK: `BOOK#${string}`;
  SK: 'METADATA';
  GSI1PK: `STATUS#${BookStatus}`;
  GSI1SK: `BOOK#${string}`;
  GSI2PK: `GENRE#${string}`;
  GSI2SK: `BOOK#${string}`;
  entityType: 'BOOK';
  bookId: string;
  authorId: string;
  title: string;
  description: string;
  content: string;
  genre: BookGenre;
  status: BookStatus;
  tags: string[];
  wordCount: number;
  coverImageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export class BookEntityMapper {
  /**
   * Convert Book domain object to DynamoDB entity
   */
  static toDynamoDBEntity(book: Book): BookEntity {
    const entity: BookEntity = {
      PK: `BOOK#${book.bookId}`,
      SK: 'METADATA',
      GSI1PK: `STATUS#${book.status}`,
      GSI1SK: `BOOK#${book.bookId}`,
      GSI2PK: `GENRE#${book.genre.toUpperCase()}`,
      GSI2SK: `BOOK#${book.bookId}`,
      entityType: 'BOOK',
      bookId: book.bookId,
      authorId: book.authorId,
      title: book.title,
      description: book.description,
      content: book.content,
      genre: book.genre,
      status: book.status,
      tags: book.tags,
      wordCount: book.wordCount,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      version: book.version,
    };

    if (book.coverImageUrl !== undefined) {
      entity.coverImageUrl = book.coverImageUrl;
    }

    if (book.publishedAt !== undefined) {
      entity.publishedAt = book.publishedAt;
    }

    return entity;
  }

  /**
   * Convert DynamoDB entity to Book domain object
   */
  static fromDynamoDBEntity(entity: BookEntity): Book {
    const book: Book = {
      bookId: entity.bookId,
      authorId: entity.authorId,
      title: entity.title,
      description: entity.description,
      content: entity.content,
      genre: entity.genre,
      status: entity.status,
      tags: entity.tags,
      wordCount: entity.wordCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };

    if (entity.coverImageUrl !== undefined) {
      book.coverImageUrl = entity.coverImageUrl;
    }

    if (entity.publishedAt !== undefined) {
      book.publishedAt = entity.publishedAt;
    }

    return book;
  }

  /**
   * Create primary key for book entity
   */
  static createPK(bookId: string): `BOOK#${string}` {
    return `BOOK#${bookId}`;
  }

  /**
   * Create sort key for book metadata
   */
  static createSK(): 'METADATA' {
    return 'METADATA';
  }

  /**
   * Create GSI1 partition key for status queries
   */
  static createGSI1PK(status: BookStatus): `STATUS#${BookStatus}` {
    return `STATUS#${status}`;
  }

  /**
   * Create GSI1 sort key
   */
  static createGSI1SK(bookId: string): `BOOK#${string}` {
    return `BOOK#${bookId}`;
  }

  /**
   * Create GSI2 partition key for genre queries
   */
  static createGSI2PK(genre: BookGenre): `GENRE#${string}` {
    return `GENRE#${genre.toUpperCase()}`;
  }

  /**
   * Create GSI2 sort key
   */
  static createGSI2SK(bookId: string): `BOOK#${string}` {
    return `BOOK#${bookId}`;
  }

  /**
   * Validate book status
   */
  static isValidStatus(status: string): status is BookStatus {
    return ['DRAFT', 'SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION', 'PUBLISHED'].includes(status);
  }

  /**
   * Validate book genre
   */
  static isValidGenre(genre: string): genre is BookGenre {
    return ['fiction', 'non-fiction', 'science-fiction', 'mystery', 'romance', 'fantasy'].includes(genre);
  }

  /**
   * Calculate word count from content
   */
  static calculateWordCount(content: string): number {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Validate book entity structure
   */
  static validateEntity(entity: any): entity is BookEntity {
    return (
      entity &&
      typeof entity.PK === 'string' &&
      entity.PK.startsWith('BOOK#') &&
      entity.SK === 'METADATA' &&
      entity.entityType === 'BOOK' &&
      typeof entity.bookId === 'string' &&
      typeof entity.authorId === 'string' &&
      typeof entity.title === 'string' &&
      typeof entity.description === 'string' &&
      typeof entity.content === 'string' &&
      this.isValidGenre(entity.genre) &&
      this.isValidStatus(entity.status) &&
      Array.isArray(entity.tags) &&
      typeof entity.wordCount === 'number' &&
      typeof entity.createdAt === 'string' &&
      typeof entity.updatedAt === 'string' &&
      typeof entity.version === 'number'
    );
  }
}

/**
 * Book state transition rules
 */
export const BOOK_STATE_TRANSITIONS = {
  DRAFT: ['SUBMITTED_FOR_EDITING'],
  SUBMITTED_FOR_EDITING: ['DRAFT', 'READY_FOR_PUBLICATION'],
  READY_FOR_PUBLICATION: ['SUBMITTED_FOR_EDITING', 'PUBLISHED'],
  PUBLISHED: [], // Published books cannot change state
} as const;

/**
 * Role-based state transition permissions
 */
export const STATE_TRANSITION_PERMISSIONS = {
  AUTHOR: {
    DRAFT: ['SUBMITTED_FOR_EDITING'],
    SUBMITTED_FOR_EDITING: [], // Authors cannot change state once submitted
    READY_FOR_PUBLICATION: [],
    PUBLISHED: [],
  },
  EDITOR: {
    DRAFT: [],
    SUBMITTED_FOR_EDITING: ['DRAFT', 'READY_FOR_PUBLICATION'],
    READY_FOR_PUBLICATION: ['SUBMITTED_FOR_EDITING'], // Can send back for revision
    PUBLISHED: [],
  },
  PUBLISHER: {
    DRAFT: [],
    SUBMITTED_FOR_EDITING: [],
    READY_FOR_PUBLICATION: ['PUBLISHED'],
    PUBLISHED: [],
  },
  READER: {
    DRAFT: [],
    SUBMITTED_FOR_EDITING: [],
    READY_FOR_PUBLICATION: [],
    PUBLISHED: [],
  },
} as const;

/**
 * Book status display names
 */
export const BOOK_STATUS_DISPLAY = {
  DRAFT: 'Draft',
  SUBMITTED_FOR_EDITING: 'Under Review',
  READY_FOR_PUBLICATION: 'Ready to Publish',
  PUBLISHED: 'Published',
} as const;

/**
 * Book genre display names
 */
export const BOOK_GENRE_DISPLAY = {
  fiction: 'Fiction',
  'non-fiction': 'Non-Fiction',
  'science-fiction': 'Science Fiction',
  mystery: 'Mystery',
  romance: 'Romance',
  fantasy: 'Fantasy',
} as const;