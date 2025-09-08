/**
 * Tests for request validation utilities
 */

import { validateNotificationRequest, sanitizeNotificationRequest, validateCCEmails } from '../utils/validation';

describe('validateNotificationRequest', () => {
  const validRequest = {
    type: 'book_submitted',
    recipientEmail: 'test@example.com',
    variables: {
      userName: 'John Doe',
      bookTitle: 'Test Book'
    }
  };

  it('should validate a valid notification request', () => {
    const result = validateNotificationRequest(validRequest);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing request body', () => {
    const result = validateNotificationRequest(null);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Request body is required');
  });

  it('should reject missing notification type', () => {
    const request: any = { ...validRequest };
    delete request.type;

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Notification type is required');
  });

  it('should reject invalid notification type', () => {
    const request = {
      ...validRequest,
      type: 'invalid_type'
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid notification type. Must be one of: book_submitted, book_approved, book_rejected, book_published');
  });

  it('should accept all valid notification types', () => {
    const validTypes = ['book_submitted', 'book_approved', 'book_rejected', 'book_published'];

    validTypes.forEach(type => {
      const request = {
        ...validRequest,
        type
      };

      const result = validateNotificationRequest(request);
      expect(result.isValid).toBe(true);
    });
  });

  it('should reject missing recipient email', () => {
    const request: any = { ...validRequest };
    delete request.recipientEmail;

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Recipient email is required');
  });

  it('should reject invalid email formats', () => {
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'test@',
      'test..test@example.com',
      'test@example',
      'test @example.com'
    ];

    invalidEmails.forEach(email => {
      const request = {
        ...validRequest,
        recipientEmail: email
      };

      const result = validateNotificationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid recipient email format');
    });
  });

  it('should reject empty email addresses', () => {
    const emptyEmails = ['', ' '];

    emptyEmails.forEach(email => {
      const request = {
        ...validRequest,
        recipientEmail: email
      };

      const result = validateNotificationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Recipient email is required');
    });
  });

  it('should accept valid email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'test123@test-domain.com',
      'a@b.co'
    ];

    validEmails.forEach(email => {
      const request = {
        ...validRequest,
        recipientEmail: email
      };

      const result = validateNotificationRequest(request);
      expect(result.isValid).toBe(true);
    });
  });

  it('should accept request without variables', () => {
    const request = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com'
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object variables', () => {
    const request = {
      ...validRequest,
      variables: 'invalid'
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Variables must be an object');
  });

  it('should accept empty variables object', () => {
    const request = {
      ...validRequest,
      variables: {}
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect multiple validation errors', () => {
    const request = {
      type: 'invalid_type',
      recipientEmail: 'invalid-email',
      variables: 'not-an-object'
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors).toContain('Invalid notification type. Must be one of: book_submitted, book_approved, book_rejected, book_published');
    expect(result.errors).toContain('Invalid recipient email format');
    expect(result.errors).toContain('Variables must be an object');
  });

  // CC Email validation tests
  it('should accept valid CC emails array', () => {
    const request = {
      ...validRequest,
      ccEmails: ['cc1@example.com', 'cc2@example.com']
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept empty CC emails array', () => {
    const request = {
      ...validRequest,
      ccEmails: []
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-array CC emails', () => {
    const request = {
      ...validRequest,
      ccEmails: 'not-an-array'
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('CC emails must be an array');
  });

  it('should reject invalid CC email formats', () => {
    const request = {
      ...validRequest,
      ccEmails: ['valid@example.com', 'invalid-email', 'another@valid.com']
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid CC email format(s): invalid-email');
  });

  it('should reject multiple invalid CC email formats', () => {
    const request = {
      ...validRequest,
      ccEmails: ['invalid1', 'valid@example.com', 'invalid2@']
    };

    const result = validateNotificationRequest(request);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid CC email format(s): invalid1, invalid2@');
  });
});

describe('sanitizeNotificationRequest', () => {
  it('should sanitize email address', () => {
    const request = {
      type: 'book_submitted',
      recipientEmail: '  TEST@EXAMPLE.COM  ',
      variables: { userName: 'John' }
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.recipientEmail).toBe('test@example.com');
    expect(sanitized.type).toBe('book_submitted');
    expect(sanitized.variables).toEqual({ userName: 'John' });
  });

  it('should provide empty variables object when missing', () => {
    const request = {
      type: 'book_approved',
      recipientEmail: 'test@example.com'
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.variables).toEqual({});
  });

  it('should preserve existing variables', () => {
    const variables = {
      userName: 'John Doe',
      bookTitle: 'Test Book',
      bookId: 'book-123'
    };

    const request = {
      type: 'book_published',
      recipientEmail: 'test@example.com',
      variables
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.variables).toEqual(variables);
  });

  // CC Email sanitization tests
  it('should sanitize CC emails', () => {
    const request = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com',
      ccEmails: ['  CC1@EXAMPLE.COM  ', 'cc2@example.com', '  CC3@TEST.COM  '],
      variables: {}
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.ccEmails).toEqual(['cc1@example.com', 'cc2@example.com', 'cc3@test.com']);
  });

  it('should filter out empty CC emails', () => {
    const request = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com',
      ccEmails: ['valid@example.com', '', '  ', 'another@valid.com'],
      variables: {}
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.ccEmails).toEqual(['valid@example.com', 'another@valid.com']);
  });

  it('should handle non-string CC emails', () => {
    const request = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com',
      ccEmails: ['valid@example.com', null, undefined, 123, 'another@valid.com'],
      variables: {}
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.ccEmails).toEqual(['valid@example.com', 'another@valid.com']);
  });

  it('should not include ccEmails if not provided', () => {
    const request = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com',
      variables: {}
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.ccEmails).toBeUndefined();
  });

  it('should not include ccEmails if empty array provided', () => {
    const request = {
      type: 'book_submitted',
      recipientEmail: 'test@example.com',
      ccEmails: [],
      variables: {}
    };

    const sanitized = sanitizeNotificationRequest(request);

    expect(sanitized.ccEmails).toBeUndefined();
  });
});

