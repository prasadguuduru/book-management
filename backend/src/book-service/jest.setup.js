// Jest setup file for book-service tests

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      get: jest.fn(),
      put: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      scan: jest.fn(),
      query: jest.fn()
    }))
  },
  SNS: jest.fn(() => ({
    publish: jest.fn()
  })),
  SQS: jest.fn(() => ({
    sendMessage: jest.fn()
  }))
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.TABLE_NAME = 'test-table';
process.env.AWS_REGION = 'us-east-1';