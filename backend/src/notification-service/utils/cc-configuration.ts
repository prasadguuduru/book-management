/**
 * CC Configuration Management for Notification Service
 * Handles environment variable reading, validation, and configuration parsing
 */

import { CCConfiguration } from '../types/notification';
import { validateCCEmails } from './validation';

/**
 * Default CC email address
 */
const DEFAULT_CC_EMAIL = 'bookmanagement@yopmail.com';

/**
 * Environment variable names
 */
const ENV_VARS = {
  CC_EMAIL: 'NOTIFICATION_CC_EMAIL',
  CC_EMAILS: 'NOTIFICATION_CC_EMAILS',
  CC_ENABLED: 'NOTIFICATION_CC_ENABLED'
} as const;

/**
 * Load CC configuration from environment variables
 */
export function loadCCConfiguration(): CCConfiguration {
  const enabled = getCCEnabled();
  const emails = getCCEmails();
  const defaultEmail = getDefaultCCEmail();

  return {
    enabled,
    emails,
    defaultEmail
  };
}

/**
 * Get CC enabled status from environment
 */
function getCCEnabled(): boolean {
  const envValue = process.env[ENV_VARS.CC_ENABLED];
  
  if (!envValue) {
    return true; // Default to enabled
  }

  // Handle various string representations of boolean
  const normalizedValue = envValue.toLowerCase().trim();
  return normalizedValue !== 'false' && normalizedValue !== '0' && normalizedValue !== 'no';
}

/**
 * Get CC emails from environment variables with validation
 */
function getCCEmails(): string[] {
  // First check for multiple CC emails
  const ccEmailsEnv = process.env[ENV_VARS.CC_EMAILS];
  if (ccEmailsEnv && ccEmailsEnv.trim()) {
    const emailArray = parseCommaSeparatedEmails(ccEmailsEnv);
    const validationResult = validateCCEmails(emailArray);
    
    // Use valid emails even if some are invalid
    if (validationResult.validEmails.length > 0) {
      // Log warning about invalid emails if any
      if (validationResult.errors.length > 0) {
        console.warn('Invalid CC emails in NOTIFICATION_CC_EMAILS:', validationResult.errors);
      }
      return validationResult.validEmails;
    }
    
    // Log warning about all emails being invalid
    if (validationResult.errors.length > 0) {
      console.warn('Invalid CC emails in NOTIFICATION_CC_EMAILS:', validationResult.errors);
    }
  }

  // Fallback to single CC email
  const singleCCEmail = process.env[ENV_VARS.CC_EMAIL];
  if (singleCCEmail !== undefined) {
    // If explicitly set to empty string, disable CC functionality (requirement 3.3)
    if (singleCCEmail.trim() === '') {
      return [];
    }
    
    const validationResult = validateCCEmails([singleCCEmail.trim()]);
    
    if (validationResult.validEmails.length > 0) {
      return validationResult.validEmails;
    }
    
    // Log warning about invalid single CC email
    console.warn('Invalid CC email in NOTIFICATION_CC_EMAIL:', validationResult.errors);
  }

  // Final fallback to default email
  const defaultValidation = validateCCEmails([DEFAULT_CC_EMAIL]);
  if (defaultValidation.validEmails.length > 0) {
    return defaultValidation.validEmails;
  }

  // This should never happen with our default email, but handle gracefully
  console.error('Default CC email is invalid, CC functionality will be disabled');
  return [];
}

/**
 * Get default CC email (for reference/logging purposes)
 */
function getDefaultCCEmail(): string {
  return DEFAULT_CC_EMAIL;
}

/**
 * Parse comma-separated email string into array
 */
function parseCommaSeparatedEmails(emailString: string): string[] {
  return emailString
    .split(',')
    .map(email => email.trim())
    .filter(email => email.length > 0);
}

/**
 * Get effective CC emails for a notification, excluding duplicates with primary recipient
 */
export function getEffectiveCCEmails(
  configuration: CCConfiguration,
  primaryRecipient: string
): string[] {
  if (!configuration.enabled || configuration.emails.length === 0) {
    return [];
  }

  const normalizedPrimary = primaryRecipient.toLowerCase().trim();
  
  // Filter out the primary recipient to avoid duplicates
  return configuration.emails.filter(email => 
    email.toLowerCase().trim() !== normalizedPrimary
  );
}

/**
 * Validate CC configuration at startup
 */
export function validateCCConfigurationAtStartup(): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    // Check environment variable configuration first
    const ccEmailsEnv = process.env[ENV_VARS.CC_EMAILS];
    const ccEmailEnv = process.env[ENV_VARS.CC_EMAIL];
    
    if (!ccEmailsEnv && !ccEmailEnv) {
      warnings.push(`No CC email configuration found, using default: ${DEFAULT_CC_EMAIL}`);
    }
    
    // Validate configured emails before fallback
    let hasValidConfiguredEmails = false;
    
    if (ccEmailsEnv && ccEmailsEnv.trim()) {
      const emailArray = parseCommaSeparatedEmails(ccEmailsEnv);
      const validationResult = validateCCEmails(emailArray);
      
      if (validationResult.valid && validationResult.validEmails.length > 0) {
        hasValidConfiguredEmails = true;
      } else if (validationResult.errors.length > 0) {
        warnings.push(`Some CC emails failed validation in NOTIFICATION_CC_EMAILS: ${validationResult.errors.join(', ')}`);
      }
    } else if (ccEmailEnv && ccEmailEnv.trim()) {
      const validationResult = validateCCEmails([ccEmailEnv.trim()]);
      
      if (validationResult.valid && validationResult.validEmails.length > 0) {
        hasValidConfiguredEmails = true;
      } else if (validationResult.errors.length > 0) {
        warnings.push(`CC email failed validation in NOTIFICATION_CC_EMAIL: ${validationResult.errors.join(', ')}`);
      }
    }
    
    // Load final configuration
    const config = loadCCConfiguration();
    
    // Check if CC is enabled but we fell back to default due to invalid configuration
    if (config.enabled && !hasValidConfiguredEmails && (ccEmailsEnv || ccEmailEnv)) {
      warnings.push('CC is enabled but no valid CC emails found in configuration, falling back to default');
    }
    
    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
    
  } catch (error) {
    errors.push(`Failed to load CC configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      valid: false,
      warnings,
      errors
    };
  }
}

/**
 * Get configuration summary for logging/debugging
 */
export function getCCConfigurationSummary(): {
  enabled: boolean;
  emailCount: number;
  emails: string[];
  defaultEmail: string;
  environmentVariables: {
    ccEmail: string | undefined;
    ccEmails: string | undefined;
    ccEnabled: string | undefined;
  };
} {
  const config = loadCCConfiguration();
  
  return {
    enabled: config.enabled,
    emailCount: config.emails.length,
    emails: config.emails,
    defaultEmail: config.defaultEmail,
    environmentVariables: {
      ccEmail: process.env[ENV_VARS.CC_EMAIL],
      ccEmails: process.env[ENV_VARS.CC_EMAILS],
      ccEnabled: process.env[ENV_VARS.CC_ENABLED]
    }
  };
}