/**
 * Tests for SES service with mocked AWS SDK
 */

import { SESService } from '../services/ses-service';
import { EmailParams } from '../types/notification';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  SES: jest.fn().mockImplementation(() => ({
    sendEmail: jest.fn().mockReturnValue({
      promise: jest.fn()
    }),
    getSendStatistics: jest.fn().mockReturnValue({
      promise: jest.fn()
    }),
    verifyEmailIdentity: jest.fn().mockReturnValue({
      promise: jest.fn()
    })
  }))
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('SESService', () => {
  let sesService: SESService;
  let mockSES: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create new service instance
    sesService = new SESService();
    
    // Get mock SES instance
    const AWS = require('aws-sdk');
    mockSES = new AWS.SES();
  });

  describe('sendEmail', () => {
    const validEmailParams: EmailParams = {
      to: 'test@example.com',
      subject: 'Test Subject',
      htmlBody: '<p>Test HTML</p>',
      textBody: 'Test Text'
    };

    it('should send email successfully', async () => {
      const mockMessageId = 'mock-message-id-123';
      mockSES.sendEmail().promise.mockResolvedValue({
        MessageId: mockMessageId
      });

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(mockMessageId);
      expect(result.error).toBeUndefined();

      expect(mockSES.sendEmail).toHaveBeenCalledWith({
        Source: 'noreply@ebook-platform.com',
        Destination: {
          ToAddresses: ['test@example.com']
        },
        Message: {
          Subject: {
            Data: 'Test Subject',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: '<p>Test HTML</p>',
              Charset: 'UTF-8'
            },
            Text: {
              Data: 'Test Text',
              Charset: 'UTF-8'
            }
          }
        }
      });
    });

    it('should use custom from email when provided', async () => {
      const mockMessageId = 'mock-message-id-123';
      mockSES.sendEmail().promise.mockResolvedValue({
        MessageId: mockMessageId
      });

      const emailParams = {
        ...validEmailParams,
        from: 'custom@example.com'
      };

      await sesService.sendEmail(emailParams);

      expect(mockSES.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Source: 'custom@example.com'
        })
      );
    });

    it('should reject invalid email addresses', async () => {
      const invalidEmailParams = {
        ...validEmailParams,
        to: 'invalid-email'
      };

      const result = await sesService.sendEmail(invalidEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recipient email address');
      expect(mockSES.sendEmail).not.toHaveBeenCalled();
    });

    it('should handle SES MessageRejected error', async () => {
      const sesError = {
        code: 'MessageRejected',
        message: 'Email address not verified'
      };
      mockSES.sendEmail().promise.mockRejectedValue(sesError);

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email was rejected by SES. Please check the recipient address.');
    });

    it('should handle SES Throttling error', async () => {
      const sesError = {
        code: 'Throttling',
        message: 'Rate exceeded'
      };
      mockSES.sendEmail().promise.mockRejectedValue(sesError);

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email sending rate limit exceeded. Please try again later.');
    });

    it('should handle SES AccessDenied error', async () => {
      const sesError = {
        code: 'AccessDenied',
        message: 'User not authorized'
      };
      mockSES.sendEmail().promise.mockRejectedValue(sesError);

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied to SES service. Please check IAM permissions.');
    });

    it('should handle unknown SES errors', async () => {
      const sesError = {
        code: 'UnknownError',
        message: 'Something went wrong'
      };
      mockSES.sendEmail().promise.mockRejectedValue(sesError);

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email delivery failed: Something went wrong');
    });

    it('should handle errors without code', async () => {
      const sesError = new Error('Network error');
      mockSES.sendEmail().promise.mockRejectedValue(sesError);

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email delivery failed: Network error');
    });
  });

  describe('email validation', () => {
    it('should validate correct email addresses', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'test123@test-domain.com'
      ];

      mockSES.sendEmail().promise.mockResolvedValue({
        MessageId: 'test-id'
      });

      for (const email of validEmails) {
        const result = await sesService.sendEmail({
          to: email,
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          textBody: 'Test'
        });

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid email addresses', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        '',
        null,
        undefined
      ];

      for (const email of invalidEmails) {
        const result = await sesService.sendEmail({
          to: email as string,
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          textBody: 'Test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid recipient email address');
      }
    });
  });

  describe('getSendingStatistics', () => {
    it('should return statistics successfully', async () => {
      const mockStats = {
        SendDataPoints: [
          {
            Timestamp: new Date(),
            DeliveryAttempts: 10,
            Bounces: 1,
            Complaints: 0,
            Rejects: 0
          }
        ]
      };

      mockSES.getSendStatistics().promise.mockResolvedValue(mockStats);

      const result = await sesService.getSendingStatistics();

      expect(result).toEqual(mockStats);
      expect(mockSES.getSendStatistics).toHaveBeenCalled();
    });

    it('should handle statistics error gracefully', async () => {
      mockSES.getSendStatistics().promise.mockRejectedValue(new Error('Access denied'));

      const result = await sesService.getSendingStatistics();

      expect(result).toBeNull();
    });
  });

  describe('verifyEmailAddress', () => {
    it('should verify email address successfully', async () => {
      mockSES.verifyEmailIdentity().promise.mockResolvedValue({});

      const result = await sesService.verifyEmailAddress('test@example.com');

      expect(result).toBe(true);
      expect(mockSES.verifyEmailIdentity).toHaveBeenCalledWith({
        EmailAddress: 'test@example.com'
      });
    });

    it('should handle verification error gracefully', async () => {
      mockSES.verifyEmailIdentity().promise.mockRejectedValue(new Error('Already verified'));

      const result = await sesService.verifyEmailAddress('test@example.com');

      expect(result).toBe(false);
    });
  });
});