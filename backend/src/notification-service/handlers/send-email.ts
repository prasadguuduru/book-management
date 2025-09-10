/**
 * Email notification handler
 * Handles POST /api/notifications/send requests
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { SharedLogger } from '../../shared/logging/logger';

import { UserContext, HandlerResponse, SendNotificationResponse } from '../types/notification';
import { validateNotificationRequest, sanitizeNotificationRequest } from '../utils/validation';
import { getEmailContent } from '../utils/email-templates';
import { sesService } from '../services/ses-service';

// Initialize shared logger for send-email handler
const logger = new SharedLogger('notification-service-send-email');

/**
 * Handle email notification sending requests
 */
export async function sendEmailHandler(
  event: APIGatewayProxyEvent,
  userContext: UserContext,
  requestId: string
): Promise<HandlerResponse> {
  logger.setCorrelationId(requestId);
  
  try {
    logger.info('📧 PROCESSING EMAIL NOTIFICATION REQUEST', {
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
      logger.error('❌ Invalid JSON in request body', parseError instanceof Error ? parseError : new Error(String(parseError)), {
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

    // Validate request payload using shared validation
    const validation = validateNotificationRequest(requestBody);
    if (!validation.isValid) {
      logger.validation('notification-request', false, validation.errors, { requestId });

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

    logger.validation('notification-request', true, [], { 
      requestId,
      notificationType: notificationRequest.type,
      recipientEmail: notificationRequest.recipientEmail,
      hasVariables: !!notificationRequest.variables && Object.keys(notificationRequest.variables).length > 0
    });

    // Generate email content
    let emailContent;
    try {
      emailContent = getEmailContent(notificationRequest.type, notificationRequest.variables);
      
      logger.info('📝 Email content generated', {
        requestId,
        subject: emailContent.subject,
        hasHtmlBody: !!emailContent.htmlBody,
        hasTextBody: !!emailContent.textBody,
        htmlBodyLength: emailContent.htmlBody.length,
        textBodyLength: emailContent.textBody.length
      });
    } catch (templateError) {
      logger.error('❌ Failed to generate email content', templateError instanceof Error ? templateError : new Error(String(templateError)), {
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

    // Send email via SES with CC support
    const baseEmailParams = {
      to: notificationRequest.recipientEmail,
      subject: emailContent.subject,
      htmlBody: emailContent.htmlBody,
      textBody: emailContent.textBody
    };

    logger.info('📤 Sending email via SES', {
      requestId,
      to: baseEmailParams.to,
      ccEmails: notificationRequest.ccEmails,
      subject: baseEmailParams.subject,
      hasCCEmails: !!(notificationRequest.ccEmails && notificationRequest.ccEmails.length > 0)
    });

    // Use enhanced email sending if CC emails are present
    const sendResult = notificationRequest.ccEmails && notificationRequest.ccEmails.length > 0
      ? await sesService.sendEmailWithCC({
          ...baseEmailParams,
          ccEmails: notificationRequest.ccEmails
        })
      : await sesService.sendEmail(baseEmailParams);

    if (sendResult && sendResult.success) {
      // Check CC delivery status if present
      const ccDeliveryStatus = 'ccDeliveryStatus' in sendResult ? sendResult.ccDeliveryStatus : undefined;
      const ccFailures = ccDeliveryStatus && Array.isArray(ccDeliveryStatus) 
        ? ccDeliveryStatus.filter((cc: any) => !cc.success) 
        : [];
      const ccSuccesses = ccDeliveryStatus && Array.isArray(ccDeliveryStatus) 
        ? ccDeliveryStatus.filter((cc: any) => cc.success) 
        : [];

      logger.info('✅ Email sent successfully', {
        requestId,
        messageId: sendResult.messageId,
        to: baseEmailParams.to,
        subject: baseEmailParams.subject,
        notificationType: notificationRequest.type,
        ccEmailsSent: ccSuccesses.length,
        ccEmailsFailed: ccFailures.length,
        ccSuccessEmails: ccSuccesses.map((cc: any) => cc.email),
        ccFailureEmails: ccFailures.map((cc: any) => ({ email: cc.email, error: cc.error }))
      });

      // Log CC delivery failures as warnings (don't fail the entire request)
      if (ccFailures.length > 0) {
        logger.warn('⚠️ Some CC emails failed to deliver', {
          requestId,
          ccFailures: ccFailures.map((cc: any) => ({ email: cc.email, error: cc.error })),
          primaryDeliverySuccess: true
        });
      }

      const response: SendNotificationResponse = {
        success: true,
        messageId: sendResult.messageId || undefined,
        message: ccFailures.length > 0 
          ? `Email notification sent successfully to primary recipient. ${ccFailures.length} CC email(s) failed.`
          : 'Email notification sent successfully',
        timestamp: new Date().toISOString()
      };

      return {
        statusCode: 200,
        body: response
      };
    } else {
      // Check CC delivery status for enhanced error reporting
      const ccDeliveryStatus = sendResult && 'ccDeliveryStatus' in sendResult ? sendResult.ccDeliveryStatus : undefined;
      
      logger.error('❌ Email sending failed', new Error(sendResult.error || 'Unknown SES error'), {
        requestId,
        to: baseEmailParams.to,
        subject: baseEmailParams.subject,
        notificationType: notificationRequest.type,
        sesError: sendResult?.error,
        ccEmails: notificationRequest.ccEmails,
        ccDeliveryStatus: ccDeliveryStatus
      });

      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorCode = 'EMAIL_DELIVERY_FAILED';

      if (sendResult?.error?.includes('rate limit') || sendResult?.error?.includes('Throttling')) {
        statusCode = 429;
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (sendResult?.error?.includes('Invalid') || sendResult?.error?.includes('rejected')) {
        statusCode = 400;
        errorCode = 'INVALID_EMAIL_PARAMETERS';
      } else if (sendResult?.error?.includes('Access denied')) {
        statusCode = 500;
        errorCode = 'SES_ACCESS_DENIED';
      }

      return {
        statusCode,
        body: {
          error: {
            code: errorCode,
            message: sendResult?.error || 'Failed to send email notification',
            timestamp: new Date().toISOString(),
            requestId
          }
        }
      };
    }

  } catch (error) {
    logger.error('❌ Unexpected error in sendEmailHandler', error instanceof Error ? error : new Error(String(error)), {
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