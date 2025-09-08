/**
 * Book Event to Notification Mapper
 * Maps book workflow events to notification requests and generates email content
 */

import { logger } from '../../utils/logger';
import { 
  getNotificationTypeForTransition,
  shouldTriggerNotification
} from '../../shared/events/event-types';
import { BookStatusChangeEvent } from '../../shared/events/book-workflow-events';
import { 
  NotificationRequest, 
  EmailVariables, 
  EmailContent, 
  NotificationType,
  CCConfiguration
} from '../types/notification';
import { 
  loadCCConfiguration, 
  getEffectiveCCEmails, 
  getCCConfigurationSummary 
} from '../utils/cc-configuration';

/**
 * Book Event Notification Mapper Service
 * Handles conversion of book workflow events to notification requests
 */
export class BookEventNotificationMapper {
  private readonly targetEmail: string;
  private readonly ccConfiguration: CCConfiguration;
  private readonly ccEnabled: boolean;

  constructor() {
    // Get target email from environment variable
    this.targetEmail = process.env['NOTIFICATION_TARGET_EMAIL'] || 'bookmanagement@yopmail.com';
    
    // Load CC configuration
    this.ccConfiguration = loadCCConfiguration();
    this.ccEnabled = this.ccConfiguration.enabled;
    
    // Log CC configuration summary
    const ccSummary = getCCConfigurationSummary();
    
    logger.info('📧 BOOK EVENT NOTIFICATION MAPPER INITIALIZED', {
      targetEmail: this.targetEmail,
      ccConfiguration: {
        enabled: this.ccEnabled,
        emailCount: ccSummary.emailCount,
        emails: ccSummary.emails,
        defaultEmail: ccSummary.defaultEmail
      }
    });

    // Log CC configuration details for debugging
    if (this.ccEnabled) {
      logger.info('✅ CC FUNCTIONALITY ENABLED', {
        ccEmails: this.ccConfiguration.emails,
        ccEmailCount: this.ccConfiguration.emails.length,
        environmentVariables: ccSummary.environmentVariables
      });
    } else {
      logger.info('❌ CC FUNCTIONALITY DISABLED', {
        reason: 'CC disabled via configuration',
        environmentVariables: ccSummary.environmentVariables
      });
    }
  }

  /**
   * Get CC emails for a notification, excluding duplicates with primary recipient
   * @param primaryRecipient The primary email recipient
   * @returns Array of CC email addresses
   */
  private getCCEmails(primaryRecipient: string): string[] {
    if (!this.ccEnabled) {
      logger.debug('🚫 CC EMAILS SKIPPED - CC DISABLED', {
        primaryRecipient,
        ccEnabled: this.ccEnabled
      });
      return [];
    }

    const effectiveCCEmails = getEffectiveCCEmails(this.ccConfiguration, primaryRecipient);
    
    logger.debug('📋 CC EMAILS DETERMINED', {
      primaryRecipient,
      configuredCCEmails: this.ccConfiguration.emails,
      effectiveCCEmails,
      duplicatesFiltered: this.ccConfiguration.emails.length - effectiveCCEmails.length
    });

    return effectiveCCEmails;
  }

