/**
 * Tests for email template generation
 */

import { getEmailContent } from '../utils/email-templates';
import { NotificationType, EmailVariables } from '../types/notification';

describe('Email Templates', () => {
  describe('getEmailContent', () => {
    const defaultVariables: EmailVariables = {
      userName: 'John Doe',
      bookTitle: 'Test Book',
      bookId: 'book-123',
      actionUrl: 'https://platform.com/books/book-123',
      comments: 'Great work!'
    };

    describe('book_submitted notifications', () => {
      it('should generate correct content for book submission', () => {
        const content = getEmailContent('book_submitted', defaultVariables);

        expect(content.subject).toBe('New Book Submitted for Review: Test Book');
        expect(content.htmlBody).toContain('Test Book');
        expect(content.htmlBody).toContain('John Doe');
        expect(content.htmlBody).toContain('book-123');
        expect(content.htmlBody).toContain('https://platform.com/books/book-123');
        expect(content.textBody).toContain('Test Book');
        expect(content.textBody).toContain('John Doe');
      });

      it('should handle missing variables gracefully', () => {
        const content = getEmailContent('book_submitted', {});

        expect(content.subject).toBe('New Book Submitted for Review: Untitled Book');
        expect(content.htmlBody).toContain('Untitled Book');
        expect(content.htmlBody).toContain('User');
        expect(content.textBody).toContain('Untitled Book');
        expect(content.textBody).toContain('User');
      });
    });

    describe('book_approved notifications', () => {
      it('should generate correct content for book approval', () => {
        const content = getEmailContent('book_approved', defaultVariables);

        expect(content.subject).toBe('Your Book Has Been Approved: Test Book');
        expect(content.htmlBody).toContain('Congratulations');
        expect(content.htmlBody).toContain('Test Book');
        expect(content.htmlBody).toContain('John Doe');
        expect(content.htmlBody).toContain('Great work!');
        expect(content.textBody).toContain('CONGRATULATIONS');
        expect(content.textBody).toContain('Great work!');
      });

      it('should handle missing comments', () => {
        const variables = { ...defaultVariables };
        delete variables.comments;
        
        const content = getEmailContent('book_approved', variables);

        expect(content.htmlBody).not.toContain('Reviewer Comments');
        expect(content.textBody).not.toContain('Reviewer Comments');
      });
    });

    describe('book_rejected notifications', () => {
      it('should generate correct content for book rejection', () => {
        const content = getEmailContent('book_rejected', defaultVariables);

        expect(content.subject).toBe('Book Review Feedback: Test Book');
        expect(content.htmlBody).toContain('feedback that needs to be addressed');
        expect(content.htmlBody).toContain('Test Book');
        expect(content.htmlBody).toContain('John Doe');
        expect(content.htmlBody).toContain('Great work!');
        expect(content.textBody).toContain('BOOK REVIEW FEEDBACK');
        expect(content.textBody).toContain('Great work!');
      });
    });

    describe('book_published notifications', () => {
      it('should generate correct content for book publication', () => {
        const content = getEmailContent('book_published', defaultVariables);

        expect(content.subject).toBe('Your Book is Now Published: Test Book');
        expect(content.htmlBody).toContain('successfully published');
        expect(content.htmlBody).toContain('Test Book');
        expect(content.htmlBody).toContain('John Doe');
        expect(content.htmlBody).toContain('now available to readers');
        expect(content.textBody).toContain('YOUR BOOK IS NOW PUBLISHED');
        expect(content.textBody).toContain('now available to readers');
      });

      it('should include publication date', () => {
        const content = getEmailContent('book_published', defaultVariables);
        const today = new Date().toLocaleDateString();

        expect(content.htmlBody).toContain(today);
        expect(content.textBody).toContain(today);
      });
    });

    describe('error handling', () => {
      it('should throw error for unknown notification type', () => {
        expect(() => {
          getEmailContent('unknown_type' as NotificationType, defaultVariables);
        }).toThrow('Unknown notification type: unknown_type');
      });
    });

    describe('variable substitution', () => {
      it('should handle special characters in variables', () => {
        const variables: EmailVariables = {
          userName: 'John "The Author" Doe',
          bookTitle: 'Test & Development <Guide>',
          comments: 'Great work! Keep it up.'
        };

        const content = getEmailContent('book_approved', variables);

        expect(content.htmlBody).toContain('John "The Author" Doe');
        expect(content.htmlBody).toContain('Test & Development <Guide>');
        expect(content.htmlBody).toContain('Great work! Keep it up.');
      });

      it('should handle empty string variables', () => {
        const variables: EmailVariables = {
          userName: '',
          bookTitle: '',
          bookId: '',
          actionUrl: '',
          comments: ''
        };

        const content = getEmailContent('book_submitted', variables);

        expect(content.subject).toBe('New Book Submitted for Review: Untitled Book');
        expect(content.htmlBody).toContain('User');
        expect(content.htmlBody).not.toContain('href=""');
      });
    });

    describe('HTML and text content consistency', () => {
      it('should include key information in both HTML and text versions', () => {
        const content = getEmailContent('book_approved', defaultVariables);

        // Check that key information appears in both versions
        expect(content.htmlBody).toContain('Test Book');
        expect(content.textBody).toContain('Test Book');
        
        expect(content.htmlBody).toContain('John Doe');
        expect(content.textBody).toContain('John Doe');
        
        expect(content.htmlBody).toContain('book-123');
        expect(content.textBody).toContain('book-123');
        
        expect(content.htmlBody).toContain('Great work!');
        expect(content.textBody).toContain('Great work!');
      });

      it('should have proper HTML structure', () => {
        const content = getEmailContent('book_submitted', defaultVariables);

        expect(content.htmlBody).toContain('<!DOCTYPE html>');
        expect(content.htmlBody).toContain('<html>');
        expect(content.htmlBody).toContain('</html>');
        expect(content.htmlBody).toContain('<head>');
        expect(content.htmlBody).toContain('<body>');
        expect(content.htmlBody).toContain('<style>');
      });

      it('should have readable text version', () => {
        const content = getEmailContent('book_published', defaultVariables);

        expect(content.textBody).toContain('YOUR BOOK IS NOW PUBLISHED');
        expect(content.textBody).toContain('---');
        expect(content.textBody).toContain('This is an automated notification');
        expect(content.textBody).not.toContain('<');
        expect(content.textBody).not.toContain('>');
      });
    });
  });
});