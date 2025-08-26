/**
 * Encryption service for PII data using AES-256-GCM
 */

import * as crypto from 'crypto';
import { config } from '@/config/environment';
import { EncryptedData } from '@/types';
import { logger } from '@/utils/logger';

export class EncryptionService {
  // private algorithm = 'aes-256-gcm'; // Not used with current implementation
  private key: Buffer;

  constructor() {
    // Ensure the key is exactly 32 bytes for AES-256
    const keyString = config.encryption.key;
    if (keyString.length !== 32) {
      // For development, pad or truncate the key
      const paddedKey = keyString.padEnd(32, '0').substring(0, 32);
      this.key = Buffer.from(paddedKey, 'utf8');
      logger.warn('Encryption key was adjusted to 32 bytes. Use a proper 32-byte key in production.');
    } else {
      this.key = Buffer.from(keyString, 'utf8');
    }
  }

  /**
   * Encrypt PII data
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.key);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: '', // Not used for CBC mode
      };
    } catch (error) {
      logger.error('Error encrypting data:', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt PII data
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.key);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Error decrypting data:', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash sensitive data (for indexing purposes)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random string
   */
  generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate encrypted data structure
   */
  isValidEncryptedData(data: any): data is EncryptedData {
    return (
      data &&
      typeof data.encrypted === 'string' &&
      typeof data.iv === 'string' &&
      typeof data.tag === 'string'
    );
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();