  /**
   * Maps a book status change event to a notification request
   * Returns null if no notification should be sent for this event
   */
  mapEventToNotification(event: BookStatusChangeEvent): NotificationRequest | null {
    logger.info('🔄 MAPPING EVENT TO NOTIFICATION', {
      eventId: event.eventId,
      bookId: event.data.bookId,
      statusTransition: `${event.data.previousStatus} -> ${event.data.newStatus}`,
      changedBy: event.data.changedBy
    });

    // Check if this status transition should trigger a notification
    if (!shouldTriggerNotification(event.data.previousStatus, event.data.newStatus)) {
      logger.info('ℹ️ NO NOTIFICATION REQUIRED', {
        eventId: event.eventId,
        bookId: event.data.bookId,
        statusTransition: `${event.data.previousStatus} -> ${event.data.newStatus}`,
        reason: 'Status transition does not require notification'
      });
      return null;
    }

    // Get the notification type for this transition
    const notificationType = getNotificationTypeForTransition(
      event.data.previousStatus,
      event.data.newStatus
    );

    if (!notificationType) {
      logger.warn('⚠️ NO NOTIFICATION TYPE FOUND', {
        eventId: event.eventId,
        bookId: event.data.bookId,
        statusTransition: `${event.data.previousStatus} -> ${event.data.newStatus}`
      });
      return null;
    }

    // Create email variables from event data
    const emailVariables: EmailVariables = {
      userName: event.data.author, // Use author as the user name for now
      bookTitle: event.data.title,
      bookId: event.data.bookId,
      comments: event.data.changeReason || event.data.metadata?.['reviewComments'] || undefined
    };

    // Add status-specific variables
    this.addStatusSpecificVariables(emailVariables, event, notificationType);

    // Get CC emails for this notification
    const ccEmails = this.getCCEmails(this.targetEmail);

    const notificationRequest: NotificationRequest = {
      type: notificationType as NotificationType,
      recipientEmail: this.targetEmail,
      ...(ccEmails.length > 0 && { ccEmails }),
      variables: emailVariables
    };

    logger.info('✅ NOTIFICATION REQUEST CREATED', {
      eventId: event.eventId,
      notificationType,
      recipientEmail: this.targetEmail,
      ccEmails: ccEmails.length > 0 ? ccEmails : 'none',
      ccEmailCount: ccEmails.length,
      bookId: event.data.bookId,
      bookTitle: event.data.title
    });

    return notificationRequest;
  }

