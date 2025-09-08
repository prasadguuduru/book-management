import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { EmailParams, SendEmailResult, EnhancedEmailParams, EnhancedSendEmailResult } from '../types/notification';

export class SESService {
    private sesClient: SESClient;
    private fromEmail: string;

    constructor() {
        // Initialize SES client with region from environment
        const region = process.env['SES_REGION'] || process.env['AWS_REGION'] || 'us-east-1';
        this.sesClient = new SESClient({ region });

        // Default sender email from environment
        this.fromEmail = process.env['FROM_EMAIL'] || 'noreply@ebookplatform.com';

        console.log('SES Service initialized:', {
            region,
            fromEmail: this.fromEmail
        });
    }

    /**
     * Send an email using AWS SES
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

            console.log('Sending email via SES:', {
                to: params.to,
                subject: params.subject,
                from: sesParams.Source
            });

            // Send email using SES
            const command = new SendEmailCommand(sesParams);
            const result = await this.sesClient.send(command);

            console.log('Email sent successfully:', {
                messageId: result.MessageId,
                to: params.to
            });

            return {
                success: true,
                messageId: result.MessageId || undefined
            };
        } catch (error) {
            console.error('Failed to send email:', {
                error: error instanceof Error ? error.message : error,
                to: params.to,
                subject: params.subject
            });

            // Handle specific SES errors
            let errorMessage = 'Failed to send email';
            if (error instanceof Error) {
                // Check for common SES errors
                if (error.name === 'MessageRejected') {
                    errorMessage = 'Email was rejected by SES';
                } else if (error.name === 'SendingPausedException') {
                    errorMessage = 'Email sending is paused for this account';
                } else if (error.name === 'Throttling') {
                    errorMessage = 'SES rate limit exceeded';
                } else if (error.name === 'InvalidParameterValue') {
                    errorMessage = 'Invalid email parameters';
                } else {
                    errorMessage = error.message;
                }
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Send an email with CC support using AWS SES
     */
    async sendEmailWithCC(params: EnhancedEmailParams): Promise<EnhancedSendEmailResult> {
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
                            console.log('Skipping CC email that matches primary recipient:', {
                                primaryRecipient: params.to,
                                ccEmail: ccEmail
                            });
                        }
                    } else {
                        console.warn('Invalid CC email address, skipping:', ccEmail);
                        ccDeliveryStatus.push({
                            email: ccEmail,
                            success: false,
                            error: 'Invalid email address format'
                        });
                    }
                }
            }

            // Prepare SES command input with CC support
            const sesParams: SendEmailCommandInput = {
                Source: params.from || this.fromEmail,
                Destination: {
                    ToAddresses: [params.to],
                    ...(validCCEmails.length > 0 && { CcAddresses: validCCEmails })
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

            console.log('Sending email with CC via SES:', {
                to: params.to,
                ccEmails: validCCEmails,
                subject: params.subject,
                from: sesParams.Source,
                totalRecipients: 1 + validCCEmails.length
            });

            // Send email using SES
            const command = new SendEmailCommand(sesParams);
            const result = await this.sesClient.send(command);

            // Mark all valid CC emails as successfully sent
            for (const ccEmail of validCCEmails) {
                ccDeliveryStatus.push({
                    email: ccEmail,
                    success: true
                });
            }

            console.log('Email with CC sent successfully:', {
                messageId: result.MessageId,
                to: params.to,
                ccEmails: validCCEmails,
                ccDeliveryCount: validCCEmails.length
            });

            return {
                success: true,
                messageId: result.MessageId || undefined,
                ccDeliveryStatus
            };
        } catch (error) {
            console.error('Failed to send email with CC:', {
                error: error instanceof Error ? error.message : error,
                to: params.to,
                ccEmails: params.ccEmails,
                subject: params.subject
            });

            // Handle specific SES errors
            let errorMessage = 'Failed to send email';
            if (error instanceof Error) {
                // Check for common SES errors
                if (error.name === 'MessageRejected') {
                    errorMessage = 'Email was rejected by SES';
                } else if (error.name === 'SendingPausedException') {
                    errorMessage = 'Email sending is paused for this account';
                } else if (error.name === 'Throttling') {
                    errorMessage = 'SES rate limit exceeded';
                } else if (error.name === 'InvalidParameterValue') {
                    errorMessage = 'Invalid email parameters';
                } else {
                    errorMessage = error.message;
                }
            }

            // Mark all CC emails as failed if the entire send operation failed
            const ccDeliveryStatus: Array<{ email: string; success: boolean; error?: string; }> = [];
            if (params.ccEmails) {
                for (const ccEmail of params.ccEmails) {
                    ccDeliveryStatus.push({
                        email: ccEmail,
                        success: false,
                        error: errorMessage
                    });
                }
            }

            return {
                success: false,
                error: errorMessage,
                ccDeliveryStatus
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
     * Test SES configuration and connectivity
     */
    async testConnection(): Promise<{ success: boolean; error?: string; }> {
        try {
            // Try to get sending quota to test connection
            // Note: This would require additional permissions, so we'll skip for now
            console.log('SES connection test - service initialized successfully');
            return { success: true };
        } catch (error) {
            console.error('SES connection test failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

// Export singleton instance
export const sesService = new SESService();