// Test setup for backend services

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['AWS_REGION'] = 'us-east-1';
process.env['TABLE_NAME'] = 'test-ebook-platform';

// This file is only used during testing, not during build
export const testSetup = () => {
  // Test setup logic will be handled by Jest configuration
  console.log('Test environment configured');
};