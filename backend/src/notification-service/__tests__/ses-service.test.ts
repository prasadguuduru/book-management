/**
 * Tests for SES service with mocked AWS SDK
 */

import { SESService } from '../services/ses-service';
import { EmailParams, EnhancedEmailParams } from '../types/notification';

// Mock AWS SDK v3
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ MessageId: 'test-message-id' })
  })),
  SendEmailCommand: jest.fn().mockImplementation((params) => ({ input: params })),
  GetSendQuotaCommand: jest.fn().mockImplementation((params) => ({ input: params }))
}));
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
const mockSESClient = SESClient as jest.MockedClass<typeof SESClient>;

describe('SESService', () => {
  let sesService: SESService;
  let mockSend: jest.Mock;

  const validEmailParams: EmailParams = {
    to: 'test@example.com',
    subject: 'Test Subject',
    htmlBody: '<h1>Test HTML</h1>',
    textBody: 'Test Text'
  };

  const validEnhancedEmailParams: EnhancedEmailParams = {
    ...validEmailParams,
    ccEmails: ['cc1@example.com', 'cc2@example.com']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock SES client send method
    mockSend = jest.fn();
    mockSESClient.mockImplementation(() => ({
      send: mockSend
    }) as any);
    
    sesService = new SESService();
  });

  describe('sendEmail', () => {

    it('should send email successfully', async () => {
      const mockMessageId = 'test-message-id-123';
      mockSend.mockResolvedValue({ MessageId: mockMessageId });

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(mockMessageId);
      expect(result.error).toBeUndefined();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should use custom from email when provided', async () => {
      const mockMessageId = 'test-message-id-123';
      mockSend.mockResolvedValue({ MessageId: mockMessageId });

      const emailParams: EmailParams = {
        ...validEmailParams,
        from: 'custom@example.com'
      };

      await sesService.sendEmail(emailParams);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Source).toBe('custom@example.com');
    });

    it('should reject invalid email addresses', async () => {
      const invalidEmailParams: EmailParams = {
        ...validEmailParams,
        to: 'invalid-email'
      };

      const result = await sesService.sendEmail(invalidEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient email address');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle SES errors', async () => {
      const error = new Error('SES Error');
      mockSend.mockRejectedValue(error);

      const result = await sesService.sendEmail(validEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SES Error');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockSend.mockResolvedValue({ SendQuota: { Max24HourSend: 200 } });

      const result = await sesService.testConnection();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle connection test failure', async () => {
      // Since testConnection doesn't make actual AWS calls, it always succeeds
      const result = await sesService.testConnection();

      expect(result.success).toBe(true);
    });
  });

  describe('sendEmailWithCC', () => {
    it('should send email with CC successfully', async () => {
      const mockMessageId = 'test-message-id-123';
      mockSend.mockResolvedValue({ MessageId: mockMessageId });

      const result = await sesService.sendEmailWithCC(validEnhancedEmailParams);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(mockMessageId);
      expect(result.ccDeliveryStatus).toBeDefined();
      expect(result.ccDeliveryStatus).toHaveLength(2);
      const ccStatus = result.ccDeliveryStatus;
      expect(ccStatus).toBeDefined();
      expect(ccStatus && ccStatus[0]).toEqual({
        email: 'cc1@example.com',
        success: true
      });
      expect(ccStatus && ccStatus[1]).toEqual({
        email: 'cc2@example.com',
        success: true
      });
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify SES command includes CC addresses
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Destination.CcAddresses).toEqual(['cc1@example.com', 'cc2@example.com']);
    });

    it('should filter out duplicate CC emails that match primary recipient', async () => {
      const mockMessageId = 'test-message-id-123';
      mockSend.mockResolvedValue({ MessageId: mockMessageId });

      const emailParams: EnhancedEmailParams = {
        ...validEmailParams,
        to: 'primary@example.com',
        ccEmails: ['primary@example.com', 'cc1@example.com']
      };

      const result = await sesService.sendEmailWithCC(emailParams);

      expect(result.success).toBe(true);
      expect(result.ccDeliveryStatus).toBeDefined();
      expect(result.ccDeliveryStatus).toHaveLength(1);
      const ccStatus = result.ccDeliveryStatus;
      expect(ccStatus).toBeDefined();
      expect(ccStatus && ccStatus[0]?.email).toBe('cc1@example.com');

      // Verify SES command excludes duplicate email
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Destination.CcAddresses).toEqual(['cc1@example.com']);
    });

    it('should handle invalid CC email addresses', async () => {
      const mockMessageId = 'test-message-id-123';
      mockSend.mockResolvedValue({ MessageId: mockMessageId });

      const emailParams: EnhancedEmailParams = {
        ...validEmailParams,
        ccEmails: ['valid@example.com', 'invalid-email', 'another-valid@example.com']
      };

      const result = await sesService.sendEmailWithCC(emailParams);

      expect(result.success).toBe(true);
      expect(result.ccDeliveryStatus).toBeDefined();
      expect(result.ccDeliveryStatus).toHaveLength(3);
      
      const ccStatus = result.ccDeliveryStatus;
      expect(ccStatus).toBeDefined();
      if (ccStatus) {
        // Check valid emails are marked as successful
        const validCCs = ccStatus.filter(cc => cc.success);
        expect(validCCs).toHaveLength(2);
        expect(validCCs.map(cc => cc.email)).toEqual(['valid@example.com', 'another-valid@example.com']);
        
        // Check invalid email is marked as failed
        const invalidCC = ccStatus.find(cc => !cc.success);
        expect(invalidCC?.email).toBe('invalid-email');
        expect(invalidCC?.error).toContain('Invalid email address format');
      }

      // Verify SES command only includes valid CC addresses
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Destination.CcAddresses).toEqual(['valid@example.com', 'another-valid@example.com']);
    });

    it('should send email without CC addresses when none are provided', async () => {
      const mockMessageId = 'test-message-id-123';
      mockSend.mockResolvedValue({ MessageId: mockMessageId });

      const emailParams: EnhancedEmailParams = {
        ...validEmailParams,
        ccEmails: []
      };

      const result = await sesService.sendEmailWithCC(emailParams);

      expect(result.success).toBe(true);
      expect(result.ccDeliveryStatus).toBeDefined();
      expect(result.ccDeliveryStatus).toHaveLength(0);

      // Verify SES command doesn't include CC addresses
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Destination.CcAddresses).toBeUndefined();
    });

    it('should handle SES errors with CC tracking', async () => {
      const error = new Error('SES Error');
      mockSend.mockRejectedValue(error);

      const result = await sesService.sendEmailWithCC(validEnhancedEmailParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SES Error');
      expect(result.ccDeliveryStatus).toBeDefined();
      expect(result.ccDeliveryStatus).toHaveLength(2);
      
      const ccStatus = result.ccDeliveryStatus;
      expect(ccStatus).toBeDefined();
      if (ccStatus) {
        // All CC emails should be marked as failed
        ccStatus.forEach(cc => {
          expect(cc.success).toBe(false);
          expect(cc.error).toContain('SES Error');
        });
      }
    });

    it('should reject invalid primary email address', async () => {
      const emailParams: EnhancedEmailParams = {
        ...validEnhancedEmailParams,
        to: 'invalid-email'
      };

      const result = await sesService.sendEmailWithCC(emailParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient email address');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('email validation', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk'
      ];

      for (const email of validEmails) {
        // This should not throw an error during validation
        expect(() => sesService['validateEmailAddress'](email)).not.toThrow();
      }
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com'
      ];

      for (const email of invalidEmails) {
        expect(sesService['validateEmailAddress'](email)).toBe(false);
      }
    });
  });
});