  /**
   * Generates email content based on notification type and variables
   */
  generateEmailContent(type: NotificationType, variables: EmailVariables): EmailContent {
    logger.info('📝 GENERATING EMAIL CONTENT', {
      notificationType: type,
      bookId: variables.bookId,
      bookTitle: variables.bookTitle
    });

    switch (type) {
      case 'book_submitted':
        return this.generateBookSubmittedContent(variables);
      
      case 'book_approved':
        return this.generateBookApprovedContent(variables);
      
      case 'book_rejected':
        return this.generateBookRejectedContent(variables);
      
      case 'book_published':
        return this.generateBookPublishedContent(variables);
      
      default:
        logger.error('❌ UNKNOWN NOTIFICATION TYPE', new Error(`Unknown notification type: ${type}`), {
          notificationType: type,
          bookId: variables.bookId
        });
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  /**
   * Add status-specific variables to email variables
   */
  private addStatusSpecificVariables(
    variables: EmailVariables,
    event: BookStatusChangeEvent,
    notificationType: string
  ): void {
    // Add action URL based on notification type
    const baseUrl = process.env['FRONTEND_BASE_URL'] || 'https://bookmanagement.example.com';
    
    switch (notificationType) {
      case 'book_submitted':
        variables.actionUrl = `${baseUrl}/books/${event.data.bookId}/review`;
        break;
      
      case 'book_approved':
        variables.actionUrl = `${baseUrl}/books/${event.data.bookId}/publish`;
        break;
      
      case 'book_rejected':
        variables.actionUrl = `${baseUrl}/books/${event.data.bookId}/edit`;
        break;
      
      case 'book_published':
        variables.actionUrl = `${baseUrl}/books/${event.data.bookId}/view`;
        break;
    }

    // Add metadata if available
    if (event.data.metadata) {
      if (event.data.metadata['nextSteps']) {
        variables.comments = variables.comments 
          ? `${variables.comments}\n\nNext Steps: ${event.data.metadata['nextSteps']}`
          : `Next Steps: ${event.data.metadata['nextSteps']}`;
      }
    }
  }

  /**
   * Generate email content for book submitted notification
   */
  private generateBookSubmittedContent(variables: EmailVariables): EmailContent {
    const subject = `📚 Book Submitted for Review: "${variables.bookTitle}"`;
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c5aa0;">📚 New Book Submitted for Review</h2>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Book Details</h3>
              <p><strong>Title:</strong> ${variables.bookTitle}</p>
              <p><strong>Author:</strong> ${variables.userName}</p>
              <p><strong>Book ID:</strong> ${variables.bookId}</p>
              <p><strong>Status:</strong> Submitted for Editing</p>
            </div>

            ${variables.comments ? `
              <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #1976d2;">📝 Submission Notes</h4>
                <p style="margin-bottom: 0;">${variables.comments.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}

            <div style="margin: 30px 0;">
              <h4 style="color: #495057;">Next Steps</h4>
              <p>The book is now ready for editorial review. Please review the content and provide feedback to the author.</p>
            </div>

            ${variables.actionUrl ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${variables.actionUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Review Book
                </a>
              </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d; text-align: center;">
              This is an automated notification from the Book Management System.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
📚 NEW BOOK SUBMITTED FOR REVIEW

Book Details:
- Title: ${variables.bookTitle}
- Author: ${variables.userName}
- Book ID: ${variables.bookId}
- Status: Submitted for Editing

${variables.comments ? `
Submission Notes:
${variables.comments}
` : ''}

Next Steps:
The book is now ready for editorial review. Please review the content and provide feedback to the author.

${variables.actionUrl ? `Review Book: ${variables.actionUrl}` : ''}

---
This is an automated notification from the Book Management System.
    `;

    return { subject, htmlBody, textBody };
  }

  /**
   * Generate email content for book approved notification
   */
  private generateBookApprovedContent(variables: EmailVariables): EmailContent {
    const subject = `✅ Book Approved for Publication: "${variables.bookTitle}"`;
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #28a745;">✅ Book Approved for Publication</h2>
            
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="margin-top: 0; color: #155724;">Great News!</h3>
              <p style="margin-bottom: 0;">The book "<strong>${variables.bookTitle}</strong>" has been approved and is ready for publication.</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Book Details</h3>
              <p><strong>Title:</strong> ${variables.bookTitle}</p>
              <p><strong>Author:</strong> ${variables.userName}</p>
              <p><strong>Book ID:</strong> ${variables.bookId}</p>
              <p><strong>Status:</strong> Ready for Publication</p>
            </div>

            ${variables.comments ? `
              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #28a745;">📝 Review Comments</h4>
                <p style="margin-bottom: 0;">${variables.comments.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}

            <div style="margin: 30px 0;">
              <h4 style="color: #495057;">Next Steps</h4>
              <p>The book is now ready to be published. You can proceed with the publication process.</p>
            </div>

            ${variables.actionUrl ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${variables.actionUrl}" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Publish Book
                </a>
              </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d; text-align: center;">
              This is an automated notification from the Book Management System.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
✅ BOOK APPROVED FOR PUBLICATION

Great News!
The book "${variables.bookTitle}" has been approved and is ready for publication.

Book Details:
- Title: ${variables.bookTitle}
- Author: ${variables.userName}
- Book ID: ${variables.bookId}
- Status: Ready for Publication

${variables.comments ? `
Review Comments:
${variables.comments}
` : ''}

Next Steps:
The book is now ready to be published. You can proceed with the publication process.

${variables.actionUrl ? `Publish Book: ${variables.actionUrl}` : ''}

---
This is an automated notification from the Book Management System.
    `;

    return { subject, htmlBody, textBody };
  }

  /**
   * Generate email content for book rejected notification
   */
  private generateBookRejectedContent(variables: EmailVariables): EmailContent {
    const subject = `❌ Book Requires Revision: "${variables.bookTitle}"`;
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc3545;">❌ Book Requires Revision</h2>
            
            <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h3 style="margin-top: 0; color: #721c24;">Revision Required</h3>
              <p style="margin-bottom: 0;">The book "<strong>${variables.bookTitle}</strong>" requires revisions before it can be approved for publication.</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Book Details</h3>
              <p><strong>Title:</strong> ${variables.bookTitle}</p>
              <p><strong>Author:</strong> ${variables.userName}</p>
              <p><strong>Book ID:</strong> ${variables.bookId}</p>
              <p><strong>Status:</strong> Submitted for Editing (Revision Required)</p>
            </div>

            ${variables.comments ? `
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #856404;">📝 Feedback & Required Changes</h4>
                <p style="margin-bottom: 0;">${variables.comments.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}

            <div style="margin: 30px 0;">
              <h4 style="color: #495057;">Next Steps</h4>
              <p>Please review the feedback provided and make the necessary revisions to your book. Once you've addressed the comments, you can resubmit the book for review.</p>
            </div>

            ${variables.actionUrl ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${variables.actionUrl}" 
                   style="background-color: #ffc107; color: #212529; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Edit Book
                </a>
              </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d; text-align: center;">
              This is an automated notification from the Book Management System.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
❌ BOOK REQUIRES REVISION

Revision Required:
The book "${variables.bookTitle}" requires revisions before it can be approved for publication.

Book Details:
- Title: ${variables.bookTitle}
- Author: ${variables.userName}
- Book ID: ${variables.bookId}
- Status: Submitted for Editing (Revision Required)

${variables.comments ? `
Feedback & Required Changes:
${variables.comments}
` : ''}

Next Steps:
Please review the feedback provided and make the necessary revisions to your book. Once you've addressed the comments, you can resubmit the book for review.

${variables.actionUrl ? `Edit Book: ${variables.actionUrl}` : ''}

---
This is an automated notification from the Book Management System.
    `;

    return { subject, htmlBody, textBody };
  }

  /**
   * Generate email content for book published notification
   */
  private generateBookPublishedContent(variables: EmailVariables): EmailContent {
    const subject = `🎉 Book Published Successfully: "${variables.bookTitle}"`;
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #6f42c1;">🎉 Book Published Successfully</h2>
            
            <div style="background-color: #e7e3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6f42c1;">
              <h3 style="margin-top: 0; color: #4c2a85;">Congratulations!</h3>
              <p style="margin-bottom: 0;">The book "<strong>${variables.bookTitle}</strong>" has been successfully published and is now available to readers.</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Book Details</h3>
              <p><strong>Title:</strong> ${variables.bookTitle}</p>
              <p><strong>Author:</strong> ${variables.userName}</p>
              <p><strong>Book ID:</strong> ${variables.bookId}</p>
              <p><strong>Status:</strong> Published</p>
            </div>

            ${variables.comments ? `
              <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #1976d2;">📝 Publication Notes</h4>
                <p style="margin-bottom: 0;">${variables.comments.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}

            <div style="margin: 30px 0;">
              <h4 style="color: #495057;">What's Next?</h4>
              <p>Your book is now live and available to readers. You can view the published book and track its performance through the dashboard.</p>
            </div>

            ${variables.actionUrl ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${variables.actionUrl}" 
                   style="background-color: #6f42c1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  View Published Book
                </a>
              </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d; text-align: center;">
              This is an automated notification from the Book Management System.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
🎉 BOOK PUBLISHED SUCCESSFULLY

Congratulations!
The book "${variables.bookTitle}" has been successfully published and is now available to readers.

Book Details:
- Title: ${variables.bookTitle}
- Author: ${variables.userName}
- Book ID: ${variables.bookId}
- Status: Published

${variables.comments ? `
Publication Notes:
${variables.comments}
` : ''}

What's Next?
Your book is now live and available to readers. You can view the published book and track its performance through the dashboard.

${variables.actionUrl ? `View Published Book: ${variables.actionUrl}` : ''}

---
This is an automated notification from the Book Management System.
    `;

    return { subject, htmlBody, textBody };
  }
}