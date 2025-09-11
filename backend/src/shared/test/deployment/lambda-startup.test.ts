/**
 * Lambda Startup Test
 * Tests that Lambda functions can start without import errors
 */

describe('Lambda Startup Tests', () => {
  test('workflow service should start without import errors', async () => {
    // Test that we can import the workflow service without errors
    expect(() => {
      require('../../workflow-service/index');
    }).not.toThrow();
  });

  test('notification service should start without import errors', async () => {
    // Test that we can import the notification service without errors
    expect(() => {
      require('../../notification-service/index');
    }).not.toThrow();
  });

  test('workflow event integration should initialize properly', async () => {
    // Test that workflow event integration can be imported and initialized
    expect(() => {
      const { WorkflowEventService } = require('../../workflow-service/events/workflow-event-integration');
      const service = new WorkflowEventService();
      expect(service).toBeDefined();
    }).not.toThrow();
  });

  test('book event publisher should initialize with mock in test environment', async () => {
    // Set test environment
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'test';

    try {
      const { createSNSEventPublisher, MockBookEventPublisher } = require('../../workflow-service/events/book-event-publisher');
      
      // Should be able to create mock publisher
      const mockPublisher = new MockBookEventPublisher();
      expect(mockPublisher).toBeDefined();
      expect(typeof mockPublisher.publishStatusChange).toBe('function');
      
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  test('event types should be importable', async () => {
    expect(() => {
      const eventTypes = require('../../shared/events/event-types');
      expect(typeof eventTypes.shouldTriggerNotification).toBe('function');
      expect(typeof eventTypes.getNotificationTypeForTransition).toBe('function');
    }).not.toThrow();
  });

  test('book workflow events should be importable', async () => {
    expect(() => {
      const events = require('../../shared/events/book-workflow-events');
      expect(events).toBeDefined();
    }).not.toThrow();
  });
});