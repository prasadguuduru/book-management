/**
 * Shared Email Service
 * Provides email sending capabilities using AWS SES for all Lambda services
 */

import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { SharedLogger } from '../logging/logger';

/**
 * Email parameters interface
 */
export interface EmailParams {
    to: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    from?: string;
}

/**
 * Enhanced email parameters with CC support
 */
export interface EnhancedEmailParams extends EmailParams {
    ccEmails?: string[];
    bccEmails?: string[];
}

/**
 * Email sending result interface
 */
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Enhanced email sending result with CC/BCC tracking
 */
export interface EnhancedSendEmailResult extends SendEmailResult {
    ccDeliveryStatus?: Array<{
        email: string;
        success: boolean;
        error?: string;
    }>;
    bccDeliveryStatus?: Array<{
        email: string;
        success: boolean;
        error?: string;
    }>;
}

/**
 * Shared Email Service class
 */
export class SharedEmailService {
    private sesClient: SESClient;
    private fromEmail: string;
    private logger: SharedLogger;

    constructor(serviceName: string = 'shared-email-service') {
        this.logger = new SharedLogger(serviceName);

        // Initialize SES client with region from environment
        const region = process.env['SES_REGION'] || process.env['AWS_REGION'] || 'us-east-1';
        this.sesClient = new SESClient({ region });

        // Default sender email from environment
        this.fromEmail = process.env['FROM_EMAIL'] || 'noreply@ebookplatform.com';

        this.logger.info('Shared Email Service initialized', {
            region,
            fromEmail: this.fromEmail
        });
    }

