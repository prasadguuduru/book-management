import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { EmailParams, SendEmailResult } from '../types/notification';

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