describe('validateCCEmails', () => {
  it('should validate array of valid emails', () => {
    const ccEmails = ['cc1@example.com', 'cc2@test.com'];
    const result = validateCCEmails(ccEmails);

    expect(result.valid).toBe(true);
    expect(result.validEmails).toEqual(['cc1@example.com', 'cc2@test.com']);
    expect(result.invalidEmails).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should handle mixed valid and invalid emails', () => {
    const ccEmails = ['valid@example.com', 'invalid-email', 'another@valid.com'];
    const result = validateCCEmails(ccEmails);

    expect(result.valid).toBe(false);
    expect(result.validEmails).toEqual(['valid@example.com', 'another@valid.com']);
    expect(result.invalidEmails).toEqual(['invalid-email']);
    expect(result.errors).toContain('Invalid CC email format: invalid-email');
  });

  it('should handle empty array', () => {
    const ccEmails: string[] = [];
    const result = validateCCEmails(ccEmails);

    expect(result.valid).toBe(true);
    expect(result.validEmails).toEqual([]);
    expect(result.invalidEmails).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should reject non-array input', () => {
    const ccEmails = 'not-an-array' as any;
    const result = validateCCEmails(ccEmails);

    expect(result.valid).toBe(false);
    expect(result.validEmails).toEqual([]);
    expect(result.invalidEmails).toEqual([]);
    expect(result.errors).toContain('CC emails must be an array');
  });

  it('should handle non-string elements', () => {
    const ccEmails = ['valid@example.com', 123, null, undefined, 'another@valid.com'] as any;
    const result = validateCCEmails(ccEmails);

    expect(result.valid).toBe(false);
    expect(result.validEmails).toEqual(['valid@example.com', 'another@valid.com']);
    expect(result.invalidEmails).toContain('123');
    expect(result.errors).toContain('CC email must be a string: 123');
  });

  it('should handle empty strings', () => {
    const ccEmails = ['valid@example.com', '', '  ', 'another@valid.com'];
    const result = validateCCEmails(ccEmails);

    expect(result.valid).toBe(false);
    expect(result.validEmails).toEqual(['valid@example.com', 'another@valid.com']);
    expect(result.invalidEmails).toContain('');
    expect(result.errors).toContain('CC email cannot be empty');
  });

  it('should normalize valid emails to lowercase', () => {
    const ccEmails = ['CC1@EXAMPLE.COM', 'cc2@Test.Com'];
    const result = validateCCEmails(ccEmails);

    expect(result.valid).toBe(true);
    expect(result.validEmails).toEqual(['cc1@example.com', 'cc2@test.com']);
  });
});