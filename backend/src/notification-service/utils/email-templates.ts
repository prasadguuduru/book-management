/**
 * Hardcoded email templates for notification service
 * Provides email content generation with simple variable substitution
 */

import { NotificationType, EmailVariables, EmailContent } from '../types/notification';

/**
 * Get email content for a specific notification type
 */
export function getEmailContent(
  type: NotificationType,
  variables: EmailVariables = {}
): EmailContent {
  const {
    userName = 'User',
    bookTitle = 'Untitled Book',
    bookId = '',
    actionUrl = '',
    comments = ''
  } = variables;

  switch (type) {
    case 'book_submitted':
      return {
        subject: `New Book Submitted for Review: ${bookTitle}`,
        htmlBody: generateBookSubmittedHtml(userName, bookTitle, bookId, actionUrl),
        textBody: generateBookSubmittedText(userName, bookTitle, bookId, actionUrl)
      };

    case 'book_approved':
      return {
        subject: `Your Book Has Been Approved: ${bookTitle}`,
        htmlBody: generateBookApprovedHtml(userName, bookTitle, bookId, actionUrl, comments),
        textBody: generateBookApprovedText(userName, bookTitle, bookId, actionUrl, comments)
      };

    case 'book_rejected':
      return {
        subject: `Book Review Feedback: ${bookTitle}`,
        htmlBody: generateBookRejectedHtml(userName, bookTitle, bookId, actionUrl, comments),
        textBody: generateBookRejectedText(userName, bookTitle, bookId, actionUrl, comments)
      };

    case 'book_published':
      return {
        subject: `Your Book is Now Published: ${bookTitle}`,
        htmlBody: generateBookPublishedHtml(userName, bookTitle, bookId, actionUrl),
        textBody: generateBookPublishedText(userName, bookTitle, bookId, actionUrl)
      };

    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}

/**
 * Book Submitted Templates
 */
function generateBookSubmittedHtml(userName: string, bookTitle: string, bookId: string, actionUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>New Book Submitted for Review</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📚 New Book Submitted for Review</h2>
        </div>
        
        <div class="content">
            <p>Hello,</p>
            
            <p>A new book has been submitted for review and requires your attention.</p>
            
            <p><strong>Book Details:</strong></p>
            <ul>
                <li><strong>Title:</strong> ${bookTitle}</li>
                <li><strong>Author:</strong> ${userName}</li>
                <li><strong>Book ID:</strong> ${bookId}</li>
                <li><strong>Status:</strong> Awaiting Review</li>
            </ul>
            
            <p>Please review the book and provide your feedback.</p>
            
            ${actionUrl ? `<p><a href="${actionUrl}" class="button">Review Book</a></p>` : ''}
        </div>
        
        <div class="footer">
            <p>This is an automated notification from the Ebook Publishing Platform.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
}

function generateBookSubmittedText(userName: string, bookTitle: string, bookId: string, actionUrl: string): string {
  return `
NEW BOOK SUBMITTED FOR REVIEW

Hello,

A new book has been submitted for review and requires your attention.

Book Details:
- Title: ${bookTitle}
- Author: ${userName}
- Book ID: ${bookId}
- Status: Awaiting Review

Please review the book and provide your feedback.

${actionUrl ? `Review Book: ${actionUrl}` : ''}

---
This is an automated notification from the Ebook Publishing Platform.
Please do not reply to this email.
`;
}

/**
 * Book Approved Templates
 */
function generateBookApprovedHtml(userName: string, bookTitle: string, bookId: string, actionUrl: string, comments: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Book Approved</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #d4edda; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .comments { background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎉 Congratulations! Your Book Has Been Approved</h2>
        </div>
        
        <div class="content">
            <p>Dear ${userName},</p>
            
            <p>Great news! Your book has been approved and is ready for the next stage in the publishing process.</p>
            
            <p><strong>Book Details:</strong></p>
            <ul>
                <li><strong>Title:</strong> ${bookTitle}</li>
                <li><strong>Book ID:</strong> ${bookId}</li>
                <li><strong>Status:</strong> Approved</li>
            </ul>
            
            ${comments ? `
            <div class="comments">
                <h4>Reviewer Comments:</h4>
                <p>${comments}</p>
            </div>
            ` : ''}
            
            <p>Your book will now proceed to the publication stage. You will receive another notification once it's published.</p>
            
            ${actionUrl ? `<p><a href="${actionUrl}" class="button">View Book</a></p>` : ''}
        </div>
        
        <div class="footer">
            <p>This is an automated notification from the Ebook Publishing Platform.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
}

function generateBookApprovedText(userName: string, bookTitle: string, bookId: string, actionUrl: string, comments: string): string {
  return `
CONGRATULATIONS! YOUR BOOK HAS BEEN APPROVED

Dear ${userName},

Great news! Your book has been approved and is ready for the next stage in the publishing process.

Book Details:
- Title: ${bookTitle}
- Book ID: ${bookId}
- Status: Approved

${comments ? `
Reviewer Comments:
${comments}
` : ''}

Your book will now proceed to the publication stage. You will receive another notification once it's published.

${actionUrl ? `View Book: ${actionUrl}` : ''}

---
This is an automated notification from the Ebook Publishing Platform.
Please do not reply to this email.
`;
}

/**
 * Book Rejected Templates
 */
function generateBookRejectedHtml(userName: string, bookTitle: string, bookId: string, actionUrl: string, comments: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Book Review Feedback</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8d7da; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .comments { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📝 Book Review Feedback</h2>
        </div>
        
        <div class="content">
            <p>Dear ${userName},</p>
            
            <p>Thank you for submitting your book for review. After careful consideration, we have some feedback that needs to be addressed before publication.</p>
            
            <p><strong>Book Details:</strong></p>
            <ul>
                <li><strong>Title:</strong> ${bookTitle}</li>
                <li><strong>Book ID:</strong> ${bookId}</li>
                <li><strong>Status:</strong> Requires Revision</li>
            </ul>
            
            ${comments ? `
            <div class="comments">
                <h4>Reviewer Feedback:</h4>
                <p>${comments}</p>
            </div>
            ` : ''}
            
            <p>Please review the feedback and make the necessary revisions. Once you've addressed the comments, you can resubmit your book for review.</p>
            
            ${actionUrl ? `<p><a href="${actionUrl}" class="button">Edit Book</a></p>` : ''}
        </div>
        
        <div class="footer">
            <p>This is an automated notification from the Ebook Publishing Platform.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
}

function generateBookRejectedText(userName: string, bookTitle: string, bookId: string, actionUrl: string, comments: string): string {
  return `
BOOK REVIEW FEEDBACK

Dear ${userName},

Thank you for submitting your book for review. After careful consideration, we have some feedback that needs to be addressed before publication.

Book Details:
- Title: ${bookTitle}
- Book ID: ${bookId}
- Status: Requires Revision

${comments ? `
Reviewer Feedback:
${comments}
` : ''}

Please review the feedback and make the necessary revisions. Once you've addressed the comments, you can resubmit your book for review.

${actionUrl ? `Edit Book: ${actionUrl}` : ''}

---
This is an automated notification from the Ebook Publishing Platform.
Please do not reply to this email.
`;
}

/**
 * Book Published Templates
 */
function generateBookPublishedHtml(userName: string, bookTitle: string, bookId: string, actionUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Book Published</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #d1ecf1; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #17a2b8; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🚀 Your Book is Now Published!</h2>
        </div>
        
        <div class="content">
            <p>Dear ${userName},</p>
            
            <p>Congratulations! Your book has been successfully published and is now available to readers.</p>
            
            <p><strong>Book Details:</strong></p>
            <ul>
                <li><strong>Title:</strong> ${bookTitle}</li>
                <li><strong>Book ID:</strong> ${bookId}</li>
                <li><strong>Status:</strong> Published</li>
                <li><strong>Publication Date:</strong> ${new Date().toLocaleDateString()}</li>
            </ul>
            
            <p>Your book is now live and can be discovered by readers. We wish you great success with your publication!</p>
            
            ${actionUrl ? `<p><a href="${actionUrl}" class="button">View Published Book</a></p>` : ''}
        </div>
        
        <div class="footer">
            <p>This is an automated notification from the Ebook Publishing Platform.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;
}

function generateBookPublishedText(userName: string, bookTitle: string, bookId: string, actionUrl: string): string {
  return `
YOUR BOOK IS NOW PUBLISHED!

Dear ${userName},

Congratulations! Your book has been successfully published and is now available to readers.

Book Details:
- Title: ${bookTitle}
- Book ID: ${bookId}
- Status: Published
- Publication Date: ${new Date().toLocaleDateString()}

Your book is now live and can be discovered by readers. We wish you great success with your publication!

${actionUrl ? `View Published Book: ${actionUrl}` : ''}

---
This is an automated notification from the Ebook Publishing Platform.
Please do not reply to this email.
`;
}