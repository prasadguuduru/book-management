/**
 * Integration tests for send email handler
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { sendEmailHandler } from '../handlers/send-email';
import { UserContext } from '../types/notification';

// Mock dependencies
jest.mock('../services/ses-service');
jest.mock('../utils/email-templates');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('sendEmailHandler', () => {
  let mockSESService: any;
  let mockGetEmailContent: any;

  const mockUserContext: UserContext = {
    userId: 'user-123',
    role: 'AUTHOR',
    email: 'author@example.com'
  };

  const mockEvent: Partial<APIGatewayProxyEvent> = {
    httpMethod: 'POST',
    path: '/api/notifications/send',
    headers: {},
    body: JSON.stringify({
      type: 'book_submitted',
      recipientEmail: 'editor@example.com',
      variables: {
        userName: 'John Doe',
        bookTitle: 'Test Book',
        bookId: 'book-123'
      }
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SES service
    const { SESService } = require('../services/ses-service');
    mockSESService = {
      sendEmail: jest.fn()
    };
    SESService.mockImplementation(() => mockSESService);

    // Mock email templates
    const { getEmailContent } = require('../utils/email-templates');
    mockGetEmailContent = getEmailContent;
    mockGetEmailContent.mockReturnValue({
      subject: 'Test Subject',
      htmlBody: '<p>Test HTML</p>',
      textBody: 'Test Text'
    });
  });

  it('should send email successfully', async () => {
    mockSESService.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'mock-message-id'
    });

    const result = await sendEmailHandler(
      mockEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.messageId).toBe('mock-message-id');
    expect(result.body.message).toBe('Email notification sent successfully');

    expect(mockGetEmailContent).toHaveBeenCalledWith('book_submitted', {
      userName: 'John Doe',
      bookTitle: 'Test Book',
      bookId: 'book-123'
    });

    expect(mockSESService.sendEmail).toHaveBeenCalledWith({
      to: 'editor@example.com',
      subject: 'Test Subject',
      htmlBody: '<p>Test HTML</p>',
      textBody: 'Test Text'
    });
  });

  it('should handle invalid JSON in request body', async () => {
    const invalidEvent = {
      ...mockEvent,
      body: 'invalid-json'
    };

    const result = await sendEmailHandler(
      invalidEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(400);
    expect(result.body.error.code).toBe('INVALID_JSON');
    expect(result.body.error.message).toBe('Invalid JSON in request body');
  });

  it('should handle missing request body', async () => {
    const emptyEvent = {
      ...mockEvent,
      body: null
    };

    const result = await sendEmailHandler(
      emptyEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(result.body.error.details).toContain('Notification type is required');
    expect(result.body.error.details).toContain('Recipient email is required');
  });

  it('should handle validation errors', async () => {
    const invalidEvent = {
      ...mockEvent,
      body: JSON.stringify({
        type: 'invalid_type',
        recipientEmail: 'invalid-email'
      })
    };

    const result = await sendEmailHandler(
      invalidEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(result.body.error.details).toContain('Invalid notification type. Must be one of: book_submitted, book_approved, book_rejected, book_published');
    expect(result.body.error.details).toContain('Invalid recipient email format');
  });

  it('should handle template generation errors', async () => {
    mockGetEmailContent.mockImplementation(() => {
      throw new Error('Template not found');
    });

    const result = await sendEmailHandler(
      mockEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(500);
    expect(result.body.error.code).toBe('TEMPLATE_ERROR');
    expect(result.body.error.message).toBe('Failed to generate email content');
  });

  it('should handle SES delivery failures', async () => {
    mockSESService.sendEmail.mockResolvedValue({
      success: false,
      error: 'Email was rejected by SES. Please check the recipient address.'
    });

    const result = await sendEmailHandler(
      mockEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(400);
    expect(result.body.error.code).toBe('INVALID_EMAIL_PARAMETERS');
    expect(result.body.error.message).toBe('Email was rejected by SES. Please check the recipient address.');
  });

  it('should handle rate limit errors', async () => {
    mockSESService.sendEmail.mockResolvedValue({
      success: false,
      error: 'Email sending rate limit exceeded. Please try again later.'
    });

    const result = await sendEmailHandler(
      mockEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(429);
    expect(result.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should handle access denied errors', async () => {
    mockSESService.sendEmail.mockResolvedValue({
      success: false,
      error: 'Access denied to SES service. Please check IAM permissions.'
    });

    const result = await sendEmailHandler(
      mockEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(500);
    expect(result.body.error.code).toBe('SES_ACCESS_DENIED');
  });

  it('should handle unexpected errors', async () => {
    mockSESService.sendEmail.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const result = await sendEmailHandler(
      mockEvent as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(500);
    expect(result.body.error.code).toBe('INTERNAL_ERROR');
    expect(result.body.error.message).toBe('Internal server error while processing email notification');
  });

  it('should handle request without variables', async () => {
    const eventWithoutVariables = {
      ...mockEvent,
      body: JSON.stringify({
        type: 'book_published',
        recipientEmail: 'author@example.com'
      })
    };

    mockSESService.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'mock-message-id'
    });

    const result = await sendEmailHandler(
      eventWithoutVariables as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(200);
    expect(mockGetEmailContent).toHaveBeenCalledWith('book_published', {});
  });

  it('should sanitize email addresses', async () => {
    const eventWithUnsanitizedEmail = {
      ...mockEvent,
      body: JSON.stringify({
        type: 'book_approved',
        recipientEmail: '  EDITOR@EXAMPLE.COM  ',
        variables: { userName: 'John' }
      })
    };

    mockSESService.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'mock-message-id'
    });

    const result = await sendEmailHandler(
      eventWithUnsanitizedEmail as APIGatewayProxyEvent,
      mockUserContext,
      'test-request-id'
    );

    expect(result.statusCode).toBe(200);
    expect(mockSESService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'editor@example.com'
      })
    );
  });
});