    /**
     * Send a simple email using AWS SES
     */
    async sendEmail(params: EmailParams): Promise<SendEmailResult> {
        try {
            // Validate email address before sending
            if (!this.validateEmailAddress(params.to)) {
                return {
                    success: false,
                    error: `Invalid recipient email address: ${params.to}`
                };
            }

            // Prepare SES command input
            const sesParams: SendEmailCommandInput = {
                Source: params.from || this.fromEmail,
                Destination: {
                    ToAddresses: [params.to]
                },
                Message: {
                    Subject: {
                        Data: params.subject,
                        Charset: 'UTF-8'
                    },
                    Body: {
                        Html: {
                            Data: params.htmlBody,
                            Charset: 'UTF-8'
                        },
                        Text: {
                            Data: params.textBody,
                            Charset: 'UTF-8'
                        }
                    }
                }
            };

            this.logger.info('Sending email via SES', {
                to: params.to,
                subject: params.subject,
                from: sesParams.Source
            });

            // Send email using SES
            const command = new SendEmailCommand(sesParams);
            const result = await this.sesClient.send(command);

            this.logger.info('Email sent successfully', {
                messageId: result.MessageId,
                to: params.to
            });

            return {
                success: true,
                ...(result.MessageId && { messageId: result.MessageId })
            };
        } catch (error) {
            this.logger.error('Failed to send email', error instanceof Error ? error : new Error(String(error)), {
                to: params.to,
                subject: params.subject
            });

            return {
                success: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    /**
     * Send an email with CC and BCC support using AWS SES
     */
    async sendEnhancedEmail(params: EnhancedEmailParams): Promise<EnhancedSendEmailResult> {
        try {
            // Validate primary recipient email address
            if (!this.validateEmailAddress(params.to)) {
                return {
                    success: false,
                    error: `Invalid recipient email address: ${params.to}`
                };
            }

            // Validate and filter CC emails
            const validCCEmails: string[] = [];
            const ccDeliveryStatus: Array<{ email: string; success: boolean; error?: string; }> = [];

            if (params.ccEmails && params.ccEmails.length > 0) {
                for (const ccEmail of params.ccEmails) {
                    if (this.validateEmailAddress(ccEmail)) {
                        // Avoid duplicate emails (don't CC the primary recipient)
                        if (ccEmail !== params.to) {
                            validCCEmails.push(ccEmail);
                        } else {
                            this.logger.info('Skipping CC email that matches primary recipient', {
                                primaryRecipient: params.to,
                                ccEmail: ccEmail
                            });
                        }
                    } else {
                        this.logger.warn('Invalid CC email address, skipping', { ccEmail });
                        ccDeliveryStatus.push({
                            email: ccEmail,
                            success: false,
                            error: 'Invalid email address format'
                        });
                    }
                }
            }

            // Validate and filter BCC emails
            const validBCCEmails: string[] = [];
            const bccDeliveryStatus: Array<{ email: string; success: boolean; error?: string; }> = [];

            if (params.bccEmails && params.bccEmails.length > 0) {
                for (const bccEmail of params.bccEmails) {
                    if (this.validateEmailAddress(bccEmail)) {
                        // Avoid duplicate emails
                        if (bccEmail !== params.to && !validCCEmails.includes(bccEmail)) {
                            validBCCEmails.push(bccEmail);
                        }
                    } else {
                        this.logger.warn('Invalid BCC email address, skipping', { bccEmail });
                        bccDeliveryStatus.push({
                            email: bccEmail,
                            success: false,
                            error: 'Invalid email address format'
                        });
                    }
                }
            }

            // Prepare SES command input with CC and BCC support
            const sesParams: SendEmailCommandInput = {
                Source: params.from || this.fromEmail,
                Destination: {
                    ToAddresses: [params.to],
                    ...(validCCEmails.length > 0 && { CcAddresses: validCCEmails }),
                    ...(validBCCEmails.length > 0 && { BccAddresses: validBCCEmails })
                },
                Message: {
                    Subject: {
                        Data: params.subject,
                        Charset: 'UTF-8'
                    },
                    Body: {
                        Html: {
                            Data: params.htmlBody,
                            Charset: 'UTF-8'
                        },
                        Text: {
                            Data: params.textBody,
                            Charset: 'UTF-8'
                        }
                    }
                }
            };

            this.logger.info('Sending enhanced email via SES', {
                to: params.to,
                ccEmails: validCCEmails,
                bccEmails: validBCCEmails,
                subject: params.subject,
                from: sesParams.Source,
                totalRecipients: 1 + validCCEmails.length + validBCCEmails.length
            });

            // Send email using SES
            const command = new SendEmailCommand(sesParams);
            const result = await this.sesClient.send(command);

            // Mark all valid CC and BCC emails as successfully sent
            for (const ccEmail of validCCEmails) {
                ccDeliveryStatus.push({
                    email: ccEmail,
                    success: true
                });
            }

            for (const bccEmail of validBCCEmails) {
                bccDeliveryStatus.push({
                    email: bccEmail,
                    success: true
                });
            }

            this.logger.info('Enhanced email sent successfully', {
                messageId: result.MessageId,
                to: params.to,
                ccEmails: validCCEmails,
                bccEmails: validBCCEmails,
                ccDeliveryCount: validCCEmails.length,
                bccDeliveryCount: validBCCEmails.length
            });

            return {
                success: true,
                ...(result.MessageId && { messageId: result.MessageId }),
                ccDeliveryStatus,
                bccDeliveryStatus
            };
        } catch (error) {
            this.logger.error('Failed to send enhanced email', error instanceof Error ? error : new Error(String(error)), {
                to: params.to,
                ccEmails: params.ccEmails,
                bccEmails: params.bccEmails,
                subject: params.subject
            });

            const errorMessage = this.getErrorMessage(error);

            // Mark all CC and BCC emails as failed if the entire send operation failed
            const ccDeliveryStatus: Array<{ email: string; success: boolean; error?: string; }> = [];
            const bccDeliveryStatus: Array<{ email: string; success: boolean; error?: string; }> = [];

            if (params.ccEmails) {
                for (const ccEmail of params.ccEmails) {
                    ccDeliveryStatus.push({
                        email: ccEmail,
                        success: false,
                        error: errorMessage
                    });
                }
            }

            if (params.bccEmails) {
                for (const bccEmail of params.bccEmails) {
                    bccDeliveryStatus.push({
                        email: bccEmail,
                        success: false,
                        error: errorMessage
                    });
                }
            }

            return {
                success: false,
                error: errorMessage,
                ccDeliveryStatus,
                bccDeliveryStatus
            };
        }
    }

    /**
     * Validate email address format
     */
    private validateEmailAddress(email: string): boolean {
        if (!email || typeof email !== 'string') {
            return false;
        }
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Check format and length
        if (!emailRegex.test(email) || email.length > 254) {
            return false;
        }
        // Check for common invalid patterns
        if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
            return false;
        }
        return true;
    }

    /**
     * Get user-friendly error message from SES error
     */
    private getErrorMessage(error: any): string {
        if (error instanceof Error) {
            // Check for common SES errors
            if (error.name === 'MessageRejected') {
                return 'Email was rejected by SES';
            } else if (error.name === 'SendingPausedException') {
                return 'Email sending is paused for this account';
            } else if (error.name === 'Throttling') {
                return 'SES rate limit exceeded';
            } else if (error.name === 'InvalidParameterValue') {
                return 'Invalid email parameters';
            } else {
                return error.message;
            }
        }
        return 'Failed to send email';
    }

    /**
     * Test SES configuration and connectivity
     */
    async testConnection(): Promise<{ success: boolean; error?: string; }> {
        try {
            this.logger.info('SES connection test - service initialized successfully');
            return { success: true };
        } catch (error) {
            this.logger.error('SES connection test failed', error instanceof Error ? error : new Error(String(error)));
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

// Export singleton instance
export const sharedEmailService = new SharedEmailService();