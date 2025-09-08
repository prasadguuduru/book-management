/**
 * Unit tests for CC Configuration Management
 */

import {
  loadCCConfiguration,
  getEffectiveCCEmails,
  validateCCConfigurationAtStartup,
  getCCConfigurationSummary
} from '../utils/cc-configuration';
import { CCConfiguration } from '../types/notification';

// Mock console methods to avoid noise in tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  // Clear environment variables before each test
  delete process.env['NOTIFICATION_CC_EMAIL'];
  delete process.env['NOTIFICATION_CC_EMAILS'];
  delete process.env['NOTIFICATION_CC_ENABLED'];
  
  // Mock console methods
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('CC Configuration Management', () => {
  describe('loadCCConfiguration', () => {
    it('should return default configuration when no environment variables are set', () => {
      const config = loadCCConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.emails).toEqual(['bookmanagement@yopmail.com']);
      expect(config.defaultEmail).toBe('bookmanagement@yopmail.com');
    });

    it('should use single CC email from NOTIFICATION_CC_EMAIL', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = 'manager@example.com';
      
      const config = loadCCConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.emails).toEqual(['manager@example.com']);
      expect(config.defaultEmail).toBe('bookmanagement@yopmail.com');
    });

    it('should use multiple CC emails from NOTIFICATION_CC_EMAILS', () => {
      process.env['NOTIFICATION_CC_EMAILS'] = 'manager1@example.com,manager2@example.com';
      
      const config = loadCCConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.emails).toEqual(['manager1@example.com', 'manager2@example.com']);
      expect(config.defaultEmail).toBe('bookmanagement@yopmail.com');
    });

    it('should prioritize NOTIFICATION_CC_EMAILS over NOTIFICATION_CC_EMAIL', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = 'single@example.com';
      process.env['NOTIFICATION_CC_EMAILS'] = 'multi1@example.com,multi2@example.com';
      
      const config = loadCCConfiguration();
      
      expect(config.emails).toEqual(['multi1@example.com', 'multi2@example.com']);
    });

    it('should handle whitespace in comma-separated emails', () => {
      process.env['NOTIFICATION_CC_EMAILS'] = ' manager1@example.com , manager2@example.com , manager3@example.com ';
      
      const config = loadCCConfiguration();
      
      expect(config.emails).toEqual(['manager1@example.com', 'manager2@example.com', 'manager3@example.com']);
    });

    it('should filter out empty emails from comma-separated list', () => {
      process.env['NOTIFICATION_CC_EMAILS'] = 'manager1@example.com,,manager2@example.com, ,manager3@example.com';
      
      const config = loadCCConfiguration();
      
      expect(config.emails).toEqual(['manager1@example.com', 'manager2@example.com', 'manager3@example.com']);
    });

    it('should fallback to default when invalid emails are provided', () => {
      process.env['NOTIFICATION_CC_EMAILS'] = 'invalid-email,another-invalid';
      
      const config = loadCCConfiguration();
      
      expect(config.emails).toEqual(['bookmanagement@yopmail.com']);
      expect(console.warn).toHaveBeenCalledWith(
        'Invalid CC emails in NOTIFICATION_CC_EMAILS:',
        expect.arrayContaining([
          'Invalid CC email format: invalid-email',
          'Invalid CC email format: another-invalid'
        ])
      );
    });

    it('should fallback to default when single CC email is invalid', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = 'invalid-email';
      
      const config = loadCCConfiguration();
      
      expect(config.emails).toEqual(['bookmanagement@yopmail.com']);
      expect(console.warn).toHaveBeenCalledWith(
        'Invalid CC email in NOTIFICATION_CC_EMAIL:',
        expect.arrayContaining(['Invalid CC email format: invalid-email'])
      );
    });

    it('should disable CC when NOTIFICATION_CC_EMAIL is set to empty string (requirement 3.3)', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = '';
      
      const config = loadCCConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.emails).toEqual([]);
      expect(config.defaultEmail).toBe('bookmanagement@yopmail.com');
    });

    it('should disable CC when NOTIFICATION_CC_EMAIL is set to whitespace only', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = '   ';
      
      const config = loadCCConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.emails).toEqual([]);
      expect(config.defaultEmail).toBe('bookmanagement@yopmail.com');
    });
  });

  describe('CC Enabled Configuration', () => {
    it('should default to enabled when NOTIFICATION_CC_ENABLED is not set', () => {
      const config = loadCCConfiguration();
      expect(config.enabled).toBe(true);
    });

    it('should be disabled when NOTIFICATION_CC_ENABLED is "false"', () => {
      process.env['NOTIFICATION_CC_ENABLED'] = 'false';
      const config = loadCCConfiguration();
      expect(config.enabled).toBe(false);
    });

    it('should be disabled when NOTIFICATION_CC_ENABLED is "0"', () => {
      process.env['NOTIFICATION_CC_ENABLED'] = '0';
      const config = loadCCConfiguration();
      expect(config.enabled).toBe(false);
    });

    it('should be disabled when NOTIFICATION_CC_ENABLED is "no"', () => {
      process.env['NOTIFICATION_CC_ENABLED'] = 'no';
      const config = loadCCConfiguration();
      expect(config.enabled).toBe(false);
    });

    it('should be enabled for any other value', () => {
      const testValues = ['true', '1', 'yes', 'enabled', 'anything'];
      
      testValues.forEach(value => {
        process.env['NOTIFICATION_CC_ENABLED'] = value;
        const config = loadCCConfiguration();
        expect(config.enabled).toBe(true);
      });
    });

    it('should handle case insensitive values', () => {
      process.env['NOTIFICATION_CC_ENABLED'] = 'FALSE';
      const config = loadCCConfiguration();
      expect(config.enabled).toBe(false);
    });

    it('should handle whitespace in enabled value', () => {
      process.env['NOTIFICATION_CC_ENABLED'] = '  false  ';
      const config = loadCCConfiguration();
      expect(config.enabled).toBe(false);
    });
  });

  describe('getEffectiveCCEmails', () => {
    it('should return empty array when CC is disabled', () => {
      const config: CCConfiguration = {
        enabled: false,
        emails: ['manager@example.com'],
        defaultEmail: 'bookmanagement@yopmail.com'
      };
      
      const result = getEffectiveCCEmails(config, 'author@example.com');
      expect(result).toEqual([]);
    });

    it('should return empty array when no CC emails configured', () => {
      const config: CCConfiguration = {
        enabled: true,
        emails: [],
        defaultEmail: 'bookmanagement@yopmail.com'
      };
      
      const result = getEffectiveCCEmails(config, 'author@example.com');
      expect(result).toEqual([]);
    });

    it('should return all CC emails when primary recipient is different', () => {
      const config: CCConfiguration = {
        enabled: true,
        emails: ['manager1@example.com', 'manager2@example.com'],
        defaultEmail: 'bookmanagement@yopmail.com'
      };
      
      const result = getEffectiveCCEmails(config, 'author@example.com');
      expect(result).toEqual(['manager1@example.com', 'manager2@example.com']);
    });

    it('should exclude primary recipient from CC emails to avoid duplicates', () => {
      const config: CCConfiguration = {
        enabled: true,
        emails: ['manager1@example.com', 'author@example.com', 'manager2@example.com'],
        defaultEmail: 'bookmanagement@yopmail.com'
      };
      
      const result = getEffectiveCCEmails(config, 'author@example.com');
      expect(result).toEqual(['manager1@example.com', 'manager2@example.com']);
    });

    it('should handle case insensitive duplicate detection', () => {
      const config: CCConfiguration = {
        enabled: true,
        emails: ['manager1@example.com', 'AUTHOR@EXAMPLE.COM', 'manager2@example.com'],
        defaultEmail: 'bookmanagement@yopmail.com'
      };
      
      const result = getEffectiveCCEmails(config, 'author@example.com');
      expect(result).toEqual(['manager1@example.com', 'manager2@example.com']);
    });

    it('should handle whitespace in email comparison', () => {
      const config: CCConfiguration = {
        enabled: true,
        emails: ['manager1@example.com', 'author@example.com', 'manager2@example.com'],
        defaultEmail: 'bookmanagement@yopmail.com'
      };
      
      const result = getEffectiveCCEmails(config, '  AUTHOR@EXAMPLE.COM  ');
      expect(result).toEqual(['manager1@example.com', 'manager2@example.com']);
    });
  });

  describe('validateCCConfigurationAtStartup', () => {
    it('should return valid with no warnings when configuration is correct', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = 'manager@example.com';
      
      const result = validateCCConfigurationAtStartup();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should warn when CC is enabled but no valid emails found', () => {
      process.env['NOTIFICATION_CC_ENABLED'] = 'true';
      process.env['NOTIFICATION_CC_EMAIL'] = 'invalid-email';
      
      const result = validateCCConfigurationAtStartup();
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('CC is enabled but no valid CC emails found in configuration, falling back to default');
    });

    it('should warn when no CC configuration is found', () => {
      const result = validateCCConfigurationAtStartup();
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('No CC email configuration found, using default: bookmanagement@yopmail.com');
    });

    it('should warn about invalid emails in configuration', () => {
      process.env['NOTIFICATION_CC_EMAILS'] = 'valid@example.com,invalid-email';
      
      const result = validateCCConfigurationAtStartup();
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('Some CC emails failed validation in NOTIFICATION_CC_EMAILS'))).toBe(true);
    });

    it('should handle configuration loading errors gracefully', () => {
      // Create a separate test by mocking process.env to cause an error
      const originalEnv = process.env;
      
      // Mock process.env to cause an error in the configuration loading
      Object.defineProperty(process, 'env', {
        value: new Proxy({}, {
          get() {
            throw new Error('Environment access error');
          }
        }),
        configurable: true
      });
      
      const result = validateCCConfigurationAtStartup();
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to load CC configuration'))).toBe(true);
      
      // Restore original environment
      Object.defineProperty(process, 'env', {
        value: originalEnv,
        configurable: true
      });
    });
  });

  describe('getCCConfigurationSummary', () => {
    it('should return complete configuration summary', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = 'single@example.com';
      process.env['NOTIFICATION_CC_EMAILS'] = 'multi1@example.com,multi2@example.com';
      process.env['NOTIFICATION_CC_ENABLED'] = 'true';
      
      const summary = getCCConfigurationSummary();
      
      expect(summary).toEqual({
        enabled: true,
        emailCount: 2,
        emails: ['multi1@example.com', 'multi2@example.com'],
        defaultEmail: 'bookmanagement@yopmail.com',
        environmentVariables: {
          ccEmail: 'single@example.com',
          ccEmails: 'multi1@example.com,multi2@example.com',
          ccEnabled: 'true'
        }
      });
    });

    it('should return summary with default values when no env vars set', () => {
      const summary = getCCConfigurationSummary();
      
      expect(summary).toEqual({
        enabled: true,
        emailCount: 1,
        emails: ['bookmanagement@yopmail.com'],
        defaultEmail: 'bookmanagement@yopmail.com',
        environmentVariables: {
          ccEmail: undefined,
          ccEmails: undefined,
          ccEnabled: undefined
        }
      });
    });

    it('should return summary when CC is disabled', () => {
      process.env['NOTIFICATION_CC_ENABLED'] = 'false';
      process.env['NOTIFICATION_CC_EMAIL'] = 'manager@example.com';
      
      const summary = getCCConfigurationSummary();
      
      expect(summary.enabled).toBe(false);
      expect(summary.emails).toEqual(['manager@example.com']);
      expect(summary.environmentVariables.ccEnabled).toBe('false');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    // Reset environment and mocks before each edge case test
    beforeEach(() => {
      delete process.env['NOTIFICATION_CC_EMAIL'];
      delete process.env['NOTIFICATION_CC_EMAILS'];
      delete process.env['NOTIFICATION_CC_ENABLED'];
      console.warn = jest.fn();
      console.error = jest.fn();
    });

    it('should handle empty string environment variables', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = '';
      process.env['NOTIFICATION_CC_EMAILS'] = '';
      
      const config = loadCCConfiguration();
      
      // Empty string should disable CC functionality (requirement 3.3)
      expect(config.emails).toEqual([]);
    });

    it('should handle whitespace-only environment variables', () => {
      process.env['NOTIFICATION_CC_EMAIL'] = '   ';
      process.env['NOTIFICATION_CC_EMAILS'] = '   ';
      
      const config = loadCCConfiguration();
      
      // Whitespace-only should also disable CC functionality
      expect(config.emails).toEqual([]);
    });

    it('should handle mixed valid and invalid emails in comma-separated list', () => {
      process.env['NOTIFICATION_CC_EMAILS'] = 'valid@example.com,invalid-email,another@example.com,also-invalid';
      
      const config = loadCCConfiguration();
      
      expect(config.emails).toEqual(['valid@example.com', 'another@example.com']);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should normalize email addresses to lowercase', () => {
      process.env['NOTIFICATION_CC_EMAILS'] = 'Manager1@EXAMPLE.COM,MANAGER2@example.com';
      
      const config = loadCCConfiguration();
      
      expect(config.emails).toEqual(['manager1@example.com', 'manager2@example.com']);
    });
  });
});