/**
 * Data layer exports
 */

// Core DynamoDB client
export { dynamoDBClient, DynamoDBClient } from './dynamodb-client';

// Entity models and mappers
export { UserEntity, UserEntityMapper, USER_ROLE_PERMISSIONS } from './entities/user-entity';
export { BookEntity, BookEntityMapper, BOOK_STATE_TRANSITIONS, STATE_TRANSITION_PERMISSIONS, BOOK_STATUS_DISPLAY, BOOK_GENRE_DISPLAY } from './entities/book-entity';

// Data Access Objects
export { userDAO, UserDAO } from './dao/user-dao';
export { bookDAO, BookDAO } from './dao/book-dao';

// Utilities
export { encryptionService, EncryptionService } from '../utils/encryption';

// Validation and access control
export { accessControlService, AccessControlService, AccessContext } from './validation/access-control';

// Data seeding
export { seedDataService, SeedDataService } from './seed-data';

// Testing utilities
export { dataLayerTester, DataLayerTester } from './test-data-layer';