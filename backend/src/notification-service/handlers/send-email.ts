/**
 * Email notification handler
 * Handles POST /api/notifications/send requests
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
// Using console.log for logging in notification service
import { UserContext, HandlerResponse, SendNotificationResponse } from '../types/notification';
import { validateNotificationRequest, sanitizeNotificationRequest } from '../utils/validation';
import { getEmailContent } from '../utils/email-templates';
import { SESService } from '../services/ses-service';

// Initialize SES service
const sesService = new SESService();

/**
 * Handle email notification sending requests
 */
export async function sendEmailHandler(
  event: APIGatewayProxyEvent,
  userContext: UserContext,
  requestId: string
): Promise<HandlerResponse> {
  try {
    console.log('📧 PROCESSING EMAIL NOTIFICATION REQUEST', {
      requestId,
      userId: userContext.userId,
      userRole: userContext.role,
      userEmail: userContext.email
    });

    // Parse request body
    let requestBody;
    try {
      requestBody = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error('❌ Invalid JSON in request body', parseError instanceof Error ? parseError : new Error(String(parseError)), {
        requestId,
        body: event.body
      });
      
      return {
        statusCode: 400,
        body: {
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Validate request payload
    const validation = validateNotificationRequest(requestBody);
    if (!validation.isValid) {
      console.warn('❌ Request validation failed', {
        requestId,
        errors: validation.errors,
        requestBody
      });

      return {
        statusCode: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validation.errors,
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Sanitize request
    const notificationRequest = sanitizeNotificationRequest(requestBody);

    console.log('✅ Request validated successfully', {
      requestId,
      notificationType: notificationRequest.type,
      recipientEmail: notificationRequest.recipientEmail,
      hasVariables: !!notificationRequest.variables && Object.keys(notificationRequest.variables).length > 0
    });

    // Generate email content
    let emailContent;
    try {
      emailContent = getEmailContent(notificationRequest.type, notificationRequest.variables);
      
      console.log('📝 Email content generated', {
        requestId,
        subject: emailContent.subject,
        hasHtmlBody: !!emailContent.htmlBody,
        hasTextBody: !!emailContent.textBody,
        htmlBodyLength: emailContent.htmlBody.length,
        textBodyLength: emailContent.textBody.length
      });
    } catch (templateError) {
      console.error('❌ Failed to generate email content', templateError instanceof Error ? templateError : new Error(String(templateError)), {
        requestId,
        notificationType: notificationRequest.type,
        variables: notificationRequest.variables
      });

      return {
        statusCode: 500,
        body: {
          error: {
            code: 'TEMPLATE_ERROR',
            message: 'Failed to generate email content',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

    // Send email via SES
    const emailParams = {
      to: notificationRequest.recipientEmail,
      subject: emailContent.subject,
      htmlBody: emailContent.htmlBody,
      textBody: emailContent.textBody
    };

    console.log('📤 Sending email via SES', {
      requestId,
      to: emailParams.to,
      subject: emailParams.subject
    });

    const sendResult = await sesService.sendEmail(emailParams);

    if (sendResult.success) {
      console.log('✅ Email sent successfully', {
        requestId,
        messageId: sendResult.messageId,
        to: emailParams.to,
        subject: emailParams.subject,
        notificationType: notificationRequest.type
      });

      const response: SendNotificationResponse = {
        success: true,
        messageId: sendResult.messageId || undefined,
        message: 'Email notification sent successfully',
        timestamp: new Date().toISOString()
      };

      return {
        statusCode: 200,
        body: response
      };
    } else {
      console.error('❌ Email sending failed', new Error(sendResult.error || 'Unknown SES error'), {
        requestId,
        to: emailParams.to,
        subject: emailParams.subject,
        notificationType: notificationRequest.type,
        sesError: sendResult.error
      });

      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorCode = 'EMAIL_DELIVERY_FAILED';

      if (sendResult.error?.includes('rate limit') || sendResult.error?.includes('Throttling')) {
        statusCode = 429;
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (sendResult.error?.includes('Invalid') || sendResult.error?.includes('rejected')) {
        statusCode = 400;
        errorCode = 'INVALID_EMAIL_PARAMETERS';
      } else if (sendResult.error?.includes('Access denied')) {
        statusCode = 500;
        errorCode = 'SES_ACCESS_DENIED';
      }

      return {
        statusCode,
        body: {
          error: {
            code: errorCode,
            message: sendResult.error || 'Failed to send email notification',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

  } catch (error) {
    console.error('❌ Unexpected error in sendEmailHandler', error instanceof Error ? error : new Error(String(error)), {
      requestId,
      userId: userContext.userId,
      eventPath: event.path,
      eventMethod: event.httpMethod
    });

    return {
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error while processing email notification',
          timestamp: new Date().toISOString(),
          requestId
        }
      }
    };
  }
}